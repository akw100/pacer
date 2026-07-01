import { useMemo } from 'react';
import { subDays } from 'date-fns';
import { toDateKey, type Workout } from '@pacer/shared';
import { useWorkouts } from '../logging/useLogging';

// Home dashboard — workout mix over the last 30 days. Real workout kinds
// only ('strength' / 'mobility' / 'swim' / 'bike' / 'other'); unknown
// values from older data get bucketed under 'other'. When the user has
// logged zero workouts in the window, we render an honest empty state
// with no bars — not five zero-track shells pretending to be a chart.

const KINDS = ['strength', 'mobility', 'swim', 'bike', 'other'] as const;
type Kind = (typeof KINDS)[number];

const KIND_LABEL: Record<Kind, string> = {
  strength: 'Strength',
  mobility: 'Mobility',
  swim: 'Swim',
  bike: 'Bike',
  other: 'Other',
};

const DAYS_BACK = 30;

interface Summary {
  counts: Record<Kind, number>;
  total: number;
  windowStart: string;
}

export function WorkoutKindBreakdown() {
  const workouts = useWorkouts();
  const { counts, total, windowStart } = useMemo<Summary>(
    () => summarize(workouts.data ?? []),
    [workouts.data],
  );
  const maxCount = Math.max(0, ...KINDS.map((k) => counts[k]));

  if (workouts.isLoading && !workouts.data) return <Skeleton />;

  return (
    <section
      aria-labelledby="workout-kinds-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-4"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 id="workout-kinds-heading" className="font-display text-lg font-semibold text-ink">
          Workout mix
        </h2>
        <span className="text-xs text-ink-muted tabular-nums">
          Last 30 days · {total} {total === 1 ? 'workout' : 'workouts'}
        </span>
      </header>

      {total === 0 ? (
        <p className="text-sm text-ink-muted text-center py-6">
          Log a workout to see your type mix.
        </p>
      ) : (
        <ul role="list" className="flex flex-col gap-2" aria-label={`Workout mix since ${windowStart}`}>
          {KINDS.map((k) => {
            const count = counts[k];
            const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
            return (
              <li
                key={k}
                className="flex items-center gap-3"
                aria-label={`${KIND_LABEL[k]}: ${count} ${count === 1 ? 'workout' : 'workouts'}`}
              >
                <span className="text-xs font-medium text-ink w-16 shrink-0">{KIND_LABEL[k]}</span>
                <div className="flex-1 h-2 rounded-pill bg-ink/5 overflow-hidden">
                  <div
                    className="h-full rounded-pill bg-accent transition-[width] duration-500"
                    style={{ width: `${pct}%` }}
                    aria-hidden="true"
                  />
                </div>
                <span className="text-xs font-medium text-ink tabular-nums w-10 text-right">
                  {count}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function summarize(workouts: Workout[]): Summary {
  const cutoffKey = toDateKey(subDays(new Date(), DAYS_BACK - 1));
  const counts: Record<Kind, number> = {
    strength: 0,
    mobility: 0,
    swim: 0,
    bike: 0,
    other: 0,
  };
  let total = 0;
  for (const w of workouts) {
    if (w.workout_date < cutoffKey) continue;
    const k = (KINDS as readonly string[]).includes(w.kind) ? (w.kind as Kind) : 'other';
    counts[k]++;
    total++;
  }
  return { counts, total, windowStart: cutoffKey };
}

function Skeleton() {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-sm">
      <div className="h-5 w-32 rounded bg-ink/10 animate-pulse" />
      <div className="mt-4 flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 rounded bg-ink/5 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
