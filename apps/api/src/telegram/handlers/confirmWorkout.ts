import type { Context } from 'grammy';
import { takeWorkoutDraft } from '../workoutDraft';
import { logWorkoutForUser } from '../saveWorkout';
import { today, linkedUserId } from './shared';

export async function handleWorkoutConfirm(ctx: Context): Promise<void> {
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
  const draft = takeWorkoutDraft(key);
  if (!draft) {
    await ctx.answerCallbackQuery('This workout is no longer pending.');
    return;
  }
  if (action === 'wdiscard') {
    await ctx.answerCallbackQuery('Discarded.');
    await ctx.editMessageText('Discarded — nothing saved.');
    return;
  }
  const result = await logWorkoutForUser(userId, draft, today());
  if (result.ok) {
    await ctx.answerCallbackQuery('Saved!');
    await ctx.editMessageText('✅ Workout saved to Pacer.');
  } else {
    await ctx.answerCallbackQuery('Save failed.');
    await ctx.editMessageText('Could not save that workout — please try again.');
  }
}
