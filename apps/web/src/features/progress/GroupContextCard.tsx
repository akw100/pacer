import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Trophy, Users } from 'lucide-react';
import { metersToDisplayDistance, type Units } from '@pacer/shared';
import { useAuth } from '../auth/AuthProvider';
import { useGroupStats, useMyGroups, type LeaderboardRow } from '../groups/useGroups';

// Group comparison card inside the Trends tab. Shows the caller's
// current-week numbers next to the average of the selected group's other
// members.
//
// All values come from the existing /groups and /groups/:id/stats endpoints
// via `useMyGroups()` + `useGroupStats(id)`. The caller is included in the
// API leaderboard; we filter them out before averaging so "Group avg" is
// peers-only. Every empty / loading / error state is honest, sourced from
// real data only.

interface GroupContextCardProps {
  /** Display unit for distance. Defaults to km, matching the rest of the
   *  Trends right-rail cards. */
  units?: Units;
}

interface ComparisonRow {
  label: string;
  you: string;
  avg: string;
}

export function GroupContextCard({ units = 'km' }: GroupContextCardProps) {
  const { session } = useAuth();
  const callerId = session?.user.id ?? null;

  const groups = useMyGroups();
  const groupsList = groups.data ?? [];

  // Selection: default to the first group; keep selection stable across
  // refetches; fall back if the selected group disappears (the user left it,
  // or it was deleted).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (groupsList.length === 0) {
      setSelectedId(null);
      return;
    }
    const stillExists = selectedId && groupsList.some((g) => g.id === selectedId);
    if (!stillExists) setSelectedId(groupsList[0]!.id);
  }, [groupsList, selectedId]);

  // Don't fire /groups/:id/stats until we have a real id.
  const stats = useGroupStats(selectedId);

  // ── Loading & error states ────────────────────────────────────────────

  if (groups.isLoading) {
    return (
      <Shell>
        <Skeleton />
      </Shell>
    );
  }

  if (groups.isError) {
    return (
      <Shell>
        <ErrorRow onRetry={() => groups.refetch()} message="Couldn't load your groups." />
      </Shell>
    );
  }

  if (groupsList.length === 0) {
    return <EmptyState />;
  }

  const selectedGroup = groupsList.find((g) => g.id === selectedId) ?? groupsList[0]!;

  if (stats.isLoading || !stats.data) {
    return (
      <Shell>
        <Header
          groupName={selectedGroup.name}
          groups={groupsList}
          selectedId={selectedGroup.id}
          onChange={setSelectedId}
        />
        <Skeleton />
      </Shell>
    );
  }

  if (stats.isError) {
    return (
      <Shell>
        <Header
          groupName={selectedGroup.name}
          groups={groupsList}
          selectedId={selectedGroup.id}
          onChange={setSelectedId}
        />
        <ErrorRow
          onRetry={() => stats.refetch()}
          message="Couldn't load this group's stats."
        />
      </Shell>
    );
  }

  // ── Comparison ───────────────────────────────────────────────────────

  const board = stats.data.leaderboard;
  const peers = board.filter((r) => r.user_id !== callerId);
  const you = board.find((r) => r.user_id === callerId) ?? null;
  const groupAvg = computeAverage(peers);

  // Rank chip only rendered when the API returns a real positive int.
  const rank = stats.data.you_vs_group.rank;
  const total = board.length;

  const hasOwnActivity =
    !!you && (you.score > 0 || you.distance_meters > 0 || you.runs > 0 || you.workouts > 0);

  const rows: ComparisonRow[] = [
    {
      label: 'Distance',
      you: you ? formatDistance(you.distance_meters, units) : '—',
      avg: formatDistance(groupAvg.distance_meters, units),
    },
    {
      label: 'Runs',
      you: you ? String(you.runs) : '—',
      avg: groupAvg.runs.toFixed(1),
    },
    {
      label: 'Workouts',
      you: you ? String(you.workouts) : '—',
      avg: groupAvg.workouts.toFixed(1),
    },
    {
      label: 'Score',
      you: you ? `${you.score} pts` : '—',
      avg: `${groupAvg.score.toFixed(0)} pts`,
    },
  ];

  return (
    <Shell>
      <Header
        groupName={selectedGroup.name}
        groups={groupsList}
        selectedId={selectedGroup.id}
        onChange={setSelectedId}
        rank={rank ?? undefined}
        total={total}
      />

      {peers.length === 0 ? (
        <p className="text-xs text-ink-muted leading-snug">
          You're the only one in this group so far. Invite a friend to start comparing.
        </p>
      ) : (
        <>
          {!hasOwnActivity && (
            <p className="text-xs text-ink-muted leading-snug">
              Tag a run or workout to <span className="font-semibold">{selectedGroup.name}</span>{' '}
              to see your comparison.
            </p>
          )}

          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 items-baseline text-sm">
            <span aria-hidden="true" />
            <span className="text-xs uppercase tracking-wide text-ink-muted text-right">You</span>
            <span className="text-xs uppercase tracking-wide text-ink-muted text-right">
              Group avg
            </span>
            {rows.map((row) => (
              <Row key={row.label} {...row} />
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

interface HeaderProps {
  groupName: string;
  groups: ReadonlyArray<{ id: string; name: string }>;
  selectedId: string;
  onChange: (id: string) => void;
  rank?: number;
  total?: number;
}

function Header({ groupName, groups, selectedId, onChange, rank, total }: HeaderProps) {
  const multiple = groups.length > 1;
  return (
    <header className="flex items-center justify-between gap-3 flex-wrap">
      <div className="inline-flex items-center gap-2 text-ink min-w-0">
        <Users size={14} strokeWidth={1.8} className="text-accent shrink-0" />
        <h3 className="font-display text-base font-semibold truncate">
          Your week vs <span className="text-accent">{groupName}</span>
        </h3>
      </div>
      <div className="flex items-center gap-2">
        {rank != null && total != null && (
          <span className="inline-flex items-center gap-1 rounded-pill bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
            <Trophy size={11} strokeWidth={2.2} />#{rank} of {total}
          </span>
        )}
        {multiple && (
          <label className="text-xs">
            <span className="sr-only">Select group</span>
            <select
              value={selectedId}
              onChange={(e) => onChange(e.target.value)}
              className="rounded-pill border border-border bg-surface px-2.5 py-1 text-xs text-ink hover:bg-ink/5 focus:outline-none focus:border-accent"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </header>
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
      aria-labelledby="group-context-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-3"
    >
      <h2 id="group-context-heading" className="sr-only">
        Group context
      </h2>
      {children}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      <div className="h-4 w-2/3 rounded bg-ink/5 animate-pulse" />
      <div className="h-4 w-3/4 rounded bg-ink/5 animate-pulse" />
      <div className="h-4 w-1/2 rounded bg-ink/5 animate-pulse" />
      <div className="h-4 w-2/3 rounded bg-ink/5 animate-pulse" />
    </div>
  );
}

function ErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-ink-muted">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-pill border border-border bg-surface px-3 py-1 text-xs font-medium text-ink hover:bg-ink/5"
      >
        Retry
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <section
      aria-labelledby="group-context-empty-heading"
      className="rounded-card border border-dashed border-border bg-surface p-5 shadow-sm flex flex-col gap-3"
    >
      <span className="grid place-items-center w-10 h-10 rounded-pill bg-accent/10 text-accent">
        <Users size={18} strokeWidth={1.8} />
      </span>
      <h2
        id="group-context-empty-heading"
        className="font-display text-base font-semibold text-ink"
      >
        Compare your week with a group
      </h2>
      <p className="text-sm text-ink-muted leading-relaxed">
        Create a group with family or friends, or join one with a code. Your tagged runs and
        workouts will appear here next to the group average.
      </p>
      <Link
        to="/group"
        className="self-start inline-flex items-center gap-1 rounded-pill bg-accent text-white px-3 py-1.5 text-xs font-semibold shadow-sm shadow-accent/20"
      >
        Create or join
        <ChevronRight size={11} strokeWidth={2.2} />
      </Link>
    </section>
  );
}

// ── Pure helpers ───────────────────────────────────────────────────────

interface Aggregate {
  distance_meters: number;
  runs: number;
  workouts: number;
  score: number;
}

function computeAverage(rows: LeaderboardRow[]): Aggregate {
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
