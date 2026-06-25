import { Footprints, Dumbbell, Pencil, Trash2 } from 'lucide-react';
import {
  formatDuration,
  formatPace,
  metersToDisplayDistance,
  paceSecondsPerUnit,
  type Run,
  type Units,
  type Workout,
} from '@pacer/shared';

// A single line item in the History list. Display values (km/mi, pace) are
// always derived from the canonical meters/seconds via shared helpers — we
// never store a display value.

type Activity =
  | { kind: 'run'; run: Run }
  | { kind: 'workout'; workout: Workout };

interface ActivityRowProps {
  activity: Activity;
  units: Units;
  onEdit: () => void;
  onDelete: () => void;
}

export function ActivityRow({ activity, units, onEdit, onDelete }: ActivityRowProps) {
  if (activity.kind === 'run') {
    const { run } = activity;
    const { value: distance, unit } = metersToDisplayDistance(run.distance_meters, units);
    const pace = formatPace(paceSecondsPerUnit(run.distance_meters, run.duration_seconds, units));
    return (
      <RowFrame
        icon={<Footprints size={18} strokeWidth={1.8} className="text-accent" />}
        title={`${distance.toFixed(2)} ${unit}`}
        meta={[`${pace} /${unit}`, formatDuration(run.duration_seconds)]}
        date={run.run_date}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
  }
  const { workout } = activity;
  const setCount = workout.sets?.length ?? 0;
  return (
    <RowFrame
      icon={<Dumbbell size={18} strokeWidth={1.8} className="text-success" />}
      title={workout.name}
      meta={[
        workout.kind,
        ...(workout.duration_seconds ? [formatDuration(workout.duration_seconds)] : []),
        `${setCount} set${setCount === 1 ? '' : 's'}`,
      ]}
      date={workout.workout_date}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}

function RowFrame({
  icon,
  title,
  meta,
  date,
  onEdit,
  onDelete,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string[];
  date: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3">
      <span className="grid place-items-center w-9 h-9 rounded-pill bg-ink/5 shrink-0">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-base font-semibold text-ink truncate">{title}</div>
        <div className="text-xs text-ink-muted truncate">
          {date} · {meta.join(' · ')}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          aria-label="Edit"
          onClick={onEdit}
          className="p-2 rounded-pill text-ink-muted hover:text-ink hover:bg-ink/5"
        >
          <Pencil size={16} strokeWidth={1.8} />
        </button>
        <button
          aria-label="Delete"
          onClick={onDelete}
          className="p-2 rounded-pill text-ink-muted hover:text-accent hover:bg-accent/10"
        >
          <Trash2 size={16} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
