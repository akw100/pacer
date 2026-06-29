import type { Context } from 'grammy';
import { metersToKm, formatDuration } from '@pacer/shared';
import { serviceClient } from '../../lib/supabase';
import { linkedUserId } from './shared';
import { t } from '../i18n';

/** /help — short summary of what the bot can do. */
export async function handleHelp(ctx: Context): Promise<void> {
  await ctx.reply(t(ctx.from?.language_code, 'help'));
}

/** /status — tell the user whether this Telegram account is linked. */
export async function handleStatusCmd(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const lang = ctx.from.language_code;
  const userId = await linkedUserId(ctx.from.id);
  if (userId) {
    await ctx.reply(t(lang, 'status_linked'));
  } else {
    await ctx.reply(t(lang, 'status_unlinked'));
  }
}

/** /unlink — remove the link row for this Telegram account. */
export async function handleUnlink(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  await serviceClient().from('telegram_links').delete().eq('telegram_user_id', ctx.from.id);
  await ctx.reply(t(ctx.from.language_code, 'unlinked'));
}

/**
 * /recent — the user's last few runs and workouts, merged newest-first.
 * Reads the canonical runs/workouts tables (meters & seconds stored), and
 * derives the display distance/duration via @pacer/shared helpers.
 */
export async function handleRecent(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const lang = ctx.from.language_code;
  const userId = await linkedUserId(ctx.from.id);
  if (!userId) {
    await ctx.reply(t(lang, 'status_unlinked'));
    return;
  }

  const db = serviceClient();
  const [runsResult, workoutsResult] = await Promise.all([
    db
      .from('runs')
      .select('run_date, distance_meters, duration_seconds')
      .eq('user_id', userId)
      .order('run_date', { ascending: false })
      .limit(5),
    db
      .from('workouts')
      .select('name, kind, workout_date')
      .eq('user_id', userId)
      .order('workout_date', { ascending: false })
      .limit(5),
  ]);

  type Line = { date: string; text: string };
  const lines: Line[] = [];

  for (const r of (runsResult.data ?? []) as {
    run_date: string;
    distance_meters: number;
    duration_seconds: number;
  }[]) {
    const km = metersToKm(Number(r.distance_meters)).toFixed(2);
    const dur = formatDuration(Number(r.duration_seconds));
    lines.push({ date: r.run_date, text: `🏃 ${km} km · ${dur} — ${r.run_date}` });
  }

  for (const w of (workoutsResult.data ?? []) as {
    name: string;
    kind: string;
    workout_date: string;
  }[]) {
    lines.push({ date: w.workout_date, text: `🏋 ${w.name} (${w.kind}) — ${w.workout_date}` });
  }

  if (lines.length === 0) {
    await ctx.reply(t(lang, 'recent_none'));
    return;
  }

  // Newest-first across both kinds; cap at 8 lines.
  lines.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  await ctx.reply(lines.slice(0, 8).map((l) => l.text).join('\n'));
}
