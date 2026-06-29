import type { Context } from 'grammy';
import { serviceClient } from '../../lib/supabase';
import { linkedUserId } from './shared';

/** /help — short summary of what the bot can do. */
export async function handleHelp(ctx: Context): Promise<void> {
  await ctx.reply(
    [
      'Pacer bot — what I can do:',
      '• Link your account: send /start <code> (get the code in Pacer → Settings).',
      '• Log a run: just type it ("ran 5k in 28 min") or send a photo of your watch.',
      '• /status — check whether you are linked.',
      '• /unlink — disconnect this Telegram account from Pacer.',
    ].join('\n'),
  );
}

/** /status — tell the user whether this Telegram account is linked. */
export async function handleStatusCmd(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const userId = await linkedUserId(ctx.from.id);
  if (userId) {
    await ctx.reply('✅ Linked to Pacer.');
  } else {
    await ctx.reply('Not linked — send /start <code> (get the code in Pacer → Settings).');
  }
}

/** /unlink — remove the link row for this Telegram account. */
export async function handleUnlink(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  await serviceClient().from('telegram_links').delete().eq('telegram_user_id', ctx.from.id);
  await ctx.reply('Unlinked. Send /start <code> to link again.');
}
