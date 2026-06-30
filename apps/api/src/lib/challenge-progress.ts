import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChallengeLeaderRow, ChallengeMetric } from '@pacer/shared';

// Server-side challenge progress. Computed with the SERVICE client because a
// challenge spans many users' rows; the route handler verifies the caller may
// see the challenge FIRST (can_see_challenge) and only then calls in here.
//
// Progress counts ALL of a participant's logged activity inside the window
// [start_date, end_date] — distance/runs/reps/workouts/habit-days/score derive
// from their own tables; `check_in` is the self-report counter we store. We
// never re-derive the points formula here for `score`: that metric reads the
// score_events ledger directly (the single source of truth written at log time).

export interface ParticipantSeed {
  user_id: string;
  status: ChallengeLeaderRow['status'];
  display_name: string;
  handle: string;
  avatar_emoji: string | null;
}

export interface ChallengeForProgress {
  id: string;
  metric: ChallengeMetric;
  start_date: string;
  end_date: string;
}

/**
 * Build the per-participant leaderboard for one challenge, sorted by progress
 * desc (then handle for a stable order). Declined participants are excluded;
 * invited-but-unanswered participants are kept so the recipient sees the
 * pending challenge with their (likely zero) progress.
 */
export async function computeChallengeProgress(
  db: SupabaseClient,
  challenge: ChallengeForProgress,
  participants: ParticipantSeed[],
): Promise<ChallengeLeaderRow[]> {
  const active = participants.filter((p) => p.status !== 'declined');
  const ids = active.map((p) => p.user_id);
  const progress = new Map<string, number>();
  for (const id of ids) progress.set(id, 0);

  if (ids.length > 0) {
    await accumulate(db, challenge, ids, progress);
  }

  const rows: ChallengeLeaderRow[] = active.map((p) => ({
    user_id: p.user_id,
    display_name: p.display_name,
    handle: p.handle,
    avatar_emoji: p.avatar_emoji,
    status: p.status,
    progress: progress.get(p.user_id) ?? 0,
  }));

  rows.sort((a, b) => b.progress - a.progress || a.handle.localeCompare(b.handle));
  return rows;
}

// ── Pure aggregation helpers (unit-tested independently of the DB) ────────────

/** Sum `valueOf(row)` per user_id. */
export function sumByUser<T extends { user_id: string }>(
  rows: T[],
  valueOf: (r: T) => number,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.user_id, (m.get(r.user_id) ?? 0) + valueOf(r));
  return m;
}

/** Count rows per user_id. */
export function countByUser<T extends { user_id: string }>(rows: T[]): Map<string, number> {
  return sumByUser(rows, () => 1);
}

/** Count DISTINCT `keyOf(row)` values per user_id (e.g. distinct habit days). */
export function distinctCountByUser<T extends { user_id: string }>(
  rows: T[],
  keyOf: (r: T) => string,
): Map<string, number> {
  const sets = new Map<string, Set<string>>();
  for (const r of rows) {
    let s = sets.get(r.user_id);
    if (!s) sets.set(r.user_id, (s = new Set()));
    s.add(keyOf(r));
  }
  const m = new Map<string, number>();
  for (const [u, s] of sets) m.set(u, s.size);
  return m;
}

async function accumulate(
  db: SupabaseClient,
  challenge: ChallengeForProgress,
  ids: string[],
  progress: Map<string, number>,
): Promise<void> {
  const { metric, start_date, end_date } = challenge;
  const merge = (m: Map<string, number>) => {
    for (const [userId, n] of m) progress.set(userId, (progress.get(userId) ?? 0) + n);
  };

  switch (metric) {
    case 'distance': {
      const { data } = await db
        .from('runs')
        .select('user_id, distance_meters')
        .in('user_id', ids)
        .gte('run_date', start_date)
        .lte('run_date', end_date);
      merge(sumByUser((data ?? []) as { user_id: string; distance_meters: number | string }[], (r) => Number(r.distance_meters)));
      return;
    }
    case 'run_count': {
      const { data } = await db
        .from('runs')
        .select('user_id')
        .in('user_id', ids)
        .gte('run_date', start_date)
        .lte('run_date', end_date);
      merge(countByUser((data ?? []) as { user_id: string }[]));
      return;
    }
    case 'workout_count': {
      const { data } = await db
        .from('workouts')
        .select('user_id')
        .in('user_id', ids)
        .gte('workout_date', start_date)
        .lte('workout_date', end_date);
      merge(countByUser((data ?? []) as { user_id: string }[]));
      return;
    }
    case 'reps': {
      // workout_sets has no user_id — resolve the owner + window via workouts,
      // then sum sets*reps across the sets of those workouts.
      const { data: workouts } = await db
        .from('workouts')
        .select('id, user_id')
        .in('user_id', ids)
        .gte('workout_date', start_date)
        .lte('workout_date', end_date);
      const ownerByWorkout = new Map<string, string>();
      for (const w of (workouts ?? []) as { id: string; user_id: string }[]) ownerByWorkout.set(w.id, w.user_id);
      const workoutIds = [...ownerByWorkout.keys()];
      if (workoutIds.length === 0) return;
      const { data: sets } = await db
        .from('workout_sets')
        .select('workout_id, sets, reps')
        .in('workout_id', workoutIds);
      // Re-key sets onto their owner, then reuse the shared per-user sum.
      const owned = ((sets ?? []) as { workout_id: string; sets: number; reps: number }[])
        .map((s) => ({ user_id: ownerByWorkout.get(s.workout_id) ?? '', sets: s.sets, reps: s.reps }))
        .filter((s) => s.user_id);
      merge(sumByUser(owned, (s) => s.sets * s.reps));
      return;
    }
    case 'habit_days': {
      const { data } = await db
        .from('habit_checks')
        .select('user_id, check_date')
        .in('user_id', ids)
        .gte('check_date', start_date)
        .lte('check_date', end_date);
      merge(distinctCountByUser((data ?? []) as { user_id: string; check_date: string }[], (h) => h.check_date));
      return;
    }
    case 'score': {
      const { data } = await db
        .from('score_events')
        .select('user_id, points')
        .in('user_id', ids)
        .gte('event_date', start_date)
        .lte('event_date', end_date);
      merge(sumByUser((data ?? []) as { user_id: string; points: number }[], (e) => e.points));
      return;
    }
    case 'check_in': {
      const { data } = await db
        .from('challenge_check_ins')
        .select('user_id')
        .eq('challenge_id', challenge.id);
      merge(countByUser((data ?? []) as { user_id: string }[]));
      return;
    }
  }
}
