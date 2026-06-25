import type { Context } from 'grammy';
import { takeDraft } from '../draft';
import { logRunForUser } from '../save';
import { today, linkedUserId } from './shared';

export async function handleConfirm(ctx: Context): Promise<void> {
  const from = ctx.from;
  const msg = ctx.callbackQuery?.message;
  const action = ctx.callbackQuery?.data;
  if (!from || !msg) {
    await ctx.answerCallbackQuery();
    return;
  }
  const userId = await linkedUserId(from.id);
  if (!userId) {
    await ctx.answerCallbackQuery('Account not linked.');
    return;
  }
  const key = `${msg.chat.id}:${msg.message_id}:${userId}`;
  const draft = takeDraft(key);
  if (!draft) {
    await ctx.answerCallbackQuery('This run is no longer pending.');
    return;
  }
  if (action === 'discard') {
    await ctx.answerCallbackQuery('Discarded.');
    await ctx.editMessageText('Discarded — nothing saved.');
    return;
  }
  const result = await logRunForUser(userId, draft, today());
  if (result.ok) {
    await ctx.answerCallbackQuery('Saved!');
    await ctx.editMessageText('✅ Run saved to Pacer.');
  } else {
    await ctx.answerCallbackQuery('Save failed.');
    await ctx.editMessageText('Could not save that run — please try again.');
  }
}
