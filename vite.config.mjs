import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createTransport } from 'nodemailer';
import { defineConfig, loadEnv } from 'vite';
import { getMailConfig } from './backend/mail-config.mjs';

const databaseDirectory = join(process.cwd(), 'data');
mkdirSync(databaseDirectory, { recursive: true });

const database = new DatabaseSync(join(databaseDirectory, 'space.sqlite'));
database.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);
  CREATE TABLE IF NOT EXISTS auth_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK (purpose IN ('email_verification', 'password_reset')),
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS auth_tokens_user_purpose ON auth_tokens(user_id, purpose);
`);

if (!database.prepare('PRAGMA table_info(users)').all().some((column) => column.name === 'email_verified')) {
  database.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1');
}

const findUserByEmail = database.prepare('SELECT * FROM users WHERE email = ?');
const findSession = database.prepare(`
  SELECT users.id, users.name, users.email, sessions.token_hash
  FROM sessions JOIN users ON users.id = sessions.user_id
  WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.email_verified = 1
`);
const insertSession = database.prepare(
  'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
);
const findActionToken = database.prepare(`
  SELECT auth_tokens.user_id, users.email, users.name
  FROM auth_tokens JOIN users ON users.id = auth_tokens.user_id
  WHERE auth_tokens.token_hash = ? AND auth_tokens.purpose = ? AND auth_tokens.expires_at > ?
`);

function jsonResponse(response, status, body, headers = {}) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) {
      const error = new Error('Request is too large.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Enter valid form details.');
    error.status = 400;
    throw error;
  }
}

function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function passwordHash(password, salt) {
  return scryptSync(password, salt, 64).toString('hex');
}

function sessionTokenFromRequest(request) {
  const cookie = request.headers.cookie || '';
  const entry = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('space_session='));
  return entry ? entry.slice('space_session='.length) : null;
}

function sessionCookie(token, maxAge) {
  const secure = process.env.SPACE_COOKIE_SECURE === 'true' ? '; Secure' : '';
  const age = maxAge === null ? '' : `; Max-Age=${maxAge}`;
  return `space_session=${token}; HttpOnly; SameSite=Lax; Path=/${age}${secure}`;
}

function createSession(userId, remember, response) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24;
  insertSession.run(tokenHash, userId, Date.now() + maxAge * 1000);
  response.setHeader('Set-Cookie', sessionCookie(token, remember ? maxAge : null));
}

function currentUser(request) {
  const token = sessionTokenFromRequest(request);
  if (!token) return null;

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const user = findSession.get(tokenHash, Date.now());
  if (!user) {
    database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }

  return user;
}

function createActionToken(userId, purpose, lifetimeMs) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const now = Date.now();
  database.prepare(`
    INSERT INTO auth_tokens (token_hash, user_id, purpose, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(tokenHash, userId, purpose, now, now + lifetimeMs);
  return token;
}

function hasRecentActionToken(userId, purpose) {
  return Boolean(database.prepare(`
    SELECT 1 FROM auth_tokens
    WHERE user_id = ? AND purpose = ? AND created_at > ?
    LIMIT 1
  `).get(userId, purpose, Date.now() - 60_000));
}

function retireOtherActionTokens(userId, purpose, token) {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  database.prepare(`
    DELETE FROM auth_tokens
    WHERE user_id = ? AND purpose = ? AND token_hash != ?
  `).run(userId, purpose, tokenHash);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function createAuthMailer(env) {
  let config;
  try {
    config = getMailConfig(env);
  } catch {
    return null;
  }

  return {
    transport: createTransport({
      ...config.smtp,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    }),
    from: {
      name: env.SMTP_FROM_NAME || 'Space',
      address: env.SMTP_FROM_EMAIL || config.smtp.auth.user,
    },
  };
}

function authEmailLink(appBaseUrl, action, token) {
  const link = new URL('/', appBaseUrl);
  link.hash = new URLSearchParams({ [action]: token }).toString();
  return link.toString();
}

async function sendActionEmail(mailer, { email, name, subject, heading, message, action, token, appBaseUrl }) {
  if (!mailer) {
    const error = new Error('Email delivery is not configured. Check the backend SMTP settings.');
    error.status = 503;
    throw error;
  }

  const link = authEmailLink(appBaseUrl, action, token);
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(link);
  await mailer.transport.sendMail({
    from: mailer.from,
    to: email,
    subject,
    text: `Hi ${name},\n\n${message}\n\n${link}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Hi ${safeName},</p><p>${message}</p><p><a href="${safeLink}">${heading}</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
  return token;
}

async function handleJwstRequest(request, response, pathname, apiKey) {
  if (request.method !== 'GET') {
    jsonResponse(response, 405, { error: 'This endpoint only supports GET requests.' });
    return;
  }
  if (!apiKey) {
    jsonResponse(response, 503, { error: 'Add JWST_API_KEY to .env.local and restart the app.' });
    return;
  }

  const requestUrl = new URL(request.url, 'http://localhost');
  const page = Math.max(1, Number.parseInt(requestUrl.searchParams.get('page') || '1', 10) || 1);
  const perPage = Math.min(24, Math.max(1, Number.parseInt(requestUrl.searchParams.get('perPage') || '12', 10) || 12));
  let endpoint;

  if (pathname === '/api/jwst/catalog') {
    const observationId = requestUrl.searchParams.get('observationId')?.trim();
    const programId = requestUrl.searchParams.get('programId')?.trim();
    const suffix = requestUrl.searchParams.get('suffix')?.trim();
    const type = requestUrl.searchParams.get('type')?.trim() || 'jpg';

    if (observationId) {
      if (!/^[\w.-]{1,120}$/.test(observationId)) {
        jsonResponse(response, 400, { error: 'Enter a valid observation ID.' });
        return;
      }
      endpoint = `/observation/${encodeURIComponent(observationId)}?page=${page}&perPage=${perPage}`;
    } else if (programId) {
      if (!/^\d{1,12}$/.test(programId)) {
        jsonResponse(response, 400, { error: 'Enter a numeric program ID.' });
        return;
      }
      endpoint = `/program/id/${encodeURIComponent(programId)}`;
    } else if (suffix) {
      if (!/^_[a-z\d]{1,32}$/i.test(suffix)) {
        jsonResponse(response, 400, { error: 'Suffixes start with an underscore and contain letters or numbers.' });
        return;
      }
      endpoint = `/all/suffix/${encodeURIComponent(suffix)}?page=${page}&perPage=${perPage}`;
    } else {
      if (!/^[a-z\d]{1,12}$/i.test(type)) {
        jsonResponse(response, 400, { error: 'Enter a valid file type.' });
        return;
      }
      endpoint = `/all/type/${encodeURIComponent(type)}?page=${page}&perPage=${perPage}`;
    }
  } else if (pathname === '/api/jwst/suffixes') {
    endpoint = '/suffix/list';
  } else if (pathname === '/api/jwst/programs') {
    endpoint = '/program/list?=null';
  } else {
    const programMatch = pathname.match(/^\/api\/jwst\/program\/(\d{1,12})$/);
    const observationMatch = pathname.match(/^\/api\/jwst\/observation\/([\w.-]{1,120})$/);
    if (programMatch) {
      endpoint = `/program/id/${programMatch[1]}`;
    } else if (observationMatch) {
      endpoint = `/observation/${encodeURIComponent(observationMatch[1])}?page=${page}&perPage=${perPage}`;
    } else {
      jsonResponse(response, 404, { error: 'JWST API route not found.' });
      return;
    }
  }

  try {
    const upstream = await fetch(`https://api.jwstapi.com${endpoint}`, {
      headers: { 'X-API-KEY': apiKey },
      signal: AbortSignal.timeout(20_000),
    });
    const text = await upstream.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    if (!upstream.ok) {
      jsonResponse(response, upstream.status, {
        error: payload?.message || payload?.error || `JWST API request failed (${upstream.status}).`,
      });
      return;
    }
    if (payload === null) {
      jsonResponse(response, 502, { error: 'JWST API returned an unreadable response.' });
      return;
    }
    jsonResponse(response, 200, payload);
  } catch (error) {
    const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
    jsonResponse(response, timeout ? 504 : 502, {
      error: timeout ? 'The JWST API took too long to respond.' : 'Could not connect to the JWST API.',
    });
  }
}

function createAuthMiddleware(apiKey, mailer, appBaseUrl) {
  return async (request, response, next) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname.startsWith('/api/jwst/')) {
      await handleJwstRequest(request, response, pathname, apiKey);
      return;
    }
    if (!pathname.startsWith('/api/')) {
      next();
      return;
    }

    try {
      if (request.method === 'GET' && pathname === '/api/session') {
        const user = currentUser(request);
        if (!user) {
          jsonResponse(response, 200, { user: null });
          return;
        }
        jsonResponse(response, 200, { user: { id: user.id, name: user.name, email: user.email } });
        return;
      }

      if (request.method === 'POST' && pathname === '/api/verify-email') {
        const body = await readJson(request);
        const token = typeof body.token === 'string' ? body.token : '';
        const tokenHash = createHash('sha256').update(token).digest('hex');
        const action = findActionToken.get(tokenHash, 'email_verification', Date.now());
        if (!action) {
          jsonResponse(response, 400, { error: 'This verification link is invalid or has expired.' });
          return;
        }

        database.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(action.user_id);
        database.prepare('DELETE FROM auth_tokens WHERE token_hash = ?').run(tokenHash);
        jsonResponse(response, 200, { ok: true, message: 'Your email is verified. You can now sign in.' });
        return;
      }

      if (request.method === 'POST' && pathname === '/api/signup') {
        const body = await readJson(request);
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        const passwordConfirmation = typeof body.passwordConfirmation === 'string'
          ? body.passwordConfirmation
          : '';

        if (name.length < 2 || name.length > 80) {
          throw validationError('Enter a name between 2 and 80 characters.');
        }
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw validationError('Enter a valid email address.');
        }
        if (password.length < 8 || password.length > 128) {
          throw validationError('Your password must be between 8 and 128 characters.');
        }
        if (password !== passwordConfirmation) {
          throw validationError('Your passwords do not match.');
        }
        if (findUserByEmail.get(email)) {
          jsonResponse(response, 409, { error: 'An account with that email already exists.' });
          return;
        }

        const salt = randomBytes(16).toString('hex');
        let result;
        try {
          result = database.prepare(`
            INSERT INTO users (name, email, password_salt, password_hash, email_verified)
            VALUES (?, ?, ?, ?, 0)
          `).run(name, email, salt, passwordHash(password, salt));
        } catch (error) {
          if (error.message.includes('UNIQUE constraint failed')) {
            jsonResponse(response, 409, { error: 'An account with that email already exists.' });
            return;
          }
          throw error;
        }

        const userId = Number(result.lastInsertRowid);
        const token = createActionToken(userId, 'email_verification', 24 * 60 * 60 * 1000);
        try {
          await sendActionEmail(mailer, {
            email,
            name,
            subject: 'Verify your Space account',
            heading: 'Verify email address',
            message: 'Confirm your email address to activate your Space account.',
            action: 'verify',
            token,
            appBaseUrl,
          });
        } catch (error) {
          database.prepare('DELETE FROM auth_tokens WHERE token_hash = ?')
            .run(createHash('sha256').update(token).digest('hex'));
          console.error('Space verification email delivery failed:', error.message);
          jsonResponse(response, error.status || 503, {
            code: 'email_delivery_failed',
            error: 'Your account was created, but the verification email could not be sent. Try resending it shortly.',
          });
          return;
        }

        jsonResponse(response, 201, {
          verificationRequired: true,
          message: 'Check your inbox for a verification link before signing in.',
        });
        return;
      }

      if (request.method === 'POST' && pathname === '/api/verification/resend') {
        const body = await readJson(request);
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw validationError('Enter a valid email address.');
        }
        if (!mailer) {
          jsonResponse(response, 503, { error: 'Email delivery is not configured. Check the backend SMTP settings.' });
          return;
        }

        const user = findUserByEmail.get(email);
        if (user && !user.email_verified && !hasRecentActionToken(user.id, 'email_verification')) {
          const token = createActionToken(user.id, 'email_verification', 24 * 60 * 60 * 1000);
          try {
            await sendActionEmail(mailer, {
              email,
              name: user.name,
              subject: 'Verify your Space account',
              heading: 'Verify email address',
              message: 'Confirm your email address to activate your Space account.',
              action: 'verify',
              token,
              appBaseUrl,
            });
            retireOtherActionTokens(user.id, 'email_verification', token);
          } catch (error) {
            console.error('Space verification email delivery failed:', error.message);
          }
        }

        jsonResponse(response, 202, { message: 'If that account needs verification, a link will be sent shortly.' });
        return;
      }

      if (request.method === 'POST' && pathname === '/api/password/forgot') {
        const body = await readJson(request);
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw validationError('Enter a valid email address.');
        }
        if (!mailer) {
          jsonResponse(response, 503, { error: 'Email delivery is not configured. Check the backend SMTP settings.' });
          return;
        }

        const user = findUserByEmail.get(email);
        if (user && user.email_verified && !hasRecentActionToken(user.id, 'password_reset')) {
          const token = createActionToken(user.id, 'password_reset', 60 * 60 * 1000);
          try {
            await sendActionEmail(mailer, {
              email,
              name: user.name,
              subject: 'Reset your Space password',
              heading: 'Choose a new password',
              message: 'Use this link to choose a new password for your Space account. It expires in one hour.',
              action: 'reset',
              token,
              appBaseUrl,
            });
            retireOtherActionTokens(user.id, 'password_reset', token);
          } catch (error) {
            console.error('Space password reset email delivery failed:', error.message);
          }
        }

        jsonResponse(response, 202, { message: 'If an account exists for that email, a password reset link will arrive shortly.' });
        return;
      }

      if (request.method === 'POST' && pathname === '/api/password/reset') {
        const body = await readJson(request);
        const token = typeof body.token === 'string' ? body.token : '';
        const password = typeof body.password === 'string' ? body.password : '';
        const passwordConfirmation = typeof body.passwordConfirmation === 'string' ? body.passwordConfirmation : '';
        if (password.length < 8 || password.length > 128) {
          throw validationError('Your password must be between 8 and 128 characters.');
        }
        if (password !== passwordConfirmation) {
          throw validationError('Your passwords do not match.');
        }

        const tokenHash = createHash('sha256').update(token).digest('hex');
        const action = findActionToken.get(tokenHash, 'password_reset', Date.now());
        if (!action) {
          jsonResponse(response, 400, { error: 'This reset link is invalid or has expired. Request a new one.' });
          return;
        }

        const salt = randomBytes(16).toString('hex');
        database.prepare('UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?')
          .run(salt, passwordHash(password, salt), action.user_id);
        database.prepare('DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ?')
          .run(action.user_id, 'password_reset');
        database.prepare('DELETE FROM sessions WHERE user_id = ?').run(action.user_id);
        response.setHeader('Set-Cookie', sessionCookie('', 0));
        jsonResponse(response, 200, { ok: true, message: 'Your password has been updated. Sign in with your new password.' });
        return;
      }

      if (request.method === 'POST' && pathname === '/api/login') {
        const body = await readJson(request);
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        const user = findUserByEmail.get(email);

        if (!user || password.length > 128) {
          jsonResponse(response, 401, { error: 'Email or password is incorrect.' });
          return;
        }

        const expectedHash = Buffer.from(user.password_hash, 'hex');
        const actualHash = Buffer.from(passwordHash(password, user.password_salt), 'hex');
        if (expectedHash.length !== actualHash.length || !timingSafeEqual(expectedHash, actualHash)) {
          jsonResponse(response, 401, { error: 'Email or password is incorrect.' });
          return;
        }

        if (!user.email_verified) {
          jsonResponse(response, 403, {
            code: 'email_not_verified',
            error: 'Verify your email address before signing in.',
          });
          return;
        }

        createSession(user.id, body.remember === true, response);
        jsonResponse(response, 200, { user: { id: user.id, name: user.name, email: user.email } });
        return;
      }

      if (request.method === 'POST' && pathname === '/api/logout') {
        const token = sessionTokenFromRequest(request);
        if (token) {
          const tokenHash = createHash('sha256').update(token).digest('hex');
          database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
        }
        response.setHeader('Set-Cookie', sessionCookie('', 0));
        jsonResponse(response, 200, { ok: true });
        return;
      }

      jsonResponse(response, 404, { error: 'Not found.' });
    } catch (error) {
      const status = error.status || 500;
      if (status >= 500) console.error('Space auth API error:', error);
      jsonResponse(response, status, {
        error: status >= 500 ? 'Something went wrong. Please try again.' : error.message,
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendEnv = loadEnv(mode, join(process.cwd(), 'backend'), '');
  const configuration = { ...env, ...backendEnv, ...process.env };
  const apiKey = configuration.JWST_API_KEY;
  const mailer = createAuthMailer(configuration);
  const appBaseUrl = configuration.APP_BASE_URL || 'http://localhost:5173';
  const authApi = {
    name: 'space-auth-api',
    configureServer(server) {
      server.middlewares.use(createAuthMiddleware(apiKey, mailer, appBaseUrl));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createAuthMiddleware(apiKey, mailer, appBaseUrl));
    },
  };

  return { plugins: [authApi] };
});
