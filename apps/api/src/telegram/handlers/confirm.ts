import type { Context } from 'grammy';
import { takeDraft } from '../draft';
import { logRunForUser } from '../save';
import { today, linkedUserId, userGroups } from './shared';
import { t } from '../i18n';

export async function handleConfirm(ctx: Context): Promise<void> {
  const from = ctx.from;
  const msg = ctx.callbackQuery?.message;
  const action = ctx.callbackQuery?.data;
  if (!from || !msg) {
    await ctx.answerCallbackQuery();
    return;
  }
  const lang = from.language_code;
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
    await ctx.editMessageText(t(lang, 'discarded'));
    return;
  }
  // `save` (personal) or `save:<groupId>` (tag the run to that group).
  const sharedGroupId = action?.startsWith('save:') ? action.slice('save:'.length) : null;
  const result = await logRunForUser(userId, draft, today(), sharedGroupId);
  if (result.ok) {
    await ctx.answerCallbackQuery('Saved!');
    if (sharedGroupId) {
      const name = (await userGroups(userId)).find((g) => g.id === sharedGroupId)?.name;
      await ctx.editMessageText(`✅ Run saved and shared to ${name ?? 'your group'}.`);
    } else {
      await ctx.editMessageText(t(lang, 'run_saved'));
    }
  } else {
    await ctx.answerCallbackQuery(t(lang, 'save_failed'));
    await ctx.editMessageText('Could not save that run — please try again.');
  }
}
