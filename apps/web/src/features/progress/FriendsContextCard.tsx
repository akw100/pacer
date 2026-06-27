import { Link } from 'react-router';
import { ChevronRight, Trophy, UserPlus, Users } from 'lucide-react';
import { metersToDisplayDistance, type Units } from '@pacer/shared';
import { useAuth } from '../auth/AuthProvider';
import { useFriendsLeaderboard } from '../friends/useFriends';

// Friends comparison card inside the Trends tab. Shows the caller's
// current-week numbers next to the average of their accepted friends.
//
// All values come from the existing /friends/leaderboard endpoint via
// `useFriendsLeaderboard()`. The caller is included in the API response;
// we filter them out before computing the "Friends avg" column. No
// history/range — the endpoint is current-week only by contract. Every
// empty/error state is honest, sourced from real data only.

interface FriendsContextCardProps {
  /** Display unit for distance. Defaults to km, matching TrendsSection's
   *  current default. */
  units?: Units;
}

interface ComparisonRow {
  label: string;
  you: string;
  avg: string;
}

export function FriendsContextCard({ units = 'km' }: FriendsContextCardProps) {
  const { session } = useAuth();
  const callerId = session?.user.id ?? null;
  const lb = useFriendsLeaderboard();

  if (lb.isLoading) {
    return (
      <Shell>
        <div className="space-y-2">
          <div className="h-4 w-2/3 rounded bg-ink/5 animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-ink/5 animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-ink/5 animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-ink/5 animate-pulse" />
        </div>
      </Shell>
    );
  }

  if (lb.isError) {
    return (
      <Shell>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-ink-muted">Couldn't load friends comparison.</span>
          <button
            type="button"
            onClick={() => lb.refetch()}
            className="rounded-pill border border-border bg-surface px-3 py-1 text-xs font-medium text-ink hover:bg-ink/5"
          >
            Retry
          </button>
        </div>
      </Shell>
    );
  }

  const data = lb.data;
  if (!data) return null;

  const friends = data.leaderboard.filter((r) => r.user_id !== callerId);
  const you = data.leaderboard.find((r) => r.user_id === callerId) ?? null;

  if (friends.length === 0) {
    return <EmptyState />;
  }

  const friendCount = friends.length;
  const friendsAvg = computeAverage(friends);
  // `you_vs_friends.rank` is positive int OR null per the schema. We only
  // render the rank chip when it's a real number — never a placeholder.
  const rank = data.you_vs_friends.rank;
  const total = friendCount + 1;
  const hasOwnActivity = !!you && (you.score > 0 || you.distance_meters > 0 || you.runs > 0 || you.workouts > 0);

  const rows: ComparisonRow[] = [
    {
      label: 'Distance',
      you: you ? formatDistance(you.distance_meters, units) : '—',
      avg: formatDistance(friendsAvg.distance_meters, units),
    },
    {
      label: 'Runs',
      you: you ? String(you.runs) : '—',
      avg: friendsAvg.runs.toFixed(1),
    },
    {
      label: 'Workouts',
      you: you ? String(you.workouts) : '—',
      avg: friendsAvg.workouts.toFixed(1),
    },
    {
      label: 'Score',
      you: you ? `${you.score} pts` : '—',
      avg: `${friendsAvg.score.toFixed(0)} pts`,
    },
  ];

  return (
    <Shell>
      <header className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-ink">
          <Users size={14} strokeWidth={1.8} className="text-accent" />
          <h3 className="font-display text-base font-semibold">Your week vs friends</h3>
        </div>
        {rank != null && (
          <span className="inline-flex items-center gap-1 rounded-pill bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
            <Trophy size={11} strokeWidth={2.2} />#{rank} of {total}
          </span>
        )}
      </header>

      <p className="text-xs text-ink-muted">
        Active with <span className="font-semibold text-ink">{friendCount}</span>{' '}
        {friendCount === 1 ? 'friend' : 'friends'} this week
      </p>

      {!hasOwnActivity && (
        <p className="text-xs text-ink-muted leading-snug">
          Log a run or workout this week to see your comparison.
        </p>
      )}

      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 items-baseline text-sm">
        <span aria-hidden="true" />
        <span className="text-xs uppercase tracking-wide text-ink-muted text-right">You</span>
        <span className="text-xs uppercase tracking-wide text-ink-muted text-right">
          Friends avg
        </span>
        {rows.map((row) => (
          <Row key={row.label} {...row} />
        ))}
      </div>
    </Shell>
  );
}

function Row({ label, you, avg }: ComparisonRow) {
  return (
    <>
      <span className="text-ink-muted">{label}</span>
      <span className="text-right font-display font-semibold text-ink tabular-nums">{you}</span>
      <span className="text-right text-ink tabular-nums">{avg}</span>
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-labelledby="friends-context-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-3"
    >
      <h2 id="friends-context-heading" className="sr-only">
        Friends context
      </h2>
      {children}
    </section>
  );
}

function EmptyState() {
  return (
    <section
      aria-labelledby="friends-context-empty-heading"
      className="rounded-card border border-dashed border-border bg-surface p-5 shadow-sm flex flex-col gap-3"
    >
      <span className="grid place-items-center w-10 h-10 rounded-pill bg-accent/10 text-accent">
        <UserPlus size={18} strokeWidth={1.8} />
      </span>
      <h2
        id="friends-context-empty-heading"
        className="font-display text-base font-semibold text-ink"
      >
        Compare your week with friends
      </h2>
      <p className="text-sm text-ink-muted leading-relaxed">
        Add a few accepted friends in your Profile to see how your week stacks up.
      </p>
      <Link
        to="/profile"
        className="self-start inline-flex items-center gap-1 rounded-pill bg-accent text-white px-3 py-1.5 text-xs font-semibold shadow-sm shadow-accent/20"
      >
        Add friends
        <ChevronRight size={11} strokeWidth={2.2} />
      </Link>
    </section>
  );
}

// ── Pure helpers ───────────────────────────────────────────────────────────

interface Aggregate {
  distance_meters: number;
  runs: number;
  workouts: number;
  score: number;
}

function computeAverage(
  rows: Array<{ distance_meters: number; runs: number; workouts: number; score: number }>,
): Aggregate {
  if (rows.length === 0) {
    return { distance_meters: 0, runs: 0, workouts: 0, score: 0 };
  }
  let dist = 0;
  let runs = 0;
  let workouts = 0;
  let score = 0;
  for (const r of rows) {
    dist += r.distance_meters;
    runs += r.runs;
    workouts += r.workouts;
    score += r.score;
  }
  const n = rows.length;
  return {
    distance_meters: dist / n,
    runs: runs / n,
    workouts: workouts / n,
    score: score / n,
  };
}

function formatDistance(meters: number, units: Units): string {
  const d = metersToDisplayDistance(meters, units);
  return `${d.value.toFixed(1)} ${units}`;
}
