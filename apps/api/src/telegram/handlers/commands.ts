import type { Context } from 'grammy';
import { serviceClient } from '../../lib/supabase';
import { linkedUserId } from './shared';
import { t } from '../i18n';

/** /help — short summary of what the bot can do. */
export async function handleHelp(ctx: Context): Promise<void> {
  await ctx.reply(t(ctx.from?.language_code, 'help'));
}

/** /status — tell the user whether this Telegram account is linked. */
export async function handleStatusCmd(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const lang = ctx.from.language_code;
  const userId = await linkedUserId(ctx.from.id);
  if (userId) {
    await ctx.reply(t(lang, 'status_linked'));
  } else {
    await ctx.reply(t(lang, 'status_unlinked'));
  }
}

/** /unlink — remove the link row for this Telegram account. */
export async function handleUnlink(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  await serviceClient().from('telegram_links').delete().eq('telegram_user_id', ctx.from.id);
  await ctx.reply(t(ctx.from.language_code, 'unlinked'));
}
