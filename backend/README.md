# Backend mail configuration

The local `backend/.env` file holds the Maileroo credentials. Enter the SMTP password in `SMTP_PASSWORD` and the sending key in `MAILEROO_SENDING_KEY`. The sending key is kept separate from the SMTP login because it is used by Maileroo's API integrations, not as the SMTP password.

`backend/.env` is ignored by Git. Keep credentials out of frontend code and never prefix them with `VITE_`.

Set `SMTP_FROM_EMAIL` to a sender address verified with Maileroo. For deployment, set `APP_BASE_URL` to the public HTTPS URL of the app so verification and recovery links return to the right site. The Vite auth middleware reads this file when the dev or preview server starts; restart the server after changing it.

`backend/.env.example` is the placeholder template for other environments; do not copy real credentials into it. The Maileroo sending key is retained for possible API use; account verification and password recovery use the SMTP username/password.