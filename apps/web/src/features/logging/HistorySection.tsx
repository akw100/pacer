import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Run, Units, Workout } from '@pacer/shared';
import { ActivityRow } from './ActivityRow';
import { openLogSheet } from './LogSheet';
import { useDeleteRun, useDeleteWorkout, useRuns, useWorkouts } from './useLogging';

type Activity =
  | { kind: 'run'; run: Run; date: string }
  | { kind: 'workout'; workout: Workout; date: string };

interface HistorySectionProps {
  units?: Units;
}

export function HistorySection({ units = 'km' }: HistorySectionProps) {
  const runs = useRuns();
  const workouts = useWorkouts();
  const deleteRun = useDeleteRun();
  const deleteWorkout = useDeleteWorkout();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const merged = useMemo<Activity[]>(() => {
    const items: Activity[] = [
      ...(runs.data ?? []).map((r) => ({ kind: 'run' as const, run: r, date: r.run_date })),
      ...(workouts.data ?? []).map((w) => ({
        kind: 'workout' as const,
        workout: w,
        date: w.workout_date,
      })),
    ];
    items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return items;
  }, [runs.data, workouts.data]);

  if (runs.isLoading || workouts.isLoading) return <HistorySkeleton />;
  if (runs.error || workouts.error) {
    return (
      <ErrorBox
        message="Couldn't load history."
        onRetry={() => {
          runs.refetch();
          workouts.refetch();
        }}
      />
    );
  }

  if (merged.length === 0) return <EmptyState />;

  async function onDelete(a: Activity) {
    try {
      if (a.kind === 'run') await deleteRun.mutateAsync(a.run.id);
      else await deleteWorkout.mutateAsync(a.workout.id);
      toast.success('Deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setConfirmId(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-ink">History</h2>
        <span className="text-xs text-ink-muted">{merged.length} activities</span>
      </header>
      <div className="flex flex-col gap-2">
        {merged.map((a) => {
          const id = a.kind === 'run' ? a.run.id : a.workout.id;
          const confirming = confirmId === id;
          return (
            <div key={id} className="relative">
              <ActivityRow
                activity={a.kind === 'run' ? { kind: 'run', run: a.run } : { kind: 'workout', workout: a.workout }}
                units={units}
                onEdit={() => {
                  if (a.kind === 'run') openLogSheet({ tab: 'run', editRun: a.run });
                  else toast.message('Edit a workout from the form (coming soon)');
                }}
                onDelete={() => setConfirmId(id)}
              />
              {confirming && (
                <div className="absolute inset-0 flex items-center justify-end gap-2 rounded-card border border-accent/40 bg-surface/95 px-4">
                  <span className="text-sm text-ink">Delete this?</span>
                  <button
                    className="rounded-pill px-3 py-1 text-sm text-ink-muted hover:bg-ink/5"
                    onClick={() => setConfirmId(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-pill bg-accent px-3 py-1 text-sm text-white"
                    onClick={() => onDelete(a)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-card border border-dashed border-border bg-surface p-8 text-center">
      <div className="font-display text-lg font-semibold text-ink">Log your first run</div>
      <div className="mt-1 text-sm text-ink-muted">Tap the + button to get started.</div>
      <button
        onClick={() => openLogSheet({ tab: 'run' })}
        className="mt-4 rounded-pill bg-accent px-4 py-2 text-sm font-medium text-white"
      >
        Log activity
      </button>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-16 rounded-card border border-border bg-surface animate-pulse"
        />
      ))}
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-card border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-ink flex items-center justify-between gap-3">
      <span>{message}</span>
      <button
        onClick={onRetry}
        className="rounded-pill border border-border bg-surface px-3 py-1 text-xs text-ink"
      >
        Retry
      </button>
    </div>
  );
}
