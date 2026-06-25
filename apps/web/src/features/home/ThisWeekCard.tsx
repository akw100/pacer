import type { WeekProgress } from './home.mock';

interface ThisWeekCardProps {
  week: WeekProgress;
}

export function ThisWeekCard({ week }: ThisWeekCardProps) {
  const hasGoal = week.goalDistance > 0;
  const pct = hasGoal ? Math.min(100, (week.completedDistance / week.goalDistance) * 100) : 0;

  return (
    <section
      aria-labelledby="this-week-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-4"
    >
      <header className="flex items-center justify-between">
        <h2 id="this-week-heading" className="font-display text-lg font-semibold text-ink">
          This week
        </h2>
        <span className="text-xs text-ink-muted">
          {week.scheduled.length}{' '}
          {week.scheduled.length === 1 ? 'activity' : 'activities'}
        </span>
      </header>

      <div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-4xl font-bold text-ink leading-none">
            {week.completedDistance.toFixed(1)}
          </span>
          <span className="text-ink-muted font-medium">
            {hasGoal ? `/ ${week.goalDistance} ${week.unit}` : week.unit}
          </span>
        </div>
        <div className="mt-1 text-sm text-ink-muted">
          {hasGoal
            ? week.runsRemaining === 0
              ? 'Goal reached'
              : `${week.runsRemaining} run${week.runsRemaining === 1 ? '' : 's'} left`
            : 'Set a weekly goal in your plan to track progress.'}
        </div>
      </div>

      {hasGoal && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={week.goalDistance}
          aria-valuenow={Number(week.completedDistance.toFixed(1))}
          aria-valuetext={`${week.completedDistance.toFixed(1)} of ${week.goalDistance} ${week.unit}`}
          className="h-2 rounded-pill bg-border overflow-hidden"
        >
          <div
            className="h-full rounded-pill bg-accent transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {week.scheduled.length === 0 ? (
        <p className="text-xs text-ink-muted leading-relaxed">
          No runs or workouts logged this week yet.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2" role="list">
          {week.scheduled.map((run) => (
            <li key={run.id}>
              <span
                aria-label={`${run.label} (${run.status === 'done' ? 'completed' : 'upcoming'})`}
                className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-medium ${
                  run.status === 'done'
                    ? 'border-success/30 bg-success/10 text-success'
                    : 'border-accent/30 bg-accent/10 text-accent'
                }`}
              >
                <span aria-hidden="true">{run.status === 'done' ? '✓' : '•'}</span>
                <span>{run.label}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
