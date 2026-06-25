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

/** 'webhook' only when explicitly selected; otherwise polling (local dev). */
export function botMode(): 'webhook' | 'polling' {
  return process.env['TELEGRAM_MODE'] === 'webhook' ? 'webhook' : 'polling';
}
