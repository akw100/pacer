import type { Context } from 'grammy';
import { putWorkoutDraft, takeWorkoutDraft } from '../workoutDraft';
import { logWorkoutForUser } from '../saveWorkout';
import { today, linkedUserId, userGroups } from './shared';
import { langOf, t, tShared } from '../i18n';

export async function handleWorkoutConfirm(ctx: Context): Promise<void> {
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
  const draft = takeWorkoutDraft(key);
  if (!draft) {
    await ctx.answerCallbackQuery(t(lang, 'workout_not_pending'));
    return;
  }
  if (action === 'wdiscard') {
    await ctx.answerCallbackQuery(t(lang, 'discarded_toast'));
    await ctx.editMessageText(t(lang, 'discarded'));
    return;
  }
  // `wsave` (personal) or `wsave:<groupId>` (tag the workout to that group).
  const sharedGroupId = action?.startsWith('wsave:') ? action.slice('wsave:'.length) : null;
  const result = await logWorkoutForUser(userId, draft, today(), sharedGroupId);
  if (result.ok) {
    await ctx.answerCallbackQuery(t(lang, 'saved_toast'));
    if (sharedGroupId) {
      const name = (await userGroups(userId)).find((g) => g.id === sharedGroupId)?.name;
      await ctx.editMessageText(tShared(lang, 'workout_shared', name ?? (langOf(lang) === 'he' ? 'הקבוצה שלך' : 'your group')));
    } else {
      await ctx.editMessageText(t(lang, 'workout_saved'));
    }
  } else {
    // Transient failure — put the draft back so tapping ✓ again retries it.
    putWorkoutDraft(key, draft);
    await ctx.answerCallbackQuery(t(lang, 'save_failed_toast'));
    await ctx.editMessageText(t(lang, 'workout_save_error'));
  }
}
