import type { Context } from 'grammy';
import {
  metersToKm,
  formatDuration,
  scoreFor,
  weekRange,
  toDateKey,
  WEEK_START,
} from '@pacer/shared';
import { serviceClient } from '../../lib/supabase';
import { linkedUserId, today } from './shared';
import { langOf, t } from '../i18n';

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
 * /habits — today's habit checklist. Lists each of the user's habits with a
 * ✅/⬜ box for whether it's been checked today (habit_checks.check_date = today).
 */
export async function handleHabitsCmd(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const lang = ctx.from.language_code;
  const userId = await linkedUserId(ctx.from.id);
  if (!userId) {
    await ctx.reply(t(lang, 'status_unlinked'));
    return;
  }

  const db = serviceClient();
  const todayKey = today();
  const [habitsResult, checksResult] = await Promise.all([
    db
      .from('habits')
      .select('id, name, emoji')
      .eq('user_id', userId)
      .order('sort', { ascending: true }),
    db
      .from('habit_checks')
      .select('habit_id')
      .eq('user_id', userId)
      .eq('check_date', todayKey),
  ]);

  const habits = (habitsResult.data ?? []) as { id: string; name: string; emoji: string | null }[];
  if (habits.length === 0) {
    await ctx.reply(t(lang, 'habits_none'));
    return;
  }

  const checkedToday = new Set(
    ((checksResult.data ?? []) as { habit_id: string }[]).map((r) => r.habit_id),
  );

  const lines = habits.map((h) => {
    const box = checkedToday.has(h.id) ? '✅' : '⬜';
    return `${h.emoji ?? ''} ${h.name} ${box}`.trim();
  });
  await ctx.reply(lines.join('\n'));
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

/**
 * /week — this week's points and activity. Points come from the canonical
 * score_events ledger (summed over the week window) — the same source of truth
 * as routes/score.ts. Counts of runs/workouts/habit check-ins come from those
 * tables filtered to the window. Window uses the app-wide WEEK_START (Sunday),
 * matching routes/score.ts.
 */
export async function handleWeek(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const lang = ctx.from.language_code;
  const userId = await linkedUserId(ctx.from.id);
  if (!userId) {
    await ctx.reply(t(lang, 'status_unlinked'));
    return;
  }

  const { start, end } = weekRange(new Date(), WEEK_START);
  const startKey = toDateKey(start);
  const endKey = toDateKey(end);

  const db = serviceClient();
  const [events, runs, workouts, habitChecks] = await Promise.all([
    db
      .from('score_events')
      .select('points, event_date')
      .eq('user_id', userId)
      .gte('event_date', startKey)
      .lte('event_date', endKey),
    db
      .from('runs')
      .select('id')
      .eq('user_id', userId)
      .gte('run_date', startKey)
      .lte('run_date', endKey),
    db
      .from('workouts')
      .select('id')
      .eq('user_id', userId)
      .gte('workout_date', startKey)
      .lte('workout_date', endKey),
    db
      .from('habit_checks')
      .select('id')
      .eq('user_id', userId)
      .gte('check_date', startKey)
      .lte('check_date', endKey),
  ]);

  const runCount = (runs.data ?? []).length;
  const workoutCount = (workouts.data ?? []).length;
  const habitCount = (habitChecks.data ?? []).length;

  // Prefer the canonical ledger (same source of truth as routes/score.ts); fall
  // back to recomputing from counts if the ledger window came back empty.
  const eventRows = (events.data ?? []) as { points: number }[];
  const points =
    eventRows.length > 0
      ? eventRows.reduce((sum, row) => sum + Number(row.points ?? 0), 0)
      : runCount * scoreFor({ reason: 'run', distanceMeters: 0 }) +
        workoutCount * scoreFor({ reason: 'workout' }) +
        habitCount * scoreFor({ reason: 'habit' });

  const he = langOf(lang) === 'he';
  const runLabel = he ? 'ריצות' : runCount === 1 ? 'run' : 'runs';
  const workoutLabel = he ? 'אימונים' : workoutCount === 1 ? 'workout' : 'workouts';
  const habitLabel = he ? 'סימוני הרגלים' : habitCount === 1 ? 'habit check-in' : 'habit check-ins';
  const ptsLabel = he ? 'נק׳' : 'pts';

  const reply =
    `${t(lang, 'week_summary')}: ${runCount} ${runLabel} · ` +
    `${workoutCount} ${workoutLabel} · ${habitCount} ${habitLabel} · ≈ ${points} ${ptsLabel}`;
  await ctx.reply(reply);
}
