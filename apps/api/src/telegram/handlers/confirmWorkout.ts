import type { Context } from 'grammy';
import { takeWorkoutDraft } from '../workoutDraft';
import { logWorkoutForUser } from '../saveWorkout';
import { today, linkedUserId, userGroups } from './shared';
import { t } from '../i18n';

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
    await ctx.answerCallbackQuery('Account not linked.');
    return;
  }
  const key = `${msg.chat.id}:${msg.message_id}:${userId}`;
  const draft = takeWorkoutDraft(key);
  if (!draft) {
    await ctx.answerCallbackQuery('This workout is no longer pending.');
    return;
  }
  if (action === 'wdiscard') {
    await ctx.answerCallbackQuery('Discarded.');
    await ctx.editMessageText(t(lang, 'discarded'));
    return;
  }
  // `wsave` (personal) or `wsave:<groupId>` (tag the workout to that group).
  const sharedGroupId = action?.startsWith('wsave:') ? action.slice('wsave:'.length) : null;
  const result = await logWorkoutForUser(userId, draft, today(), sharedGroupId);
  if (result.ok) {
    await ctx.answerCallbackQuery('Saved!');
    if (sharedGroupId) {
      const name = (await userGroups(userId)).find((g) => g.id === sharedGroupId)?.name;
      await ctx.editMessageText(`✅ Workout saved and shared to ${name ?? 'your group'}.`);
    } else {
      await ctx.editMessageText(t(lang, 'workout_saved'));
    }
  } else {
    await ctx.answerCallbackQuery(t(lang, 'save_failed'));
    await ctx.editMessageText('Could not save that workout — please try again.');
  }
}
