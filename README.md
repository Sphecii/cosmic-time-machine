# Space Observatory

Space is a responsive astronomy experience with NASA Eyes, a JWST image archive, and email-verified user accounts.

## Features

- NASA Eyes embeds for the Solar System, Earth, exoplanets, and asteroids. Only the selected experience is loaded.
- A JWST image archive with catalog, program, and observation browsing.
- Account signup with email verification, sign-in, sign-out, and password recovery.
- SQLite-backed users, sessions, and expiring one-time auth tokens.

## Requirements

- Node.js 22.12 or later (Node.js 24 LTS recommended).
- npm.
- A JWST API key to use the image archive.
- Maileroo SMTP credentials and a verified sender address to deliver verification and reset emails.

## Run Locally

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env.local` and set `JWST_API_KEY`.
3. Copy `backend/.env.example` to `backend/.env` and set the SMTP credentials and verified sender. Preserve any existing local env files when updating the project.
4. Start the app:

   ```sh
   npm run dev
   ```

Vite starts at `http://localhost:5173`. The SQLite database is created at `data/space.sqlite` on first run.

The NASA Eyes experiences load from NASA and require an internet connection. JWST archive requests are proxied through the Vite server so the API key stays server-side.

## Environment

The root `.env.local` file contains `JWST_API_KEY`. The backend reads `backend/.env`:

| Variable | Purpose |
| --- | --- |
| `SMTP_HOST` | SMTP server; defaults to `smtp.maileroo.com`. |
| `SMTP_PORT` | SMTP port; defaults to `587`. |
| `SMTP_SECURE` | Set to `true` for implicit TLS; use `false` with port 587. |
| `SMTP_USERNAME` | Maileroo SMTP username. |
| `SMTP_PASSWORD` | Maileroo SMTP password. |
| `SMTP_FROM_NAME` | Optional sender display name; defaults to `Space`. |
| `SMTP_FROM_EMAIL` | Sender address verified with Maileroo; defaults to the SMTP username. |
| `APP_BASE_URL` | Public app URL used in email links; defaults to `http://localhost:5173`. |
| `MAILEROO_SENDING_KEY` | Kept for Maileroo API integrations; SMTP email uses the username and password. |

Never add real credentials to source control or expose them through frontend variables such as `VITE_*`. Local env files are ignored by Git.

## Account Email Flow

New accounts must verify their email before sign-in. Verification links expire after 24 hours. Password reset links expire after one hour; each token can be used once, and resetting a password revokes existing sessions. Reset requests use a generic response to avoid disclosing whether an email address has an account.

Existing accounts are preserved as verified when the auth database schema is migrated.

## Build and Preview

```sh
npm run build
npm run preview
```

The auth and JWST API routes are implemented as Vite middleware in `vite.config.mjs` and are available in development and Vite preview. A static deployment of `dist/` alone does not include these API routes; production hosting must also provide a Node-compatible backend, persistent writable storage for SQLite, and the server-side environment variables.