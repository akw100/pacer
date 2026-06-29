import type { Context } from 'grammy';
import { serviceClient } from '../../lib/supabase';
import { t } from '../i18n';

// /start <code> — validate an unexpired link code, link this Telegram user to
// the owning account, and delete the one-time code.
export async function handleStart(ctx: Context): Promise<void> {
  const from = ctx.from;
  const code = (ctx.match?.toString() ?? '').trim().toUpperCase();
  if (!from) return;
  const lang = from.language_code;
  if (!code) {
    await ctx.reply(t(lang, 'link_first'));
    return;
  }
  const db = serviceClient();
  const { data: row } = await db
    .from('telegram_link_codes')
    .select('user_id, expires_at')
    .eq('code', code)
    .maybeSingle();
  if (!row || new Date(row.expires_at as string).getTime() < Date.now()) {
    await ctx.reply(t(lang, 'code_invalid'));
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
  await ctx.reply(t(lang, 'linked_ok'));
}
