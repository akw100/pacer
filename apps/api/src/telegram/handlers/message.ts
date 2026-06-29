import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { parseText, parsePhoto } from '../parse';
import { parseIntent } from '../parseIntent';
import { parseWorkout, parseWorkoutPhoto } from '../parseWorkout';
import { parseHabit } from '../parseHabit';
import { putDraft, type RunDraft } from '../draft';
import { putWorkoutDraft, type WorkoutDraft } from '../workoutDraft';
import { checkHabitForUser } from '../saveHabit';
import { tryConsumePhoto, tryConsumeText } from '../dailyCap';
import { botToken } from '../env';
import { transcribe } from '../transcribe';
import { log } from '../log';
import { t } from '../i18n';
import { runSummary, workoutSummary } from '../summary';
import { buildRunKeyboard } from './runKeyboard';
import { logRunForUser } from '../save';
import { logWorkoutForUser } from '../saveWorkout';
import { today, linkedUserId, userGroups, habitNames, userUnits } from './shared';

const CONFIDENCE_FLOOR = 0.6;
// Above this parse confidence we skip the ✓/✗ confirm step for TEXT logs and
// save immediately. Photos always confirm (a misread watch is too costly).
const AUTO_SAVE_CONFIDENCE = 0.95;

async function offerConfirm(ctx: Context, userId: string, draft: RunDraft): Promise<void> {
  // ± edit buttons, then one "Save to <group>" button per group the user is in,
  // plus a personal save and discard. Callback data is `save:<groupId>` (group)
  // or `save` (personal); the confirm handler tags shared_group_id accordingly.
  const kb = buildRunKeyboard(await userGroups(userId));
  const units = await userUnits(userId);
  const sent = await ctx.reply(runSummary(draft, units), { reply_markup: kb });
  putDraft(`${sent.chat.id}:${sent.message_id}:${userId}`, draft);
}

async function offerWorkoutConfirm(ctx: Context, userId: string, draft: WorkoutDraft): Promise<void> {
  // Mirror offerConfirm: one "Save to <group>" button per group the user is in,
  // plus a personal save and discard. Callback data is `wsave:<groupId>` (group)
  // or `wsave` (personal); the workout confirm handler tags shared_group_id.
  const groups = await userGroups(userId);
  const kb = new InlineKeyboard();
  for (const g of groups) kb.text(`✓ Save to ${g.name}`, `wsave:${g.id}`).row();
  kb.text(groups.length ? '✓ Save (just me)' : '✓ Save', 'wsave').row();
  kb.text('✗ Discard', 'wdiscard');
  const sent = await ctx.reply(workoutSummary(draft), { reply_markup: kb });
  putWorkoutDraft(`${sent.chat.id}:${sent.message_id}:${userId}`, draft);
}

// Classify a free-text utterance and log/confirm a run, workout, or habit.
// Shared by the text and voice branches; the caller is responsible for the
// daily cap check (so callers can cap on their own terms).
async function routeText(ctx: Context, userId: string, text: string): Promise<void> {
  const code = ctx.from?.language_code;
  const names = await habitNames(userId);
  const { intent } = await parseIntent(text, names);
  if (intent === 'workout') {
    const w = await parseWorkout(text, today());
    if (w.confidence < CONFIDENCE_FLOOR) {
      await ctx.reply(t(code, 'no_workout'));
      return;
    }
    if (w.confidence >= AUTO_SAVE_CONFIDENCE) {
      const r = await logWorkoutForUser(userId, w, today(), null);
      await ctx.reply(r.ok ? t(code, 'workout_saved') : t(code, 'workout_save_error'));
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
  if (draft.confidence >= AUTO_SAVE_CONFIDENCE) {
    const r = await logRunForUser(userId, draft, today(), null);
    if (r.ok) {
      const pr = r.isDistancePR ? `\n${t(code, 'new_distance_record')}` : '';
      await ctx.reply(t(code, 'run_saved') + pr);
    } else {
      await ctx.reply(t(code, 'run_save_error'));
    }
    return;
  }
  await offerConfirm(ctx, userId, draft);
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
        await ctx.reply(t(code, 'photo_fetch_error'));
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
      const dataUrl = `data:${mime};base64,${base64}`;
      // A captioned photo can describe a workout ("leg day" + a gym photo);
      // classify the caption and route to the workout parser when it says so.
      // No caption (or any non-workout intent) → the existing run path.
      const caption = ctx.message?.caption;
      if (caption) {
        const { intent } = await parseIntent(caption, await habitNames(userId));
        if (intent === 'workout') {
          const w = await parseWorkoutPhoto(dataUrl, today());
          if (w.confidence < CONFIDENCE_FLOOR) {
            await ctx.reply(t(code, 'photo_unreadable'));
            return;
          }
          await offerWorkoutConfirm(ctx, userId, w);
          return;
        }
      }
      const draft = await parsePhoto(dataUrl, today());
      if (draft.confidence < CONFIDENCE_FLOOR) {
        await ctx.reply(t(code, 'photo_unreadable'));
        return;
      }
      await offerConfirm(ctx, userId, draft);
      return;
    }

    // Voice notes (and plain audio) are transcribed via Whisper, then routed
    // through the same text classifier so a spoken run/workout/habit logs the
    // same way a typed one does. Caps on the text ceiling (a transcribe + a
    // parse), mirroring the text branch.
    const voice = ctx.message?.voice ?? ctx.message?.audio;
    if (voice) {
      if (!tryConsumeText(userId, today())) {
        await ctx.reply(t(code, 'text_limit'));
        return;
      }
      const file = await ctx.getFile();
      const url = `https://api.telegram.org/file/bot${botToken()}/${file.file_path ?? ''}`;
      const audio = await (await fetch(url)).arrayBuffer();
      const transcript = await transcribe(audio);
      if (!transcript) {
        await ctx.reply(t(code, 'voice_unclear'));
        return;
      }
      await routeText(ctx, userId, transcript);
      return;
    }

    const text = ctx.message?.text;
    if (text) {
      if (!tryConsumeText(userId, today())) {
        await ctx.reply(t(code, 'text_limit'));
        return;
      }
      await routeText(ctx, userId, text);
    }
  } catch (err) {
    log.error('message_handler_failed', { err: String(err) });
    await ctx.reply(t(code, 'something_wrong'));
  }
}
