import { useMemo } from 'react';
import { subDays } from 'date-fns';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  scoreFor,
  toDateKey,
  weekRange,
  WEEK_START,
  type Run,
  type Workout,
} from '@pacer/shared';
import { useRuns, useWorkouts } from '../logging/useLogging';
import { useProfile } from '../auth/useProfile';

// Home dashboard — 4-week score trend derived CLIENT-SIDE from real runs
// and workouts using shared `scoreFor()`. Bar 4 is the current (in-progress)
// week; bars 1–3 are the three prior weeks. Weeks respect WEEK_START.
//
// Honest-scope caveat: this trend covers score from runs + workouts only.
// The API's /score/summary weekly number also counts habit checks, day
// bonuses, streak awards and race wins, which we don't have on the client.
// The header names the source ("From runs & workouts") so the number is
// never presented as the same figure the streak/points card shows.
//
// Empty weeks render as zero-height bars — never invented values.

const WEEKS = 4;

interface WeekDatum {
  key: string;
  label: string;
  score: number;
  startKey: string;
  endKey: string;
  isCurrent: boolean;
}

export function HomeScoreTrend() {
  const runs = useRuns();
  const workouts = useWorkouts();
  const { profile } = useProfile();
  const profileLoose = profile as unknown as
    | Partial<{ weekStart: 0 | 1; week_start: 0 | 1 }>
    | null;
  const weekStart = (profileLoose?.weekStart ?? profileLoose?.week_start ?? WEEK_START) as 0 | 1;

  const data = useMemo(
    () => buildWeeks(runs.data ?? [], workouts.data ?? [], weekStart),
    [runs.data, workouts.data, weekStart],
  );
  const totalScore = data.reduce((s, w) => s + w.score, 0);
  const hasActivity = totalScore > 0;

  if ((runs.isLoading && !runs.data) || (workouts.isLoading && !workouts.data)) {
    return <Skeleton />;
  }

  return (
    <section
      aria-labelledby="score-trend-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-4"
    >
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 id="score-trend-heading" className="font-display text-lg font-semibold text-ink">
            4-week score trend
          </h2>
          <p className="text-xs text-ink-muted">From runs &amp; workouts</p>
        </div>
        <span className="text-xs text-ink-muted tabular-nums">
          {hasActivity ? `${totalScore} pts across 4 weeks` : '0 pts across 4 weeks'}
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
                content={<WeekTooltip />}
              />
            )}
            <Bar
              dataKey="score"
              radius={[6, 6, 0, 0]}
              fill="var(--color-accent)"
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {!hasActivity && (
        <p className="text-xs text-ink-muted text-center">
          Log runs or workouts to start a trend.
        </p>
      )}
    </section>
  );
}

function buildWeeks(runs: Run[], workouts: Workout[], weekStart: 0 | 1): WeekDatum[] {
  const today = new Date();
  const weeks: WeekDatum[] = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const ref = subDays(today, i * 7);
    const { start, end } = weekRange(ref, weekStart);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);

    let score = 0;
    for (const r of runs) {
      if (r.run_date < startKey || r.run_date > endKey) continue;
      score += scoreFor({ reason: 'run', distanceMeters: Number(r.distance_meters) });
    }
    for (const w of workouts) {
      if (w.workout_date < startKey || w.workout_date > endKey) continue;
      score += scoreFor({ reason: 'workout' });
    }

    weeks.push({
      key: startKey,
      label: i === 0 ? 'This wk' : `${i}w ago`,
      score,
      startKey,
      endKey,
      isCurrent: i === 0,
    });
  }
  return weeks;
}

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{ payload: WeekDatum }>;
}

function WeekTooltip({ active, payload }: TooltipPayload) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]!.payload;
  return (
    <div className="rounded-card border border-border bg-panel px-2.5 py-1.5 text-xs shadow-sm">
      <div className="font-medium text-ink">{d.label}</div>
      <div className="text-ink-muted tabular-nums">{d.score} pts</div>
      <div className="text-[10px] text-ink-muted mt-0.5 tabular-nums">
        {d.startKey} → {d.endKey}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-sm">
      <div className="h-5 w-40 rounded bg-ink/10 animate-pulse" />
      <div className="mt-4 h-32 rounded-card bg-ink/5 animate-pulse" />
    </div>
  );
}
