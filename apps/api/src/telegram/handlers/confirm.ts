import type { Context } from 'grammy';
import { takeDraft } from '../draft';
import { logRunForUser } from '../save';
import { today, linkedUserId, userGroups } from './shared';
import { langOf, t, tShared } from '../i18n';

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
    await ctx.answerCallbackQuery(t(lang, 'not_linked_toast'));
    return;
  }
  const key = `${msg.chat.id}:${msg.message_id}:${userId}`;
  const draft = takeDraft(key);
  if (!draft) {
    await ctx.answerCallbackQuery(t(lang, 'run_not_pending'));
    return;
  }
  if (action === 'discard') {
    await ctx.answerCallbackQuery(t(lang, 'discarded_toast'));
    await ctx.editMessageText(t(lang, 'discarded'));
    return;
  }
  // `save` (personal) or `save:<groupId>` (tag the run to that group).
  const sharedGroupId = action?.startsWith('save:') ? action.slice('save:'.length) : null;
  const result = await logRunForUser(userId, draft, today(), sharedGroupId);
  if (result.ok) {
    await ctx.answerCallbackQuery(t(lang, 'saved_toast'));
    // A run can be both shared and a distance PR — append the celebration to
    // whichever success line we show.
    const pr = result.isDistancePR ? `\n${t(lang, 'new_distance_record')}` : '';
    if (sharedGroupId) {
      const name = (await userGroups(userId)).find((g) => g.id === sharedGroupId)?.name;
      await ctx.editMessageText(tShared(lang, 'run_shared', name ?? (langOf(lang) === 'he' ? 'הקבוצה שלך' : 'your group')) + pr);
    } else {
      await ctx.editMessageText(t(lang, 'run_saved') + pr);
    }
  } else {
    await ctx.answerCallbackQuery(t(lang, 'save_failed_toast'));
    await ctx.editMessageText(t(lang, 'run_save_error'));
  }
}
