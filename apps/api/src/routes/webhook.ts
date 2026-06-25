import { Hono } from 'hono';
import { webhookCallback } from 'grammy';
import { getBot } from '../telegram/bot';
import { botEnabled, webhookSecret } from '../telegram/env';

// Public route (see PUBLIC_PATH_PREFIXES in app.ts). Telegram echoes our secret
// in this header; reject anything else before handing the update to grammY.
export const webhook = new Hono().post('/', async (c) => {
  if (!botEnabled()) return c.text('bot disabled', 503);
  const secret = webhookSecret();
  if (secret && c.req.header('X-Telegram-Bot-Api-Secret-Token') !== secret) {
    return c.json({ error: 'bad secret token' }, 401);
  }
  return webhookCallback(getBot(), 'hono')(c);
});
