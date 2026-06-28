import type { Context } from 'grammy';
import { serviceClient } from '../../lib/supabase';

// /start <code> — validate an unexpired link code, link this Telegram user to
// the owning account, and delete the one-time code.
export async function handleStart(ctx: Context): Promise<void> {
  const from = ctx.from;
  const code = (ctx.match?.toString() ?? '').trim().toUpperCase();
  if (!from) return;
  if (!code) {
    await ctx.reply('To link, open Pacer → Settings, get your 8-char code, then send: /start <code>');
    return;
  }
  const db = serviceClient();
  const { data: row } = await db
    .from('telegram_link_codes')
    .select('user_id, expires_at')
    .eq('code', code)
    .maybeSingle();
  if (!row || new Date(row.expires_at as string).getTime() < Date.now()) {
    await ctx.reply('That code is invalid or expired. Generate a fresh one in Pacer → Settings.');
    return;
  }
  const { error } = await db.from('telegram_links').upsert({
    user_id: row.user_id as string,
    telegram_user_id: from.id,
    telegram_username: from.username ?? null,
    linked_at: new Date().toISOString(),
  });
  if (error) {
    await ctx.reply('Could not link your account, please try again.');
    return;
  }
  await db.from('telegram_link_codes').delete().eq('code', code);
  await ctx.reply('Linked! Send me a run like "ran 5k in 28 min" or a photo of your watch.');
}
