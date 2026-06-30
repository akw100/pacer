import type { Context } from 'grammy';
import {
  metersToKm,
  metersToDisplayDistance,
  paceSecondsPerUnit,
  formatPace,
  formatDuration,
  scoreFor,
  weekRange,
  toDateKey,
  WEEK_START,
} from '@pacer/shared';
import { serviceClient } from '../../lib/supabase';
import { linkedUserId, today, userUnits } from './shared';
import { langOf, t } from '../i18n';

/** /help — short summary of what the bot can do. */
export async function handleHelp(ctx: Context): Promise<void> {
  await ctx.reply(t(ctx.from?.language_code, 'help'));
}

/**
 * Fallback for any slash-command we don't have a handler for. Registered after
 * all known bot.command(...) handlers (which short-circuit), so only UNknown
 * commands reach here. Points the user at /help.
 */
export async function handleUnknownCommand(ctx: Context): Promise<void> {
  await ctx.reply(t(ctx.from?.language_code, 'unknown_command'));
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

/**
 * /records — the user's personal bests, derived from the canonical tables.
 * Longest run & fastest pace come from `runs` (meters & seconds stored); the
 * top set comes from `workout_sets` (which has no user_id — access is via the
 * parent workout, so we resolve the user's workout ids first). Distance/pace are
 * rendered in the user's unit preference via @pacer/shared helpers.
 */
export async function handleRecords(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const lang = ctx.from.language_code;
  const userId = await linkedUserId(ctx.from.id);
  if (!userId) {
    await ctx.reply(t(lang, 'status_unlinked'));
    return;
  }

  const db = serviceClient();
  const units = await userUnits(userId);

  // All of the user's runs (distance & duration); used for both longest run and
  // fastest pace, so one query covers both.
  const [runsResult, workoutsResult] = await Promise.all([
    db
      .from('runs')
      .select('distance_meters, duration_seconds')
      .eq('user_id', userId),
    db.from('workouts').select('id').eq('user_id', userId),
  ]);

  const runs = (runsResult.data ?? []) as {
    distance_meters: number;
    duration_seconds: number;
  }[];

  const lines: string[] = [];

  // Longest run — max distance_meters.
  if (runs.length > 0) {
    const longest = runs.reduce(
      (max, r) => Math.max(max, Number(r.distance_meters)),
      0,
    );
    const { value, unit } = metersToDisplayDistance(longest, units);
    lines.push(`🏃 Longest run: ${value.toFixed(2)} ${unit}`);
  }

  // Fastest pace — min seconds-per-meter over runs with positive distance.
  const paced = runs
    .filter((r) => Number(r.distance_meters) > 0)
    .map((r) => ({
      meters: Number(r.distance_meters),
      secs: Number(r.duration_seconds),
      spm: Number(r.duration_seconds) / Number(r.distance_meters),
    }));
  if (paced.length > 0) {
    const fastest = paced.reduce((best, r) => (r.spm < best.spm ? r : best));
    const pace = formatPace(paceSecondsPerUnit(fastest.meters, fastest.secs, units));
    lines.push(`⚡ Fastest pace: ${pace} /${units}`);
  }

  // Top set — most reps in any workout_set. workout_sets has no user_id; access
  // is via the parent workout, so filter by the user's workout ids.
  const workoutIds = ((workoutsResult.data ?? []) as { id: string }[]).map((w) => w.id);
  if (workoutIds.length > 0) {
    const { data: setRows } = await db
      .from('workout_sets')
      .select('reps')
      .in('workout_id', workoutIds)
      .order('reps', { ascending: false })
      .limit(1);
    const topReps = ((setRows ?? []) as { reps: number }[])[0]?.reps;
    if (topReps != null) {
      lines.push(`🏋 Top set: ${topReps} reps`);
    }
  }

  if (lines.length === 0) {
    await ctx.reply(t(lang, 'records_none'));
    return;
  }

  await ctx.reply(['🏅 Records', ...lines].join('\n'));
}

/**
 * /me — a one-line profile summary: handle + unit preference, lifetime counts of
 * runs/workouts/habit check-ins, and lifetime points. Points are summed from the
 * canonical score_events ledger (all of the user's events) — the same source of
 * truth as routes/score.ts's lifetimeScore. Counts use exact head requests so we
 * never pull the rows themselves.
 */
export async function handleMe(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const lang = ctx.from.language_code;
  const userId = await linkedUserId(ctx.from.id);
  if (!userId) {
    await ctx.reply(t(lang, 'status_unlinked'));
    return;
  }

  const db = serviceClient();
  const [profileResult, runsCount, workoutsCount, habitCount, events] = await Promise.all([
    db.from('profiles').select('handle, units').eq('id', userId).maybeSingle(),
    db.from('runs').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('workouts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('habit_checks').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('score_events').select('points').eq('user_id', userId),
  ]);

  const profile = profileResult.data as { handle: string | null; units: string | null } | null;
  const handle = profile?.handle ?? 'you';
  const units = profile?.units ?? 'km';

  const runs = runsCount.count ?? 0;
  const workouts = workoutsCount.count ?? 0;
  const habits = habitCount.count ?? 0;

  const points = ((events.data ?? []) as { points: number }[]).reduce(
    (sum, row) => sum + Number(row.points ?? 0),
    0,
  );

  const he = langOf(lang) === 'he';
  const runLabel = he ? 'ריצות' : runs === 1 ? 'run' : 'runs';
  const workoutLabel = he ? 'אימונים' : workouts === 1 ? 'workout' : 'workouts';
  const habitLabel = he ? 'סימוני הרגלים' : habits === 1 ? 'habit check-in' : 'habit check-ins';
  const ptsLabel = he ? 'נקודות לכל החיים' : 'lifetime points';
  const unitsLabel = he ? 'יחידות' : 'units';

  const reply =
    `👤 @${handle} · ${unitsLabel}: ${units}\n` +
    `🏃 ${runs} ${runLabel} · 🏋 ${workouts} ${workoutLabel} · ✅ ${habits} ${habitLabel}\n` +
    `⭐ ${points} ${ptsLabel}`;
  await ctx.reply(reply);
}
