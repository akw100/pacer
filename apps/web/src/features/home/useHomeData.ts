import { useQuery } from '@tanstack/react-query';
import {
  metersToDisplayDistance,
  toDateKey,
  weekRange,
  type Run,
  type Units,
  type WeekStart,
  type Workout,
} from '@pacer/shared';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { useProfile } from '../auth/useProfile';
import { useMyGroups, type GroupListItem, type GroupStats } from '../groups/useGroups';
import {
  greetingFor,
  type GroupPulse,
  type HabitItem,
  type HomeSnapshot,
  type PlannedActivity,
  type RecentActivityItem,
  type WeekProgress,
} from './home.mock';

// Aggregator hook for the Home dashboard. Pulls live data from the existing
// API surface — /profile/me, /score/summary, /habits, /runs, /workouts,
// /groups, /groups/:id/stats, /groups/:id/feed — and derives the shape the
// UI cards consume. NO mock literals anywhere in user-visible data.
//
// Every query is `enabled: !!token` so we don't fire on the sign-in screen.
// Empty/loading/error states are handled per-card: the dashboard renders the
// shell immediately and each card decides what to show with whatever it has.

interface ScoreSummary {
  weeklyScore: number;
  lifetimeScore: number;
  streak: number;
}

interface HabitApi {
  id: string;
  userId: string;
  name: string;
  emoji: string;
  sort: number;
  createdAt: string;
}

function useToken(): string | null {
  return useAuth().session?.access_token ?? null;
}

function useScoreSummary() {
  const token = useToken();
  return useQuery<ScoreSummary>({
    queryKey: ['score', 'summary'],
    queryFn: () => apiFetch<ScoreSummary>('/score/summary', { token: token! }),
    enabled: !!token,
    staleTime: 30 * 1000,
  });
}

function useHabits() {
  const token = useToken();
  return useQuery<HabitApi[]>({
    queryKey: ['habits'],
    queryFn: () => apiFetch<HabitApi[]>('/habits', { token: token! }),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

function useRuns() {
  const token = useToken();
  return useQuery<Run[]>({
    queryKey: ['runs'],
    queryFn: () => apiFetch<Run[]>('/runs', { token: token! }),
    enabled: !!token,
  });
}

function useWorkouts() {
  const token = useToken();
  return useQuery<Workout[]>({
    queryKey: ['workouts'],
    queryFn: () => apiFetch<Workout[]>('/workouts', { token: token! }),
    enabled: !!token,
  });
}

function useGroupStats(groupId: string | null) {
  const token = useToken();
  return useQuery<GroupStats>({
    queryKey: ['groups', 'stats', groupId ?? ''],
    queryFn: () => apiFetch<GroupStats>(`/groups/${groupId}/stats`, { token: token! }),
    enabled: !!token && !!groupId,
  });
}

interface FeedItem {
  id: string;
  kind: 'run' | 'workout';
  user_id: string;
  display_name: string;
  occurred_on: string;
  created_at: string;
  distance_meters?: number;
  duration_seconds?: number;
  name?: string;
  workout_kind?: string;
  reactions: Array<{ emoji: string; count: number; reacted_by_me: boolean }>;
}

function useGroupFeed(groupId: string | null) {
  const token = useToken();
  return useQuery<FeedItem[]>({
    queryKey: ['groups', 'feed', groupId ?? ''],
    queryFn: () => apiFetch<FeedItem[]>(`/groups/${groupId}/feed`, { token: token! }),
    enabled: !!token && !!groupId,
  });
}

export interface HomeData {
  /** Composed snapshot — null when the user has no profile yet. */
  snapshot: HomeSnapshot | null;
  /** True while the first round of queries is still in flight. */
  isLoading: boolean;
  /** True only if profile or score fail — the other queries degrade gracefully. */
  isError: boolean;
  /** The top group (highest weekly score among the user's groups), or null. */
  topGroup: GroupListItem | null;
  /** Whether the user belongs to any group at all. */
  hasAnyGroup: boolean;
}

/**
 * Top-level hook. Returns a single derived HomeSnapshot built from live data.
 * Any source that isn't live yet (e.g. no plans table) returns an honest
 * empty/null on its slice — the cards know how to render that.
 */
export function useHomeData(): HomeData {
  const { profile } = useProfile();
  const score = useScoreSummary();
  const habits = useHabits();
  const runs = useRuns();
  const workouts = useWorkouts();
  const myGroups = useMyGroups();

  // Top group = the one the user is currently ranked highest in. Without
  // stats per group we fall back to the first group; with stats we'll pick
  // the one where the user has the most points.
  const topGroupId = pickTopGroupId(myGroups.data ?? []);
  const topStats = useGroupStats(topGroupId);
  const topFeed = useGroupFeed(topGroupId);

  // The profile API currently returns raw DB rows with snake_case keys
  // (display_name, week_start) even though the shared zod schema declares
  // camelCase. We read defensively until that mapping is unified — out of
  // scope for this PR.
  const profileLoose = profile as unknown as
    | (Partial<{
        displayName: string;
        display_name: string;
        weekStart: 0 | 1;
        week_start: 0 | 1;
        units: Units;
        handle: string;
      }>)
    | null;
  const displayName = profileLoose?.displayName ?? profileLoose?.display_name ?? '';
  const handle = profileLoose?.handle ?? '';
  const units: Units = profileLoose?.units ?? 'km';
  const weekStart: WeekStart = (profileLoose?.weekStart ?? profileLoose?.week_start ?? 1) as WeekStart;

  const isLoading =
    score.isLoading || runs.isLoading || workouts.isLoading || habits.isLoading || myGroups.isLoading;
  const isError = score.isError;

  if (!profile) {
    return { snapshot: null, isLoading, isError, topGroup: null, hasAnyGroup: false };
  }

  const firstName = firstNameOf(displayName || handle);
  const week = computeWeekProgress(runs.data ?? [], workouts.data ?? [], weekStart, units);
  const todayPlanned = computeTodayPlanned(runs.data ?? [], workouts.data ?? []);
  const todayHabits = mapHabits(habits.data ?? []);
  const topGroup = (myGroups.data ?? []).find((g) => g.id === topGroupId) ?? null;
  const groupPulse = computeGroupPulse(topGroup, topStats.data);
  const recent = computeRecent(
    topFeed.data ?? null,
    runs.data ?? [],
    workouts.data ?? [],
    displayName || 'You',
  );

  const snapshot: HomeSnapshot = {
    user: {
      firstName,
      streakDays: score.data?.streak ?? 0,
      weeklyPoints: score.data?.weeklyScore ?? 0,
    },
    today: {
      planned: todayPlanned,
      habits: todayHabits,
    },
    week,
    group: groupPulse,
    recent,
  };

  return {
    snapshot,
    isLoading,
    isError,
    topGroup,
    hasAnyGroup: (myGroups.data ?? []).length > 0,
  };
}

// Re-export so existing component code keeps working without a path swap.
export { greetingFor };

// ── Pure helpers (no I/O) ──────────────────────────────────────────────────

function firstNameOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0]!;
}

function pickTopGroupId(groups: GroupListItem[]): string | null {
  if (groups.length === 0) return null;
  // Stable choice without per-group stats: the first group the API returned.
  // The API orders by joined_at so this is "your most recent membership".
  // When we have stats below we'd ideally pick "where you have most points
  // this week" — that requires N stats fetches; for now the simple choice
  // keeps the network footprint small.
  return groups[0]!.id;
}

function computeTodayPlanned(runs: Run[], workouts: Workout[]): PlannedActivity {
  const today = toDateKey(new Date());
  const ranToday = runs.some((r) => r.run_date === today);
  const workedOutToday = workouts.some((w) => w.workout_date === today);
  if (ranToday) return { kind: 'run', label: 'Run logged', done: true };
  if (workedOutToday) return { kind: 'workout', label: 'Workout logged', done: true };
  // No plans table on dev yet (running_plans/plan_runs aren't migrated). We
  // surface an honest "nothing scheduled" rather than inventing a target.
  return { kind: 'rest', label: 'Nothing logged yet today', done: false };
}

function mapHabits(rows: HabitApi[]): HabitItem[] {
  // We don't have a today-check endpoint exposed, so habits render as
  // "pending" — the Progress → Habits screen owns the live check toggling.
  // This is honest: it doesn't claim a habit is done when we don't know.
  return rows.map((h) => ({ id: h.id, name: h.name, status: 'pending' as const }));
}

function computeWeekProgress(
  runs: Run[],
  workouts: Workout[],
  weekStart: WeekStart,
  units: Units,
): WeekProgress {
  const now = new Date();
  const { start, end } = weekRange(now, weekStart);
  const startKey = toDateKey(start);
  const endKey = toDateKey(end);

  const weekRuns = runs.filter((r) => r.run_date >= startKey && r.run_date <= endKey);
  const weekWorkouts = workouts.filter(
    (w) => w.workout_date >= startKey && w.workout_date <= endKey,
  );

  const totalMeters = weekRuns.reduce((sum, r) => sum + Number(r.distance_meters), 0);
  const completedDistance = metersToDisplayDistance(totalMeters, units).value;

  // No plans yet → no goal, no scheduled-runs pills. We show what's real:
  // distance + counts, and leave goalDistance at 0 so the bar reads "0%".
  return {
    completedDistance: Number(completedDistance.toFixed(1)),
    goalDistance: 0,
    unit: units,
    runsRemaining: 0,
    scheduled: [
      ...weekRuns.map((r) => ({
        id: `run-${r.id}`,
        label: pillLabelForRun(r, units),
        status: 'done' as const,
      })),
      ...weekWorkouts.map((w) => ({
        id: `wo-${w.id}`,
        label: `${weekdayShort(w.workout_date)} · ${w.kind}`,
        status: 'done' as const,
      })),
    ],
  };
}

function pillLabelForRun(r: Run, units: Units): string {
  const { value, unit } = metersToDisplayDistance(Number(r.distance_meters), units);
  return `${weekdayShort(r.run_date)} · ${value.toFixed(1)} ${unit}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
function weekdayShort(dateKey: string): string {
  // dateKey is yyyy-MM-dd; parse in local TZ.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return WEEKDAYS[d.getDay()] ?? '';
}

function computeGroupPulse(
  group: GroupListItem | null,
  stats: GroupStats | undefined,
): GroupPulse {
  if (!group) {
    return { groupName: '', rows: [] };
  }
  if (!stats) {
    // Group exists but stats aren't loaded yet — keep the header truthful;
    // empty rows lets the card render an empty leaderboard.
    return { groupName: group.name, rows: [] };
  }
  // Top 3 of this week's leaderboard, with the viewer flagged.
  const top = stats.leaderboard.slice(0, 3).map((r) => ({
    id: r.user_id,
    name: r.display_name,
    points: r.score,
    isYou: r.user_id === stats.you_vs_group.you?.user_id,
  }));
  return { groupName: group.name, rows: top };
}

function computeRecent(
  feed: FeedItem[] | null,
  runs: Run[],
  workouts: Workout[],
  yourName: string,
): RecentActivityItem[] {
  // Prefer the group feed (richer — other members' activity with reactions).
  if (feed && feed.length > 0) {
    return feed.slice(0, 3).map((f) => ({
      id: `${f.kind}-${f.id}`,
      actorName: f.display_name,
      description: describeFeed(f),
      ago: relativeFrom(f.created_at),
      reactions: f.reactions.map((r) => ({
        emoji: r.emoji,
        label: emojiLabel(r.emoji),
        count: r.count,
      })),
    }));
  }
  // Fallback: the user's own latest runs + workouts.
  const personal: RecentActivityItem[] = [
    ...runs.slice(0, 3).map((r) => ({
      id: `run-${r.id}`,
      actorName: yourName,
      description: `logged a ${(Number(r.distance_meters) / 1000).toFixed(1)} km run`,
      ago: relativeFrom(r.created_at),
      reactions: [],
    })),
    ...workouts.slice(0, 3).map((w) => ({
      id: `wo-${w.id}`,
      actorName: yourName,
      description: `completed ${w.name}`,
      ago: relativeFrom(w.created_at),
      reactions: [],
    })),
  ];
  personal.sort((a, b) => (a.ago < b.ago ? -1 : 1));
  return personal.slice(0, 3);
}

function describeFeed(f: FeedItem): string {
  if (f.kind === 'run' && f.distance_meters) {
    const km = (Number(f.distance_meters) / 1000).toFixed(1);
    return `logged a ${km} km run`;
  }
  return `completed ${f.name ?? f.workout_kind ?? 'a workout'}`;
}

function emojiLabel(emoji: string): string {
  if (emoji === '👏') return 'Clap';
  if (emoji === '🔥') return 'Fire';
  if (emoji === '💪') return 'Strong';
  return emoji;
}

function relativeFrom(iso: string): string {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return '';
  const diffMs = Date.now() - created;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
