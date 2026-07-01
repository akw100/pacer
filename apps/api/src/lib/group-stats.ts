import type { SupabaseClient } from '@supabase/supabase-js';
import {
  emptyWorkoutKindCounts,
  scoreFor,
  WORKOUT_KINDS,
  type WorkoutKind,
  type WorkoutKindCounts,
} from '@pacer/shared';

// Server-side group leaderboard + totals. Computed with the SERVICE client
// because we need to sum across other members' rows; the route handler does
// the membership check FIRST and refuses to call us for non-members.
//
// The leaderboard model is: an activity counts for a group only if the user
// explicitly tagged it with `shared_group_id = <group id>` at log time. This
// is the additive group-share contract from migration 0003. Personal stats
// and the personal score are unaffected and live in their own queries.

export type LeaderboardMetric = 'score' | 'km' | 'runs';

export interface LeaderboardRow {
  user_id: string;
  display_name: string;
  handle: string;
  avatar_emoji: string | null;
  score: number;
  distance_meters: number;
  runs: number;
  workouts: number;
  /**
   * Weekly per-kind breakdown of the same workouts that make up `workouts`.
   * ONLY counts workouts tagged to this group (shared_group_id = groupId) —
   * personal untagged workouts are never counted here, same rule the top-
   * level `workouts` field already follows.
   */
  workout_kind_counts?: WorkoutKindCounts;
}

export interface GroupTotals {
  /** Total distance across all shared runs this week, in meters. */
  week_distance_meters: number;
  week_runs: number;
  week_workouts: number;
  week_score: number;
}

export interface YouVsGroup {
  you: LeaderboardRow | null;
  /** Distance/score/runs averaged across non-you members. Null if no peers yet. */
  avg_distance_meters: number;
  avg_score: number;
  avg_runs: number;
  /** Gap to first place (positive if you're behind). 0 if you're #1. */
  score_gap_to_first: number;
  rank: number | null;
}

export interface GroupStatsResponse {
  group_id: string;
  week_start: string; // yyyy-MM-dd
  week_end: string;
  leaderboard: LeaderboardRow[];
  totals: GroupTotals;
  you_vs_group: YouVsGroup;
}

/**
 * Build the week's leaderboard for a single group. Includes every current
 * member, even ones who haven't shared anything yet (zero row), so the UI
 * always renders the full roster.
 */
export async function computeGroupStats(
  db: SupabaseClient,
  groupId: string,
  viewerUserId: string,
  weekStart: string,
  weekEnd: string,
): Promise<GroupStatsResponse> {
  // 1) Members + their profile bits — drives the row order.
  const { data: members } = await db
    .from('group_members')
    .select('user_id, profiles!inner(display_name, handle, avatar_emoji)')
    .eq('group_id', groupId);

  type MemberRow = {
    user_id: string;
    profiles: { display_name: string; handle: string; avatar_emoji: string | null };
  };
  const memberRows = (members ?? []) as unknown as MemberRow[];

  // 2) Group-shared runs + workouts inside the week.
  const { data: runs } = await db
    .from('runs')
    .select('user_id, distance_meters, run_date')
    .eq('shared_group_id', groupId)
    .gte('run_date', weekStart)
    .lte('run_date', weekEnd);

  // `kind` is projected alongside user_id so we can derive
  // workout_kind_counts in the same aggregation pass. The
  // shared_group_id filter is preserved unchanged — kind counts are a
  // breakdown of the same workouts already gated by group tagging, so
  // untagged personal workouts still cannot enter the group leaderboard.
  const { data: workouts } = await db
    .from('workouts')
    .select('user_id, workout_date, kind')
    .eq('shared_group_id', groupId)
    .gte('workout_date', weekStart)
    .lte('workout_date', weekEnd);

  // 3) Aggregate per member. Score is derived via scoreFor() so we never
  //    duplicate the formula — same source of truth as the personal score.
  const rows = new Map<string, LeaderboardRow>();
  for (const m of memberRows) {
    rows.set(m.user_id, {
      user_id: m.user_id,
      display_name: m.profiles.display_name,
      handle: m.profiles.handle,
      avatar_emoji: m.profiles.avatar_emoji,
      score: 0,
      distance_meters: 0,
      runs: 0,
      workouts: 0,
      workout_kind_counts: emptyWorkoutKindCounts(),
    });
  }

  type RunAgg = { user_id: string; distance_meters: number | string };
  type WorkoutAgg = { user_id: string; kind: string };
  for (const r of (runs ?? []) as RunAgg[]) {
    const row = rows.get(r.user_id);
    if (!row) continue;
    const m = Number(r.distance_meters);
    row.distance_meters += m;
    row.runs += 1;
    row.score += scoreFor({ reason: 'run', distanceMeters: m });
  }
  for (const w of (workouts ?? []) as WorkoutAgg[]) {
    const row = rows.get(w.user_id);
    if (!row) continue;
    row.workouts += 1;
    row.score += scoreFor({ reason: 'workout' });
    // DB CHECK guarantees kind is one of WORKOUT_KINDS; defensive guard
    // silently drops any unexpected value (backfill / future migration)
    // rather than misclassify it under 'other'.
    if (row.workout_kind_counts && (WORKOUT_KINDS as readonly string[]).includes(w.kind)) {
      row.workout_kind_counts[w.kind as WorkoutKind] += 1;
    }
  }

  // 4) Sort leaderboard by score desc, then by distance desc as a tiebreaker.
  const leaderboard = [...rows.values()].sort(
    (a, b) => b.score - a.score || b.distance_meters - a.distance_meters,
  );

  const totals: GroupTotals = leaderboard.reduce(
    (acc, r) => ({
      week_distance_meters: acc.week_distance_meters + r.distance_meters,
      week_runs: acc.week_runs + r.runs,
      week_workouts: acc.week_workouts + r.workouts,
      week_score: acc.week_score + r.score,
    }),
    { week_distance_meters: 0, week_runs: 0, week_workouts: 0, week_score: 0 },
  );

  const you = leaderboard.find((r) => r.user_id === viewerUserId) ?? null;
  const others = leaderboard.filter((r) => r.user_id !== viewerUserId);
  const peerCount = others.length || 1;
  const avg_distance_meters = others.reduce((s, r) => s + r.distance_meters, 0) / peerCount;
  const avg_score = others.reduce((s, r) => s + r.score, 0) / peerCount;
  const avg_runs = others.reduce((s, r) => s + r.runs, 0) / peerCount;
  const first = leaderboard[0];
  const score_gap_to_first = you && first ? Math.max(0, first.score - you.score) : 0;
  const rank = you ? leaderboard.indexOf(you) + 1 : null;

  return {
    group_id: groupId,
    week_start: weekStart,
    week_end: weekEnd,
    leaderboard,
    totals,
    you_vs_group: { you, avg_distance_meters, avg_score, avg_runs, score_gap_to_first, rank },
  };
}

export interface GroupFeedItem {
  id: string;
  kind: 'run' | 'workout';
  user_id: string;
  display_name: string;
  handle: string;
  avatar_emoji: string | null;
  occurred_on: string; // yyyy-MM-dd
  created_at: string;
  // Run-specific
  distance_meters?: number;
  duration_seconds?: number;
  // Workout-specific
  name?: string;
  workout_kind?: string;
  // Reactions on this activity, grouped by emoji
  reactions: Array<{ emoji: string; count: number; reacted_by_me: boolean }>;
}

const REACTION_EMOJIS = ['👏', '🔥', '💪'] as const;

/**
 * Build the group feed: each member's group-shared runs/workouts within the
 * window, newest first, with reaction counts pre-aggregated so the client
 * doesn't fan out N requests.
 */
export async function computeGroupFeed(
  db: SupabaseClient,
  groupId: string,
  viewerUserId: string,
  limit = 30,
): Promise<GroupFeedItem[]> {
  const { data: members } = await db
    .from('group_members')
    .select('user_id, profiles!inner(display_name, handle, avatar_emoji)')
    .eq('group_id', groupId);
  type Profile = { display_name: string; handle: string; avatar_emoji: string | null };
  type MemberRow = { user_id: string; profiles: Profile };
  const profileByUser = new Map<string, Profile>();
  for (const m of (members ?? []) as unknown as MemberRow[]) {
    profileByUser.set(m.user_id, m.profiles);
  }

  const { data: runs } = await db
    .from('runs')
    .select('id, user_id, run_date, distance_meters, duration_seconds, created_at')
    .eq('shared_group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit);

  const { data: workouts } = await db
    .from('workouts')
    .select('id, user_id, workout_date, name, kind, created_at')
    .eq('shared_group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit);

  type RunRow = {
    id: string; user_id: string; run_date: string;
    distance_meters: number | string; duration_seconds: number; created_at: string;
  };
  type WorkoutRow = {
    id: string; user_id: string; workout_date: string;
    name: string; kind: string; created_at: string;
  };

  const items: GroupFeedItem[] = [];
  for (const r of (runs ?? []) as RunRow[]) {
    const p = profileByUser.get(r.user_id);
    if (!p) continue;
    items.push({
      id: r.id, kind: 'run',
      user_id: r.user_id, display_name: p.display_name, handle: p.handle, avatar_emoji: p.avatar_emoji,
      occurred_on: r.run_date, created_at: r.created_at,
      distance_meters: Number(r.distance_meters),
      duration_seconds: r.duration_seconds,
      reactions: [],
    });
  }
  for (const w of (workouts ?? []) as WorkoutRow[]) {
    const p = profileByUser.get(w.user_id);
    if (!p) continue;
    items.push({
      id: w.id, kind: 'workout',
      user_id: w.user_id, display_name: p.display_name, handle: p.handle, avatar_emoji: p.avatar_emoji,
      occurred_on: w.workout_date, created_at: w.created_at,
      name: w.name, workout_kind: w.kind,
      reactions: [],
    });
  }

  items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const trimmed = items.slice(0, limit);

  // One reaction roundtrip — grouped per (target_type, target_id, emoji).
  if (trimmed.length > 0) {
    const runIds = trimmed.filter((i) => i.kind === 'run').map((i) => i.id);
    const workoutIds = trimmed.filter((i) => i.kind === 'workout').map((i) => i.id);

    type ReactionRow = {
      user_id: string; target_type: 'run' | 'workout' | 'habit_day';
      target_id: string; emoji: string;
    };
    let reactions: ReactionRow[] = [];
    if (runIds.length || workoutIds.length) {
      const orParts: string[] = [];
      if (runIds.length) orParts.push(`and(target_type.eq.run,target_id.in.(${runIds.join(',')}))`);
      if (workoutIds.length)
        orParts.push(`and(target_type.eq.workout,target_id.in.(${workoutIds.join(',')}))`);
      const { data } = await db.from('reactions').select('user_id, target_type, target_id, emoji').or(orParts.join(','));
      reactions = (data ?? []) as ReactionRow[];
    }

    // Aggregate per (target, emoji).
    const counts = new Map<string, Map<string, { count: number; mine: boolean }>>();
    for (const r of reactions) {
      const key = `${r.target_type}:${r.target_id}`;
      let perEmoji = counts.get(key);
      if (!perEmoji) {
        perEmoji = new Map();
        counts.set(key, perEmoji);
      }
      const cur = perEmoji.get(r.emoji) ?? { count: 0, mine: false };
      cur.count += 1;
      if (r.user_id === viewerUserId) cur.mine = true;
      perEmoji.set(r.emoji, cur);
    }

    for (const item of trimmed) {
      const key = `${item.kind}:${item.id}`;
      const perEmoji = counts.get(key) ?? new Map<string, { count: number; mine: boolean }>();
      item.reactions = REACTION_EMOJIS.map((emoji) => {
        const v = perEmoji.get(emoji);
        return { emoji, count: v?.count ?? 0, reacted_by_me: v?.mine ?? false };
      });
    }
  } else {
    for (const item of trimmed) {
      item.reactions = REACTION_EMOJIS.map((emoji) => ({ emoji, count: 0, reacted_by_me: false }));
    }
  }

  return trimmed;
}
