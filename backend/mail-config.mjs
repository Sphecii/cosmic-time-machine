export function getMailConfig(env = process.env) {
  const required = ['SMTP_USERNAME', 'SMTP_PASSWORD'];
  const missing = required.filter((name) => !env[name]?.trim());

  if (missing.length) {
    throw new Error(`Missing mail configuration: ${missing.join(', ')}`);
  }

  const port = Number(env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be an integer between 1 and 65535.');
  }

  return {
    smtp: {
      host: env.SMTP_HOST || 'smtp.maileroo.com',
      port,
      secure: env.SMTP_SECURE === 'true',
      auth: {
        user: env.SMTP_USERNAME,
        pass: env.SMTP_PASSWORD,
      },
    },
    mailerooSendingKey: env.MAILEROO_SENDING_KEY || undefined,
  };
}