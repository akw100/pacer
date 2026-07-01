import { useMemo } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  metersToDisplayDistance,
  toDateKey,
  weekRange,
  WEEK_START,
  type Run,
  type Units,
} from '@pacer/shared';
import { useRuns } from '../logging/useLogging';
import { useProfile } from '../auth/useProfile';

// Home dashboard — 7-bar weekly activity mini chart. Reads real runs from
// /runs (via useRuns), buckets by day for the CURRENT week (respecting
// WEEK_START), and renders one bar per day. Zero-activity days render as
// zero-height bars — never invented values. Empty state (no logged runs
// this week at all) hides the chart and shows honest copy so the user is
// not staring at a flat baseline pretending to be a chart.

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

interface DayDatum {
  dateKey: string;
  label: string;
  /** Distance in the user's display unit (km or mi), rounded to 2dp. */
  distance: number;
  /** Raw meters — used to detect "has any activity" without float ambiguity. */
  meters: number;
}

export function WeeklyActivityChart() {
  const runs = useRuns();
  const { profile } = useProfile();
  // profile row may still be snake_case in flight (see useHomeData notes) —
  // read defensively and fall back to the app-wide WEEK_START constant.
  const profileLoose = profile as unknown as
    | Partial<{ units: Units; weekStart: 0 | 1; week_start: 0 | 1 }>
    | null;
  const units: Units = profileLoose?.units ?? 'km';
  const weekStart = (profileLoose?.weekStart ?? profileLoose?.week_start ?? WEEK_START) as 0 | 1;

  const data = useMemo(
    () => buildWeekData(runs.data ?? [], weekStart, units),
    [runs.data, weekStart, units],
  );
  const totalMeters = data.reduce((s, d) => s + d.meters, 0);
  const hasActivity = totalMeters > 0;

  if (runs.isLoading && !runs.data) return <Skeleton />;

  const totalDisplay = metersToDisplayDistance(totalMeters, units).value;

  return (
    <section
      aria-labelledby="weekly-activity-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-4"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 id="weekly-activity-heading" className="font-display text-lg font-semibold text-ink">
          Weekly activity
        </h2>
        <span className="text-xs text-ink-muted tabular-nums">
          {hasActivity
            ? `${totalDisplay.toFixed(1)} ${units} this week`
            : `0 ${units} this week`}
        </span>
      </header>

      <div className="h-32 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
            />
            <YAxis hide domain={[0, 'auto']} />
            {hasActivity && (
              <Tooltip
                cursor={{ fill: 'var(--color-ink)', opacity: 0.06 }}
                content={<DayTooltip units={units} />}
              />
            )}
            <Bar
              dataKey="distance"
              radius={[6, 6, 0, 0]}
              fill="var(--color-accent)"
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {!hasActivity && (
        <p className="text-xs text-ink-muted text-center">
          Log a run this week to fill this chart.
        </p>
      )}
    </section>
  );
}

function buildWeekData(runs: Run[], weekStart: 0 | 1, units: Units): DayDatum[] {
  const { start, end } = weekRange(new Date(), weekStart);
  const startKey = toDateKey(start);
  const endKey = toDateKey(end);

  const byDate = new Map<string, number>();
  for (const r of runs) {
    if (r.run_date < startKey || r.run_date > endKey) continue;
    byDate.set(r.run_date, (byDate.get(r.run_date) ?? 0) + Number(r.distance_meters));
  }

  const days: DayDatum[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < 7; i++) {
    const key = toDateKey(cursor);
    const meters = byDate.get(key) ?? 0;
    const display = metersToDisplayDistance(meters, units).value;
    days.push({
      dateKey: key,
      label: WEEKDAY_LABELS[cursor.getDay()]!,
      distance: Number(display.toFixed(2)),
      meters,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{ payload: DayDatum }>;
}

function DayTooltip({ active, payload, units }: TooltipPayload & { units: Units }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]!.payload;
  return (
    <div className="rounded-card border border-border bg-panel px-2.5 py-1.5 text-xs shadow-sm">
      <div className="font-medium text-ink">{d.label}</div>
      <div className="text-ink-muted tabular-nums">
        {d.distance.toFixed(1)} {units}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-sm">
      <div className="h-5 w-32 rounded bg-ink/10 animate-pulse" />
      <div className="mt-4 h-32 rounded-card bg-ink/5 animate-pulse" />
    </div>
  );
}
