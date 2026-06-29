// Telegram/bot-specific env. Kept out of lib/env.ts (Foundation B's file) to
// respect slice ownership. Missing token => bot disabled (never throws at boot).

export function botEnabled(): boolean {
  return Boolean(process.env['TELEGRAM_BOT_TOKEN']);
}

export function botToken(): string {
  const t = process.env['TELEGRAM_BOT_TOKEN'];
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  return t;
}

export function webhookSecret(): string | undefined {
  return process.env['TELEGRAM_WEBHOOK_SECRET'] || undefined;
}

export function webhookUrl(): string | undefined {
  return process.env['TELEGRAM_WEBHOOK_URL'] || undefined;
}

/** 'webhook' only when explicitly selected; otherwise polling (local dev). */
export function botMode(): 'webhook' | 'polling' {
  return process.env['TELEGRAM_MODE'] === 'webhook' ? 'webhook' : 'polling';
}

/**
 * Railway sets RAILWAY_ENVIRONMENT_NAME per environment. The bot connects from a
 * single instance only — production. Staging/local never connect, so two pollers
 * can't fight over one bot token (the 409 conflict).
 */
export function isProduction(): boolean {
  return process.env['RAILWAY_ENVIRONMENT_NAME'] === 'production';
}
