import { useEffect, useState } from 'react';
import spaceBackground from '../SpaceLoginBackG.png';
import Explorer from './Explorer.jsx';

async function readResponse(response) {
  try {
    return JSON.parse(await response.text());
  } catch {
    return null;
  }
}

export default function App() {
  const [mode, setMode] = useState(() => new URLSearchParams(window.location.hash.slice(1)).has('reset') ? 'reset' : 'signin');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('reset') || '');
  const [signedIn, setSignedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;

    fetch('/api/session')
      .then((response) => response.json())
      .then((session) => {
        if (session.user && active) setSignedIn(true);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setAuthReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('verify');
    if (!token) return undefined;

    let active = true;
    setPending(true);
    fetch('/api/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const result = await readResponse(response);
        if (!response.ok) throw new Error(result?.error || 'This verification link is invalid or has expired.');
        if (active) setMessage(result?.message || 'Your email is verified. You can now sign in.');
      })
      .catch((error) => {
        if (active) setMessage(error.message || 'Could not verify your email.');
      })
      .finally(() => {
        if (active) setPending(false);
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const isSignUp = mode === 'signup';
    const isForgot = mode === 'forgot';
    const isReset = mode === 'reset';
    const email = formData.get('email');
    const password = formData.get('password');
    const passwordConfirmation = formData.get('passwordConfirmation');

    if (isSignUp && password !== passwordConfirmation) {
      setMessage('Your passwords do not match.');
      setPending(false);
      return;
    }

    if (isReset && password !== passwordConfirmation) {
      setMessage('Your passwords do not match.');
      setPending(false);
      return;
    }

    const body = isForgot
      ? { email }
      : isReset
        ? { token: resetToken, password, passwordConfirmation }
        : {
          email,
          password,
          remember: formData.get('remember') === 'on',
          ...(isSignUp ? {
            name: formData.get('name'),
            passwordConfirmation,
          } : {}),
        };
    const endpoint = isSignUp
      ? '/api/signup'
      : isForgot
        ? '/api/password/forgot'
        : isReset
          ? '/api/password/reset'
          : '/api/login';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await readResponse(response);
      if (!response.ok) {
        const error = new Error(result?.error || `Request failed (HTTP ${response.status}).`);
        error.code = result?.code;
        throw error;
      }

      if (isSignUp || isForgot) {
        setMessage(result?.message || 'Check your inbox for the next step.');
        if (isSignUp) setMode('signin');
        setShowResend(false);
      } else if (isReset) {
        setMode('signin');
        setResetToken('');
        setMessage(result?.message || 'Your password has been updated.');
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      } else {
        if (!result?.user) throw new Error('The server returned an invalid response. Please try again.');
        setSignedIn(true);
      }
    } catch (error) {
      setMessage(error.message || 'Unable to connect. Please try again.');
      if (error.code === 'email_not_verified' || error.code === 'email_delivery_failed') {
        setResendEmail(email || '');
        setShowResend(true);
      }
    } finally {
      setPending(false);
    }
  }

  async function handleSignOut() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } finally {
      setSignedIn(false);
      setMode('signin');
      setMessage('');
    }
  }

  function handlePasswordReset(event) {
    event.preventDefault();
    setMode('forgot');
    setMessage('');
    setShowResend(false);
  }

  async function handleResendVerification() {
    setPending(true);
    try {
      const response = await fetch('/api/verification/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(result?.error || 'Could not send a verification email.');
      setMessage(result?.message || 'If that account needs verification, a link will be sent shortly.');
      setShowResend(false);
    } catch (error) {
      setMessage(error.message || 'Could not send a verification email.');
    } finally {
      setPending(false);
    }
  }

  if (!authReady) {
    return <main className="auth-loading" aria-live="polite">Opening your Space...</main>;
  }

  if (signedIn) return <Explorer onSignOut={handleSignOut} />;

  const isSignUp = mode === 'signup';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';

  return (
    <main className="login-shell">
      <section className="visual-panel" aria-label="A view of a nebula in space">
        <img
          className="visual-image"
            src={spaceBackground}
          alt="A vivid nebula glowing in deep space"
        />
        <div className="visual-shade" />
        <div className="ambient-motion" aria-hidden="true">
          <span className="shooting-star shooting-star--one" />
          <span className="shooting-star shooting-star--two" />
          <span className="shooting-star shooting-star--three" />
        </div>
        <header className="visual-header">
          <a className="wordmark" href="#home" aria-label="Space home">
            <span className="brand-mark" aria-hidden="true">S</span>
            <span>space</span>
          </a>
          <span className="secure-label"><span />SECURE ACCESS</span>
        </header>
        <div className="visual-copy">
          <p className="eyebrow">YOUR UNIVERSE, IN REACH</p>
          <h1>Make room<br />for wonder.</h1>
          <p className="visual-description">
            Pick up where curiosity takes you. Your next great discovery starts here.
          </p>
          <div className="image-credit">COSMIC NEBULA <span>·</span> DEEP SPACE</div>
        </div>
        <div className="visual-index" aria-hidden="true">01 <span /> 04</div>
      </section>

      <section className="form-panel">
        <div className="mobile-wordmark" aria-hidden="true">
          <span className="brand-mark">S</span><span>space</span>
        </div>
        <div className="form-content">
          <div className="form-heading">
            <p className="eyebrow form-eyebrow">{isSignUp ? 'JOIN SPACE' : isForgot || isReset ? 'ACCOUNT RECOVERY' : 'WELCOME BACK'}</p>
            <h2>{isSignUp ? 'Create your account' : isForgot ? 'Reset your password' : isReset ? 'Choose a new password' : 'Sign in to Space'}</h2>
            <p className="form-subtitle">
              {isSignUp
                ? 'A new universe is just ahead.'
                : isForgot
                  ? 'We’ll email you a secure password reset link.'
                  : isReset
                    ? 'Choose a new password for your account.'
                    : 'Your account is the starting point.'}
            </p>
          </div>

          <form className="login-form" key={`${mode}-${resendEmail}`} onSubmit={handleSubmit}>
            {isSignUp && (
              <>
                <label className="field-label" htmlFor="name">Full name</label>
                <input
                  className="text-input signup-input"
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Your name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={80}
                  required
                />
              </>
            )}

            {!isReset && <>
              <label className="field-label" htmlFor="email">Email address</label>
              <input
                className={`text-input${isSignUp ? ' signup-input' : ''}`}
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                defaultValue={resendEmail}
                maxLength={254}
                required
              />
            </>}

            {!isForgot && <>
              <div className={`password-label-row${isSignUp ? ' password-label-row--signup' : ''}`}>
                <label className="field-label" htmlFor="password">{isReset ? 'New password' : 'Password'}</label>
                {mode === 'signin' && (
                <a className="text-link" href="#password-reset" onClick={handlePasswordReset}>
                  Forgot password?
                </a>
                )}
              </div>
              <div className="password-input-wrap">
                <input
                  className="text-input"
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isSignUp || isReset ? 'At least 8 characters' : 'Enter your password'}
                  autoComplete={isSignUp || isReset ? 'new-password' : 'current-password'}
                  minLength={isSignUp || isReset ? 8 : undefined}
                  maxLength={128}
                  required
                />
                <button
                  className="visibility-button"
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </>}

            {(isSignUp || isReset) && (
              <>
                <label className="field-label confirmation-label" htmlFor="password-confirmation">Confirm password</label>
                <input
                  className="text-input signup-input"
                  id="password-confirmation"
                  name="passwordConfirmation"
                  type="password"
                  placeholder="Enter your password again"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                />
              </>
            )}

            {mode === 'signin' && <label className="remember-row">
              <input type="checkbox" name="remember" />
              <span className="checkbox-face" aria-hidden="true" />
              <span>Keep me signed in</span>
            </label>}

            <button className="submit-button" type="submit" disabled={pending}>
              <span>{pending ? 'Please wait…' : isSignUp ? 'Create account' : isForgot ? 'Send reset link' : isReset ? 'Update password' : 'Sign in'}</span>
              <span className="button-arrow" aria-hidden="true">→</span>
            </button>
            <p className="form-message" role="status" aria-live="polite">{message}</p>
            {showResend && <button className="text-link resend-link" type="button" onClick={handleResendVerification} disabled={pending}>
              Resend verification email
            </button>}
          </form>

          <p className="form-switch">
            {isSignUp ? 'Already have an account?' : mode === 'signin' ? 'New to Space?' : 'Remembered your password?'}{' '}
            <button
              className="text-link form-switch-button"
              type="button"
              onClick={() => {
                const nextMode = mode === 'signin' ? 'signup' : 'signin';
                setMode(nextMode);
                setMessage('');
                setShowResend(false);
                setShowPassword(false);
                if (mode === 'reset') {
                  setResetToken('');
                  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
                }
              }}
            >
              {isSignUp || mode !== 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </p>

          <footer className="form-footer">
            <span className="footer-lock" aria-hidden="true">◈</span>
            <span>Your details stay private and encrypted.</span>
          </footer>
        </div>
        <div className="panel-footer"><span>SPACE ACCOUNT</span><span>© 2026 SPACE</span></div>
      </section>
    </main>
  );
}