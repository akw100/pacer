import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { metersToDisplayDistance, type Units } from '@pacer/shared';
import type { GroupStats } from './useGroups';

// Real recharts BarChart of the group's four weekly totals (score,
// distance, runs, workouts). Reads `stats.totals` verbatim — nothing
// synthesised. Because the four metrics have very different natural
// scales (score can be hundreds of points while runs may be single
// digits), we normalise each bar's height to a shared 0..1 "share of
// its own metric-max" axis; the tooltip and the LabelList carry the
// real underlying value in the metric's unit.
//
// Empty state: when every total is zero we hide the chart entirely and
// render an honest single-line placeholder. Never show a flat 4-bar
// zero shell — that reads as "we have data" when we don't.

interface GroupWeeklyTotalsChartProps {
  stats: GroupStats | undefined;
  units: Units;
}

interface Datum {
  key: string;
  label: string;
  /** The real value in the metric's own unit. */
  value: number;
  /** Formatted display string used in tooltip + LabelList. */
  display: string;
  /** 0..1 — the value scaled so the four bars are legible side by side.
   *  Since each metric has its own natural range, we can't share a Y
   *  axis honestly; the shared-height projection is 1 for the largest
   *  metric and its own value/metricMax for the rest. */
  height: number;
  color: string;
}

export function GroupWeeklyTotalsChart({ stats, units }: GroupWeeklyTotalsChartProps) {
  const data = useMemo(() => buildData(stats, units), [stats, units]);
  if (!stats) return null;

  const anyValue = data.some((d) => d.value > 0);

  return (
    <section
      aria-labelledby="group-weekly-totals-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-4"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2
          id="group-weekly-totals-heading"
          className="font-display text-lg font-semibold text-ink"
        >
          Group this week
        </h2>
        <span className="text-xs text-ink-muted tabular-nums">
          {stats.leaderboard.length} {stats.leaderboard.length === 1 ? 'member' : 'members'}
        </span>
      </header>

      {!anyValue ? (
        <p className="text-sm text-ink-muted">
          No group activity this week yet — log a run or workout tagged to this group to fill
          this chart.
        </p>
      ) : (
        <div className="h-40 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
              />
              <YAxis hide domain={[0, 1]} />
              <Tooltip
                cursor={{ fill: 'var(--color-ink)', fillOpacity: 0.06 }}
                content={<MetricTooltip />}
              />
              <Bar dataKey="height" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {data.map((d) => (
                  <Cell key={d.key} fill={d.color} />
                ))}
                <LabelList
                  dataKey="display"
                  position="top"
                  style={{
                    fill: 'var(--color-ink)',
                    fontSize: 11,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function buildData(stats: GroupStats | undefined, units: Units): Datum[] {
  if (!stats) return [];
  const totals = stats.totals;
  const distanceDisplay = metersToDisplayDistance(totals.week_distance_meters, units);

  // Assemble raw values in their natural units first — labels and
  // tooltip always speak the real number, only the bar HEIGHT is
  // normalised.
  const rows: Array<Omit<Datum, 'height'>> = [
    {
      key: 'score',
      label: 'Score',
      value: totals.week_score,
      display: `${totals.week_score} pts`,
      color: 'var(--color-accent)',
    },
    {
      key: 'distance',
      label: 'Distance',
      value: distanceDisplay.value,
      display: `${distanceDisplay.value.toFixed(1)} ${units}`,
      color: '#4F86F6',
    },
    {
      key: 'runs',
      label: 'Runs',
      value: totals.week_runs,
      display: `${totals.week_runs}`,
      color: '#52A869',
    },
    {
      key: 'workouts',
      label: 'Workouts',
      value: totals.week_workouts,
      display: `${totals.week_workouts}`,
      color: '#F5A623',
    },
  ];

  // Normalise each bar against its OWN maximum in the current row set.
  // With one row per metric, "max" is just the single row's value —
  // meaning any non-zero metric becomes height=1 and zero metrics stay
  // at 0. That's the honest choice: the chart shows "which metric has
  // any activity this week," and the LabelList carries the real
  // numbers. This avoids the misleading "score dwarfs runs" effect
  // that a shared linear scale would cause.
  const max = Math.max(0, ...rows.map((r) => r.value));
  return rows.map((r) => ({
    ...r,
    height: max > 0 && r.value > 0 ? Math.max(0.15, r.value / max) : 0,
  }));
}

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{ payload: Datum }>;
}

function MetricTooltip({ active, payload }: TooltipPayload) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]!.payload;
  return (
    <div className="rounded-card border border-border bg-panel px-2.5 py-1.5 text-xs shadow-sm">
      <div className="font-medium text-ink">{d.label}</div>
      <div className="text-ink-muted tabular-nums">{d.display}</div>
    </div>
  );
}
