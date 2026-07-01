import { useState } from 'react';
import { metersToDisplayDistance, type Units } from '@pacer/shared';
import type { GroupStats, LeaderboardRow } from './useGroups';

type Metric = 'score' | 'km' | 'runs';

interface LeaderboardCardProps {
  stats: GroupStats | undefined;
  loading: boolean;
  youUserId: string | null;
  units: Units;
}

// v1 visual pass — the ordered list is now a horizontal bar chart: each row
// keeps its identity (rank + avatar + name + value) and gains a proportional
// bar-fill background sized against the max metric value across the FULL
// leaderboard. Truncated top-9 + "you" if you rank outside so the caller can
// always spot themselves in the chart. Empty-state copy is unchanged.
const VISIBLE_ROWS = 10;

export function LeaderboardCard({ stats, loading, youUserId, units }: LeaderboardCardProps) {
  const [metric, setMetric] = useState<Metric>('score');

  if (loading) return <Skeleton />;
  if (!stats) return null;

  const sorted = sortByMetric(stats.leaderboard, metric);
  const withRank = sorted.map((r, i) => ({ ...r, rank: i + 1 }));

  // Always keep "you" visible in the chart: if the caller ranks outside the
  // top-N, drop the last visible row and pin the caller's row at the bottom.
  const topN = withRank.slice(0, VISIBLE_ROWS);
  const youInTop = youUserId != null && topN.some((r) => r.user_id === youUserId);
  const youOutsideRow =
    youUserId != null && !youInTop ? withRank.find((r) => r.user_id === youUserId) : undefined;
  const display =
    youOutsideRow != null ? [...topN.slice(0, VISIBLE_ROWS - 1), youOutsideRow] : topN;

  // Scale the bars against the FULL leaderboard's max — not just what's
  // visible — so the gap between you and the leader stays honest.
  const maxValue = Math.max(0, ...withRank.map((r) => valueOf(r, metric)));

  return (
    <section
      aria-labelledby="leaderboard-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-4"
    >
      <header className="flex items-center justify-between gap-3">
        <h2 id="leaderboard-heading" className="font-display text-lg font-semibold text-ink">
          Weekly leaderboard
        </h2>
        <MetricToggle metric={metric} onChange={setMetric} />
      </header>

      {sorted.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No activity tagged to this group yet. Log a run and pick this group to start the board.
        </p>
      ) : (
        <ol role="list" className="flex flex-col gap-1.5">
          {display.map((row) => (
            <Row
              key={row.user_id}
              row={row}
              rank={row.rank}
              you={row.user_id === youUserId}
              metric={metric}
              units={units}
              maxValue={maxValue}
            />
          ))}
          {youOutsideRow && (
            <p
              className="text-[11px] text-ink-muted text-center mt-1"
              aria-live="polite"
            >
              Rows {VISIBLE_ROWS}–{withRank.length - 1} hidden — your row is pinned so you can find yourself.
            </p>
          )}
        </ol>
      )}
    </section>
  );
}

function valueOf(row: LeaderboardRow, metric: Metric): number {
  return row[metricKey(metric)];
}

function sortByMetric(rows: LeaderboardRow[], metric: Metric): LeaderboardRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const av = a[metricKey(metric)];
    const bv = b[metricKey(metric)];
    return bv - av || b.distance_meters - a.distance_meters;
  });
  return copy;
}

function metricKey(metric: Metric): 'score' | 'distance_meters' | 'runs' {
  return metric === 'km' ? 'distance_meters' : metric === 'runs' ? 'runs' : 'score';
}

function metricLabel(row: LeaderboardRow, metric: Metric, units: Units): string {
  if (metric === 'score') return `${row.score}`;
  if (metric === 'runs') return `${row.runs}`;
  const { value, unit } = metersToDisplayDistance(row.distance_meters, units);
  return `${value.toFixed(1)} ${unit}`;
}

function metricUnit(metric: Metric, units: Units): string {
  if (metric === 'score') return 'pts';
  if (metric === 'runs') return 'runs';
  return units;
}

function Row({
  row,
  rank,
  you,
  metric,
  units,
  maxValue,
}: {
  row: LeaderboardRow;
  rank: number;
  you: boolean;
  metric: Metric;
  units: Units;
  maxValue: number;
}) {
  const value = valueOf(row, metric);
  const pct = maxValue > 0 ? Math.min(100, (value / maxValue) * 100) : 0;
  return (
    <li
      className={`relative flex items-center gap-3 rounded-card border px-3 py-2 overflow-hidden ${
        you ? 'border-accent/40' : 'border-border'
      }`}
      aria-label={`Rank ${rank}, ${you ? 'You' : row.display_name}, ${metricLabel(row, metric, units)} ${metricUnit(metric, units)}`}
    >
      {/* Proportional bar-fill background. Honest: value 0 renders nothing. */}
      <div
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 transition-[width] duration-500 ${
          you ? 'bg-accent/15' : 'bg-ink/5'
        }`}
        style={{ width: `${pct}%` }}
      />
      <span
        aria-hidden="true"
        className={`relative z-10 grid place-items-center w-7 h-7 rounded-pill text-xs font-bold ${
          rank === 1 ? 'bg-streak/15 text-streak' : 'bg-ink/5 text-ink-muted'
        }`}
      >
        {rank}
      </span>
      <span aria-hidden="true" className="relative z-10 text-base leading-none">
        {row.avatar_emoji ?? '🏃'}
      </span>
      <div className="relative z-10 flex-1 min-w-0">
        <div className={`text-sm truncate ${you ? 'font-semibold text-ink' : 'text-ink'}`}>
          {you ? 'You' : row.display_name}
        </div>
        <div className="text-xs text-ink-muted truncate">@{row.handle}</div>
      </div>
      <span className="relative z-10 font-display text-base font-bold text-ink tabular-nums">
        {metricLabel(row, metric, units)}
        <span className="text-xs text-ink-muted font-medium ml-1">{metricUnit(metric, units)}</span>
      </span>
    </li>
  );
}

function MetricToggle({ metric, onChange }: { metric: Metric; onChange: (m: Metric) => void }) {
  const options: Array<{ id: Metric; label: string }> = [
    { id: 'score', label: 'Score' },
    { id: 'km', label: 'Distance' },
    { id: 'runs', label: 'Runs' },
  ];
  return (
    <div role="radiogroup" aria-label="Leaderboard metric" className="inline-flex rounded-pill border border-border bg-surface p-0.5">
      {options.map((o) => {
        const active = metric === o.id;
        return (
          <button
            key={o.id}
            role="radio"
            aria-checked={active}
            type="button"
            onClick={() => onChange(o.id)}
            className={`rounded-pill px-2.5 py-0.5 text-xs font-medium transition-colors ${
              active ? 'bg-ink text-surface' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-sm">
      <div className="h-5 w-32 rounded bg-ink/10 animate-pulse" />
      <div className="mt-4 flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 rounded-card bg-ink/5 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
