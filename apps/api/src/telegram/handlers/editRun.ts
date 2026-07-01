import type { Context } from 'grammy';
import { peekDraft, updateDraft, type RunDraft } from '../draft';
import { runSummary } from '../summary';
import { buildRunKeyboard } from './runKeyboard';
import { linkedUserId, userGroups, userUnits } from './shared';

export async function handleRunEdit(ctx: Context): Promise<void> {
  const from = ctx.from;
  const msg = ctx.callbackQuery?.message;
  const data = ctx.callbackQuery?.data;
  if (!from || !msg || !data) { await ctx.answerCallbackQuery(); return; }
  const userId = await linkedUserId(from.id);
  if (!userId) { await ctx.answerCallbackQuery('Account not linked.'); return; }
  const key = `${msg.chat.id}:${msg.message_id}:${userId}`;
  const draft = peekDraft(key);
  if (!draft) { await ctx.answerCallbackQuery('This run is no longer pending.'); return; }
  const [, field, deltaStr] = data.split(':');
  const delta = Number(deltaStr);
  const next: RunDraft = { ...draft };
  if (field === 'dm') next.distance_meters = Math.max(1, draft.distance_meters + delta);
  else if (field === 'ds') next.duration_seconds = Math.max(1, draft.duration_seconds + delta);
  updateDraft(key, next);
  const units = await userUnits(userId);
  const groups = await userGroups(userId);
  await ctx.answerCallbackQuery('Updated');
  await ctx.editMessageText(runSummary(next, units), { reply_markup: buildRunKeyboard(groups) });
}
