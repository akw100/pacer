import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { metersToKm, formatDuration } from '@pacer/shared';
import { parseText, parsePhoto } from '../parse';
import { putDraft, type RunDraft } from '../draft';
import { tryConsumePhoto } from '../dailyCap';
import { botToken } from '../env';
import { today, linkedUserId } from './shared';

const CONFIDENCE_FLOOR = 0.6;

async function offerConfirm(ctx: Context, userId: string, draft: RunDraft): Promise<void> {
  const km = metersToKm(draft.distance_meters).toFixed(2);
  const dur = formatDuration(draft.duration_seconds);
  const sent = await ctx.reply(
    `Got: ${km} km in ${dur}${draft.run_date ? ` on ${draft.run_date}` : ''}. Save it?`,
    { reply_markup: new InlineKeyboard().text('✓ Save', 'save').text('✗ Discard', 'discard') },
  );
  putDraft(`${sent.chat.id}:${sent.message_id}:${userId}`, draft);
}

export async function handleMessage(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const userId = await linkedUserId(from.id);
  if (!userId) {
    await ctx.reply('Link your account first: Pacer → Settings → copy code → send /start <code>.');
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
        await ctx.reply("You've hit today's photo limit (10). Please type the run instead.");
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
      const draft = await parsePhoto(`data:${mime};base64,${base64}`);
      if (draft.confidence < CONFIDENCE_FLOOR) {
        await ctx.reply("I couldn't read that clearly — please type the run (e.g. \"5k in 28 min\").");
        return;
      }
      await offerConfirm(ctx, userId, draft);
      return;
    }

    const text = ctx.message?.text;
    if (text) {
      const draft = await parseText(text);
      if (draft.confidence < CONFIDENCE_FLOOR) {
        await ctx.reply("I didn't catch a run there. Try \"ran 5k in 28 minutes\".");
        return;
      }
      await offerConfirm(ctx, userId, draft);
    }
  } catch (err) {
    console.error('[telegram] message handler failed:', err);
    await ctx.reply('Something went wrong reading that — please try again.');
  }
}
