import { Bot } from 'grammy';
import { botEnabled, botToken, webhookSecret, webhookUrl } from './env';
import { handleStart } from './handlers/start';
import { handleMessage } from './handlers/message';
import { handleConfirm } from './handlers/confirm';
import { handleWorkoutConfirm } from './handlers/confirmWorkout';
import { handleHelp, handleStatusCmd, handleUnlink, handleRecent } from './handlers/commands';
import { log } from './log';

// Lazily built so importing this module never throws when the token is absent.
let _bot: Bot | null = null;

export function getBot(): Bot {
  if (!_bot) {
    const bot = new Bot(botToken());
    bot.command('start', handleStart);
    bot.command('help', handleHelp);
    bot.command('status', handleStatusCmd);
    bot.command('unlink', handleUnlink);
    bot.command('recent', handleRecent);
    // Workout-specific callbacks first so they're caught before the generic
    // run confirm handler (which handles save/save:<id>/discard).
    bot.callbackQuery(/^(wsave|wdiscard)/, handleWorkoutConfirm);
    bot.on('callback_query:data', handleConfirm);
    bot.on('message', handleMessage); // text + photo
    _bot = bot;
  }
  return _bot;
}

/** Start long-polling (local dev). No-op if the bot is disabled. */
export async function startPolling(): Promise<void> {
  if (!botEnabled()) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN not set — bot disabled.');
    return;
  }
  const bot = getBot();
  // Fire-and-forget, but catch: a polling error (e.g. a 409 conflict when a
  // rolling deploy briefly overlaps two instances) must not crash the whole API.
  bot.start().catch((err) => log.error('polling_stopped', { err: String(err) }));
  log.info('bot_polling_started');
}

/** Register the webhook with Telegram (production). Requires secret + url. */
export async function startWebhook(): Promise<void> {
  if (!botEnabled()) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN not set — bot disabled.');
    return;
  }
  const secret = webhookSecret();
  const url = webhookUrl();
  if (!secret || !url) {
    throw new Error(
      '[telegram] webhook mode requires TELEGRAM_WEBHOOK_SECRET and TELEGRAM_WEBHOOK_URL',
    );
  }
  await getBot().api.setWebhook(url, { secret_token: secret });
  console.log(`[telegram] webhook registered at ${url}`);
}
