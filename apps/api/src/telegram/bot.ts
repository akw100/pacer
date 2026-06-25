import { Bot } from 'grammy';
import { botEnabled, botToken } from './env';
import { handleStart } from './handlers/start';
import { handleMessage } from './handlers/message';
import { handleConfirm } from './handlers/confirm';

// Lazily built so importing this module never throws when the token is absent.
let _bot: Bot | null = null;

export function getBot(): Bot {
  if (!_bot) {
    const bot = new Bot(botToken());
    bot.command('start', handleStart);
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
  void bot.start(); // resolves only when the bot stops; fire-and-forget
  console.log('[telegram] bot started (long-polling).');
}
