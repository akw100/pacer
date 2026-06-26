import { CheckCircle2, Circle, Footprints, Dumbbell, Bed } from 'lucide-react';
import { openLogSheet } from '../logging/LogSheet';
import type { HabitItem, PlannedActivity } from './home.mock';

interface TodayCardProps {
  planned: PlannedActivity;
  habits: HabitItem[];
}

export function TodayCard({ planned, habits }: TodayCardProps) {
  const PlannedIcon =
    planned.kind === 'run' ? Footprints : planned.kind === 'workout' ? Dumbbell : Bed;

  return (
    <section
      aria-labelledby="today-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-4"
    >
      <header className="flex items-center justify-between">
        <h2 id="today-heading" className="font-display text-lg font-semibold text-ink">
          Today
        </h2>
        <span className="text-xs text-ink-muted">
          {planned.done ? 'Done' : 'Up next'}
        </span>
      </header>

      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid place-items-center w-11 h-11 rounded-pill bg-accent/10 text-accent shrink-0"
        >
          <PlannedIcon size={20} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-xl font-semibold text-ink truncate">
            {planned.label}
            {planned.distanceLabel && (
              <span className="text-ink-muted font-medium"> · {planned.distanceLabel}</span>
            )}
          </div>
          <div className="text-xs text-ink-muted">Planned activity</div>
        </div>
        <span
          aria-label={planned.done ? 'Completed' : 'Not completed'}
          className={planned.done ? 'text-success' : 'text-ink-muted'}
        >
          {planned.done ? (
            <CheckCircle2 size={26} strokeWidth={1.8} />
          ) : (
            <Circle size={26} strokeWidth={1.8} />
          )}
        </span>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-ink-muted mb-2">Habits</div>
        {habits.length === 0 ? (
          <p className="text-xs text-ink-muted leading-snug">
            Set up daily habits in Progress to track them here.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2" role="list">
            {habits.map((h) => (
              <HabitPill key={h.id} habit={h} />
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => openLogSheet()}
        className="rounded-pill bg-accent text-white py-3 text-sm font-semibold shadow-sm shadow-accent/20 active:scale-[0.98] transition-transform"
      >
        Log activity
      </button>
    </section>
  );
}

function HabitPill({ habit }: { habit: HabitItem }) {
  const done = habit.status === 'done';
  return (
    <li>
      <span
        aria-label={`${habit.name}: ${done ? 'done' : 'not done'}`}
        className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-medium ${
          done
            ? 'border-success/30 bg-success/10 text-success'
            : 'border-border bg-surface text-ink-muted'
        }`}
      >
        <span aria-hidden="true">{done ? '✓' : '○'}</span>
        <span>{habit.name}</span>
      </span>
    </li>
  );
}
