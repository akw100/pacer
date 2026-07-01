import type { ReactNode } from 'react';
import { Bike, Dumbbell, MoreHorizontal, Sparkles, Waves } from 'lucide-react';
import { WORKOUT_KINDS, type WorkoutKind, type WorkoutKindCounts } from '@pacer/shared';

// "Who leads each workout kind this week." Real leaders only — computed
// straight from the `workout_kind_counts` field added to the friends /
// group leaderboard rows in PR #100. If a kind has no logged workouts
// across the row set, its chip honestly says "No leader yet"; if every
// kind is empty across every row, the whole strip is hidden so the
// page doesn't carry a card whose entire content is placeholder.
//
// Score / distance / runs / workouts leaders are intentionally NOT
// duplicated here — those are already available at-a-glance via the
// metric toggle on FriendsStandingCard (Home) and LeaderboardCard
// (Group Detail). This component's job is the new value PR #100
// unlocked: per-kind winners.

/** Subset of row fields the strip needs. Both FriendLeaderboardRow and
 *  the group LeaderboardRow satisfy this shape, so the same component
 *  works on Home and Group Detail without a shared row schema. */
export interface WorkoutKindLeadersRow {
  user_id: string;
  display_name: string;
  avatar_emoji?: string | null;
  workout_kind_counts?: WorkoutKindCounts;
}

interface WorkoutKindLeadersProps {
  rows: WorkoutKindLeadersRow[];
  callerId: string | null;
  /** Small caption under the header, e.g. "Among your friends this week"
   *  on Home or "In this group this week" on Group Detail. */
  scope: string;
}

interface KindMeta {
  label: string;
  icon: ReactNode;
  color: string;
}

const KIND_META: Record<WorkoutKind, KindMeta> = {
  strength: { label: 'Strength', icon: <Dumbbell size={14} strokeWidth={1.8} />, color: 'var(--color-accent)' },
  mobility: { label: 'Mobility', icon: <Sparkles size={14} strokeWidth={1.8} />, color: 'var(--color-streak)' },
  swim:     { label: 'Swim',     icon: <Waves size={14} strokeWidth={1.8} />,    color: '#4F86F6' },
  bike:     { label: 'Bike',     icon: <Bike size={14} strokeWidth={1.8} />,     color: 'var(--color-success)' },
  other:    { label: 'Other',    icon: <MoreHorizontal size={14} strokeWidth={2} />, color: '#6C7A89' },
};

interface KindLeader {
  row: WorkoutKindLeadersRow;
  count: number;
}

/** Pick the row with the highest count for `kind`. Real data only; a
 *  tie between two members resolves to whichever appears first in the
 *  input array (the callers already sort by score, so first-max-wins
 *  favors the higher-scoring member). Returns null if no row has a
 *  non-zero count for that kind. */
function findLeader(kind: WorkoutKind, rows: WorkoutKindLeadersRow[]): KindLeader | null {
  let best: KindLeader | null = null;
  for (const row of rows) {
    const count = row.workout_kind_counts?.[kind] ?? 0;
    if (count > 0 && (best === null || count > best.count)) {
      best = { row, count };
    }
  }
  return best;
}

export function WorkoutKindLeaders({ rows, callerId, scope }: WorkoutKindLeadersProps) {
  // Honest empty-strip check: no `workout_kind_counts` anywhere with any
  // non-zero value ⇒ nothing to show. Handles the "loading", "no
  // friends / no members", "everyone has zero workouts", and "backend
  // hasn't rolled the new field yet" cases in one branch.
  const anyActivity = rows.some(
    (r) =>
      r.workout_kind_counts != null &&
      WORKOUT_KINDS.some((k) => (r.workout_kind_counts![k] ?? 0) > 0),
  );
  if (!anyActivity) return null;

  return (
    <section
      aria-labelledby="workout-kind-leaders-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-3"
    >
      <header className="flex flex-col gap-0.5">
        <h2
          id="workout-kind-leaders-heading"
          className="font-display text-lg font-semibold text-ink"
        >
          Workout kind leaders
        </h2>
        <p className="text-xs text-ink-muted">{scope}</p>
      </header>

      <ul role="list" className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {WORKOUT_KINDS.map((kind) => (
          <KindChip
            key={kind}
            kind={kind}
            leader={findLeader(kind, rows)}
            callerId={callerId}
          />
        ))}
      </ul>
    </section>
  );
}

function KindChip({
  kind,
  leader,
  callerId,
}: {
  kind: WorkoutKind;
  leader: KindLeader | null;
  callerId: string | null;
}) {
  const meta = KIND_META[kind];
  const isYou = leader != null && leader.row.user_id === callerId;

  return (
    <li className="rounded-card border border-border bg-panel p-3 flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="grid place-items-center w-6 h-6 rounded-pill shrink-0"
          style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
        >
          {meta.icon}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-ink-muted font-semibold">
          {meta.label}
        </span>
      </div>

      {leader ? (
        <div className="flex items-baseline justify-between gap-1 min-w-0">
          <span
            className={`text-sm truncate ${
              isYou ? 'text-accent font-semibold' : 'text-ink font-medium'
            }`}
          >
            {isYou ? 'You' : leader.row.display_name}
          </span>
          <span className="text-xs text-ink-muted tabular-nums shrink-0">
            {leader.count}
          </span>
        </div>
      ) : (
        <div className="text-xs text-ink-muted">No leader yet</div>
      )}
    </li>
  );
}
