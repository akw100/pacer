import { Hono } from 'hono';
import {
  PlatformStatsResponseSchema,
  metersToKm,
  paceSecondsPerUnit,
  streakLength,
  toDateKey,
  type PlatformCommunity,
  type PlatformPercentiles,
  type PlatformStats,
} from '@pacer/shared';
import { startOfWeek, endOfWeek, subDays } from 'date-fns';
import type { AppEnv } from '../lib/auth';
import { serviceClient } from '../lib/supabase';
import { readCachedCommunity, writeCachedCommunity } from '../lib/platform-stats-cache';

// GET /stats/platform
//
// Anonymous platform-wide community block + the caller's own percentiles.
// Privacy rule (card 08, hard requirement): the response carries ONLY numbers
// and a week-start string — no user_id, handle, or per-user rows ever leave
// this handler. We cross-aggregate with the SERVICE-ROLE client (the per-
// request user client would be limited by RLS) and we never JOIN to profiles
// in the output path.
//
// Community block is cached ~5 min (in `lib/platform-stats-cache.ts`).
// Caller percentiles are computed fresh per request — they're cheap and per-user.

// Card 08 specifies weeks for the community block; we use ISO weeks (Monday
// start) regardless of the caller's profile preference so the platform number
// is consistent for everyone. Personal Trends still uses the caller's
// week_start elsewhere.
const WEEK_STARTS_ON = 1 as const;

export const platformStats = new Hono<AppEnv>().get('/', async (c) => {
  const userId = c.get('userId');
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });
  const end = endOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });
  const weekStartIso = toDateKey(start);
  const todayIso = toDateKey(now);

  const community = await getOrComputeCommunity(weekStartIso, todayIso, start, end);
  const you = await computePercentiles(userId, weekStartIso, end);

  const payload: PlatformStats = { community, you, weekStartIso };

  // Boundary validation. Doubles as the privacy guard — the schema doesn't
  // allow any identity fields, so a refactor that smuggles one in breaks
  // here at run-time instead of leaking silently.
  const parsed = PlatformStatsResponseSchema.safeParse(payload);
  if (!parsed.success) {
    return c.json({ error: 'response shape invalid', details: parsed.error.flatten() }, 500);
  }
  return c.json(parsed.data);
});

// ── Community (cached ~5 min, anonymous) ───────────────────────────────────

async function getOrComputeCommunity(
  weekStartIso: string,
  todayIso: string,
  weekStart: Date,
  weekEnd: Date,
): Promise<PlatformCommunity> {
  const cached = readCachedCommunity(weekStartIso);
  if (cached) return cached;

  const db = serviceClient();
  const weekStartKey = toDateKey(weekStart);
  const weekEndKey = toDateKey(weekEnd);

  // Pull only the columns we need; no joins to profiles. This is anonymous
  // aggregation — even though it goes through the service client, we never
  // pull names.
  const { data: weekRuns } = await db
    .from('runs')
    .select('distance_meters, duration_seconds, run_date')
    .gte('run_date', weekStartKey)
    .lte('run_date', weekEndKey);

  const runsToday = await countRunsToday(db, todayIso);

  // habit_checks may not exist yet in some projects (the habits slice owns
  // the table). If the query fails because the table is missing, fall back
  // to 0 — the card UI hides the habits clause when count == 0.
  let habitsCheckedToday = 0;
  try {
    const { count } = await db
      .from('habit_checks')
      .select('id', { count: 'exact', head: true })
      .eq('check_date', todayIso);
    habitsCheckedToday = count ?? 0;
  } catch {
    habitsCheckedToday = 0;
  }

  type RunRow = { distance_meters: number | string; duration_seconds: number; run_date: string };
  const rows = (weekRuns ?? []) as RunRow[];

  let totalMeters = 0;
  let totalSeconds = 0;
  for (const r of rows) {
    const m = Number(r.distance_meters);
    if (Number.isFinite(m) && m > 0) totalMeters += m;
    if (Number.isFinite(r.duration_seconds) && r.duration_seconds > 0)
      totalSeconds += r.duration_seconds;
  }
  const weekKm = metersToKm(totalMeters);
  const avgPaceSecondsPerKm =
    totalMeters > 0 ? paceSecondsPerUnit(totalMeters, totalSeconds, 'km') : null;

  // Popular weekday + hour over a 90-day rolling window so the answer reflects
  // recent behaviour, not the platform's birth distribution.
  const ninetyAgo = toDateKey(subDays(weekEnd, 90));
  const { data: recentRuns } = await db
    .from('runs')
    .select('run_date, created_at')
    .gte('run_date', ninetyAgo);

  const weekdayCounts = new Array<number>(7).fill(0);
  const hourCounts = new Array<number>(24).fill(0);
  for (const r of (recentRuns ?? []) as { run_date: string; created_at: string }[]) {
    const day = parseDateKey(r.run_date);
    if (day) {
      const wd = day.getDay(); // 0 = Sunday in JS Date
      weekdayCounts[wd]! += 1;
    }
    const t = new Date(r.created_at);
    if (!Number.isNaN(t.getTime())) {
      hourCounts[t.getHours()]! += 1;
    }
  }
  const popularRunWeekday = argmax(weekdayCounts);
  const popularRunHour = argmax(hourCounts);

  const community: PlatformCommunity = {
    weekKm: round1(weekKm),
    runsToday,
    habitsCheckedToday,
    popularRunWeekday,
    popularRunHour,
    avgPaceSecondsPerKm: avgPaceSecondsPerKm != null ? Math.round(avgPaceSecondsPerKm) : null,
  };

  writeCachedCommunity(weekStartIso, community);
  return community;
}

async function countRunsToday(db: ReturnType<typeof serviceClient>, todayIso: string): Promise<number> {
  const { count } = await db
    .from('runs')
    .select('id', { count: 'exact', head: true })
    .eq('run_date', todayIso);
  return count ?? 0;
}

// ── Caller percentiles (fresh, per request) ────────────────────────────────

async function computePercentiles(
  userId: string,
  weekStartIso: string,
  weekEnd: Date,
): Promise<PlatformPercentiles> {
  const db = serviceClient();
  const weekEndKey = toDateKey(weekEnd);

  // Per-user totals for the current week. We bucket on the server side rather
  // than asking Postgres to GROUP BY — keeps the SQL minimal and side-steps
  // the missing GROUP BY support in PostgREST.
  const { data: weekRuns } = await db
    .from('runs')
    .select('user_id, distance_meters')
    .gte('run_date', weekStartIso)
    .lte('run_date', weekEndKey);

  const perUserMeters = new Map<string, number>();
  for (const r of (weekRuns ?? []) as { user_id: string; distance_meters: number | string }[]) {
    const m = Number(r.distance_meters);
    if (!Number.isFinite(m) || m <= 0) continue;
    perUserMeters.set(r.user_id, (perUserMeters.get(r.user_id) ?? 0) + m);
  }
  const distancePercentile = percentileOf(perUserMeters, userId);

  // score_events.event_date within the week.
  let scorePercentile: number | null = null;
  try {
    const { data: weekScores } = await db
      .from('score_events')
      .select('user_id, points')
      .gte('event_date', weekStartIso)
      .lte('event_date', weekEndKey);
    const perUserScore = new Map<string, number>();
    for (const r of (weekScores ?? []) as { user_id: string; points: number }[]) {
      const p = Number(r.points);
      if (!Number.isFinite(p)) continue;
      perUserScore.set(r.user_id, (perUserScore.get(r.user_id) ?? 0) + p);
    }
    scorePercentile = percentileOf(perUserScore, userId);
  } catch {
    scorePercentile = null;
  }

  // Streaks across ALL users — fetched lazily because this is the most
  // expensive part. Pull the last ~60 days of run_date + habit_check date per
  // user; the shared `streakLength` runs over that set.
  const sixtyAgo = toDateKey(subDays(weekEnd, 60));
  const { data: recentRuns } = await db
    .from('runs')
    .select('user_id, run_date')
    .gte('run_date', sixtyAgo);

  let recentHabits: { user_id: string; check_date: string }[] = [];
  try {
    const { data } = await db
      .from('habit_checks')
      .select('user_id, check_date')
      .gte('check_date', sixtyAgo);
    recentHabits = (data ?? []) as { user_id: string; check_date: string }[];
  } catch {
    recentHabits = [];
  }

  const datesByUser = new Map<string, Set<string>>();
  for (const r of (recentRuns ?? []) as { user_id: string; run_date: string }[]) {
    const set = datesByUser.get(r.user_id) ?? new Set<string>();
    set.add(r.run_date);
    datesByUser.set(r.user_id, set);
  }
  for (const h of recentHabits) {
    const set = datesByUser.get(h.user_id) ?? new Set<string>();
    set.add(h.check_date);
    datesByUser.set(h.user_id, set);
  }

  const perUserStreak = new Map<string, number>();
  for (const [uid, dates] of datesByUser) {
    perUserStreak.set(uid, streakLength([...dates]));
  }
  const streakPercentile = perUserStreak.size > 0 ? percentileOf(perUserStreak, userId) : null;

  return { distancePercentile, scorePercentile, streakPercentile };
}

// ── Pure helpers ───────────────────────────────────────────────────────────

/**
 * Standard percentile rank — the share of users with a strictly LOWER value,
 * scaled to 0-100 and rounded. Null if the caller isn't in the distribution
 * or the distribution is empty (so the UI hides that line).
 */
function percentileOf(byUser: Map<string, number>, userId: string): number | null {
  if (byUser.size === 0) return null;
  const mine = byUser.get(userId);
  if (mine == null || mine <= 0) return null;
  let below = 0;
  for (const v of byUser.values()) {
    if (v < mine) below++;
  }
  return Math.round((below / byUser.size) * 100);
}

function argmax(arr: number[]): number | null {
  let best = -1;
  let bestIdx = -1;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]! > best) {
      best = arr[i]!;
      bestIdx = i;
    }
  }
  return best > 0 ? bestIdx : null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const [, y, mo, d] = m;
  if (!y || !mo || !d) return null;
  return new Date(Number(y), Number(mo) - 1, Number(d));
}
