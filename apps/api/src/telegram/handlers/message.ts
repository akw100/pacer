import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { metersToKm, formatDuration, formatPace, paceSecondsPerUnit, scoreFor } from '@pacer/shared';
import { parseText, parsePhoto } from '../parse';
import { parseIntent } from '../parseIntent';
import { parseWorkout } from '../parseWorkout';
import { parseHabit } from '../parseHabit';
import { putDraft, type RunDraft } from '../draft';
import { putWorkoutDraft, type WorkoutDraft } from '../workoutDraft';
import { checkHabitForUser } from '../saveHabit';
import { tryConsumePhoto, tryConsumeText } from '../dailyCap';
import { botToken } from '../env';
import { log } from '../log';
import { t } from '../i18n';
import { today, linkedUserId, userGroups, habitNames } from './shared';

const CONFIDENCE_FLOOR = 0.6;

async function offerConfirm(ctx: Context, userId: string, draft: RunDraft): Promise<void> {
  const km = metersToKm(draft.distance_meters).toFixed(2);
  const dur = formatDuration(draft.duration_seconds);
  const pace = formatPace(paceSecondsPerUnit(draft.distance_meters, draft.duration_seconds, 'km'));
  const pts = scoreFor({ reason: 'run', distanceMeters: draft.distance_meters });
  // One "Save to <group>" button per group the user is in, plus a personal
  // save and discard. Callback data is `save:<groupId>` (group) or `save`
  // (personal); the confirm handler tags shared_group_id accordingly.
  const groups = await userGroups(userId);
  const kb = new InlineKeyboard();
  for (const g of groups) kb.text(`✓ Save to ${g.name}`, `save:${g.id}`).row();
  kb.text(groups.length ? '✓ Save (just me)' : '✓ Save', 'save').row();
  kb.text('✗ Discard', 'discard');
  const sent = await ctx.reply(
    `Got: ${km} km in ${dur} · ${pace}/km · ≈ +${pts} pts${draft.run_date ? ` on ${draft.run_date}` : ''}. Save it?`,
    { reply_markup: kb },
  );
  putDraft(`${sent.chat.id}:${sent.message_id}:${userId}`, draft);
}

async function offerWorkoutConfirm(ctx: Context, userId: string, draft: WorkoutDraft): Promise<void> {
  const setSummary = draft.sets
    .map((s) => `${s.sets}x${s.reps} ${s.exercise_name}${s.weight ? ` @${s.weight}kg` : ''}`)
    .join(', ');
  const sent = await ctx.reply(
    `Workout: ${draft.name} (${draft.kind})${setSummary ? ` — ${setSummary}` : ''}. Save it?`,
    { reply_markup: new InlineKeyboard().text('✓ Save', 'wsave').text('✗ Discard', 'wdiscard') },
  );
  putWorkoutDraft(`${sent.chat.id}:${sent.message_id}:${userId}`, draft);
}

export async function handleMessage(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const code = ctx.from?.language_code;
  const userId = await linkedUserId(from.id);
  if (!userId) {
    await ctx.reply(t(code, 'link_first'));
    return;
  }

  const photos = ctx.message?.photo;
  try {
    if (photos && photos.length > 0) {
      let filePath: string;
      try {
        const file = await ctx.getFile();
        filePath = file.file_path ?? '';
      } catch {
        await ctx.reply("Couldn't fetch that photo — please try again.");
        return;
      }
      if (!tryConsumePhoto(userId, today())) {
        await ctx.reply(t(code, 'photo_limit'));
        return;
      }
      const tgUrl = `https://api.telegram.org/file/bot${botToken()}/${filePath}`;
      const resp = await fetch(tgUrl);
      const base64 = Buffer.from(await resp.arrayBuffer()).toString('base64');
      // Telegram serves file downloads as application/octet-stream, so the
      // response content-type can't be trusted — OpenAI rejects a non-image
      // MIME ("invalid_image_format"). `photo` messages are always JPEG; derive
      // the type from the file extension to stay correct for any image kind.
      const ext = filePath.split('.').pop()?.toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const draft = await parsePhoto(`data:${mime};base64,${base64}`, today());
      if (draft.confidence < CONFIDENCE_FLOOR) {
        await ctx.reply(t(code, 'photo_unreadable'));
        return;
      }
      await offerConfirm(ctx, userId, draft);
      return;
    }

    const text = ctx.message?.text;
    if (text) {
      if (!tryConsumeText(userId, today())) {
        await ctx.reply(t(code, 'text_limit'));
        return;
      }
      const names = await habitNames(userId);
      const { intent } = await parseIntent(text, names);
      if (intent === 'workout') {
        const w = await parseWorkout(text, today());
        if (w.confidence < CONFIDENCE_FLOOR) {
          await ctx.reply(t(code, 'no_workout'));
          return;
        }
        await offerWorkoutConfirm(ctx, userId, w);
        return;
      }
      if (intent === 'habit') {
        const h = await parseHabit(text, names);
        if (h.matched && h.habit_name && h.confidence >= CONFIDENCE_FLOOR) {
          const r = await checkHabitForUser(userId, h.habit_name, today());
          await ctx.reply(r.ok ? t(code, 'habit_done') : t(code, 'habit_fail'));
        } else {
          await ctx.reply(t(code, 'habit_unclear'));
        }
        return;
      }
      // default: treat as a run
      const draft = await parseText(text, today());
      if (draft.confidence < CONFIDENCE_FLOOR) {
        await ctx.reply(t(code, 'no_run'));
        return;
      }
      await offerConfirm(ctx, userId, draft);
    }
  } catch (err) {
    log.error('message_handler_failed', { err: String(err) });
    await ctx.reply(t(code, 'something_wrong'));
  }
}
