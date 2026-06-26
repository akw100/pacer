import { useState } from 'react';
import { CheckCircle2, Clock, Edit3, Flag, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  metersToDisplayDistance,
  type GroupGoalWithProgress,
  type Units,
} from '@pacer/shared';
import { useArchiveGroupGoal, useGroupGoals } from './useGroupGoals';
import { GoalFormSheet } from './GoalFormSheet';

// Active goals for one group. Replaces the old ChallengePlaceholder.
//
// All values come straight from the API (`current_value`, `progress_pct`,
// `effective_status`, `days_left`). The card never recomputes progress from
// local activity — that's the backend's job and the single source of truth.
//
// Archived goals are filtered out of the v1 list (still in the DB; no
// "show archived" toggle yet).

interface GoalsCardProps {
  groupId: string;
  youUserId: string | null;
  isOwner: boolean;
  units: Units;
}

type Mode =
  | { kind: 'create' }
  | { kind: 'edit'; goal: GroupGoalWithProgress }
  | null;

export function GoalsCard({ groupId, youUserId, isOwner, units }: GoalsCardProps) {
  const goals = useGroupGoals(groupId);
  const archive = useArchiveGroupGoal(groupId);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<Mode>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);

  function openCreate() {
    setSheetMode({ kind: 'create' });
    setSheetOpen(true);
  }

  function openEdit(goal: GroupGoalWithProgress) {
    setSheetMode({ kind: 'edit', goal });
    setSheetOpen(true);
  }

  async function doArchive(goalId: string) {
    try {
      await archive.mutateAsync(goalId);
      toast.success('Goal archived');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not archive');
    } finally {
      setConfirmArchiveId(null);
    }
  }

  const rows = (goals.data ?? []).filter((g) => g.status !== 'archived');

  return (
    <section
      aria-labelledby="group-goals-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-4"
    >
      <header className="flex items-center justify-between gap-3">
        <h2
          id="group-goals-heading"
          className="font-display text-lg font-semibold text-ink inline-flex items-center gap-2"
        >
          <Flag size={16} strokeWidth={1.8} className="text-accent" />
          Goals
        </h2>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-ink/5"
        >
          <Plus size={12} strokeWidth={2.2} />
          Add goal
        </button>
      </header>

      {goals.isLoading ? (
        <div className="space-y-2">
          <div className="h-16 rounded-card bg-ink/5 animate-pulse" />
          <div className="h-16 rounded-card bg-ink/5 animate-pulse" />
        </div>
      ) : goals.isError ? (
        <div className="rounded-card border border-accent/30 bg-accent/5 p-3 text-sm text-ink-muted flex items-center justify-between">
          <span>Couldn't load goals.</span>
          <button
            type="button"
            onClick={() => goals.refetch()}
            className="rounded-pill border border-border bg-surface px-3 py-1 text-xs font-medium text-ink hover:bg-ink/5"
          >
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState onAdd={openCreate} />
      ) : (
        <ul role="list" className="flex flex-col gap-2">
          {rows.map((goal) => {
            const canEdit = !!youUserId && (goal.created_by === youUserId || isOwner);
            const isConfirming = confirmArchiveId === goal.id;
            return (
              <li key={goal.id}>
                <GoalRow
                  goal={goal}
                  units={units}
                  canEdit={canEdit}
                  isConfirming={isConfirming}
                  pending={archive.isPending && confirmArchiveId === goal.id}
                  onEdit={() => openEdit(goal)}
                  onAskArchive={() => setConfirmArchiveId(goal.id)}
                  onCancelArchive={() => setConfirmArchiveId(null)}
                  onConfirmArchive={() => doArchive(goal.id)}
                />
              </li>
            );
          })}
        </ul>
      )}

      <GoalFormSheet
        groupId={groupId}
        open={sheetOpen}
        mode={sheetMode}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setSheetMode(null);
        }}
      />
    </section>
  );
}

interface GoalRowProps {
  goal: GroupGoalWithProgress;
  units: Units;
  canEdit: boolean;
  isConfirming: boolean;
  pending: boolean;
  onEdit: () => void;
  onAskArchive: () => void;
  onCancelArchive: () => void;
  onConfirmArchive: () => void;
}

function GoalRow({
  goal,
  units,
  canEdit,
  isConfirming,
  pending,
  onEdit,
  onAskArchive,
  onCancelArchive,
  onConfirmArchive,
}: GoalRowProps) {
  const display = formatProgress(goal, units);
  return (
    <div className="rounded-card border border-border bg-surface p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink truncate">{goal.title}</div>
          <div className="text-xs text-ink-muted">{display.targetLabel}</div>
        </div>
        <StatusPill status={goal.effective_status} daysLeft={goal.days_left} />
      </div>

      <ProgressBar pct={goal.progress_pct} status={goal.effective_status} />

      <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
        <span className="tabular-nums">{display.progressLabel}</span>
        {canEdit && !isConfirming && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${goal.title}`}
              className="p-1 rounded-pill hover:bg-ink/5"
            >
              <Edit3 size={13} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={onAskArchive}
              aria-label={`Archive ${goal.title}`}
              className="p-1 rounded-pill hover:text-accent hover:bg-accent/10"
            >
              <Trash2 size={13} strokeWidth={1.8} />
            </button>
          </div>
        )}
        {canEdit && isConfirming && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onCancelArchive}
              className="rounded-pill text-xs text-ink-muted hover:bg-ink/5 px-2 py-0.5 inline-flex items-center gap-1"
            >
              <X size={11} strokeWidth={2} />
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirmArchive}
              disabled={pending}
              className="rounded-pill bg-accent text-white px-2.5 py-0.5 text-xs font-semibold disabled:opacity-60"
            >
              {pending ? 'Archiving…' : 'Archive'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressBar({
  pct,
  status,
}: {
  pct: number;
  status: GroupGoalWithProgress['effective_status'];
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const fill =
    status === 'completed'
      ? 'bg-success'
      : status === 'expired'
        ? 'bg-ink/40'
        : 'bg-accent';
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 rounded-pill bg-ink/5 overflow-hidden"
    >
      <div className={`h-full ${fill} transition-[width]`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function StatusPill({
  status,
  daysLeft,
}: {
  status: GroupGoalWithProgress['effective_status'];
  daysLeft: number;
}) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
        <CheckCircle2 size={10} strokeWidth={2.2} />
        Done
      </span>
    );
  }
  if (status === 'expired') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-ink/10 px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
        Past
      </span>
    );
  }
  if (status === 'archived') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-ink/5 px-2 py-0.5 text-[10px] font-medium text-ink-muted">
        Archived
      </span>
    );
  }
  // active
  const label = daysLeft <= 0 ? 'Last day' : `${daysLeft}d left`;
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
      <Clock size={10} strokeWidth={2.2} />
      {label}
    </span>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-card border border-dashed border-border bg-surface p-5 text-center flex flex-col items-center gap-3">
      <div>
        <div className="font-display text-base font-semibold text-ink">No active goals yet</div>
        <p className="mt-1 text-xs text-ink-muted leading-relaxed max-w-xs mx-auto">
          Pick a target — distance, runs, workouts, or points — and a window of time. Tagged
          runs and workouts count automatically.
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-pill bg-accent text-white px-4 py-2 text-sm font-semibold shadow-sm shadow-accent/20"
      >
        <Plus size={14} strokeWidth={2.2} />
        Create the first goal
      </button>
    </div>
  );
}

// ── Progress display ──────────────────────────────────────────────────────
// Distance: the API stores meters; we show km via the existing
// `metersToDisplayDistance` helper. For mi-profile users we still display
// distance goals in km in v1 (input is km-only on this card too) so the
// numbers stay internally consistent across viewing and creating.

function formatProgress(
  goal: GroupGoalWithProgress,
  _units: Units,
): { targetLabel: string; progressLabel: string } {
  switch (goal.metric) {
    case 'distance': {
      const targetKm = metersToDisplayDistance(goal.target_value, 'km').value;
      const currentKm = metersToDisplayDistance(goal.current_value, 'km').value;
      return {
        targetLabel: `Target ${formatNumber(targetKm)} km`,
        progressLabel: `${formatNumber(currentKm)} / ${formatNumber(targetKm)} km · ${goal.progress_pct}%`,
      };
    }
    case 'runs':
      return {
        targetLabel: `Target ${goal.target_value} ${goal.target_value === 1 ? 'run' : 'runs'}`,
        progressLabel: `${goal.current_value} / ${goal.target_value} runs · ${goal.progress_pct}%`,
      };
    case 'workouts':
      return {
        targetLabel: `Target ${goal.target_value} ${goal.target_value === 1 ? 'workout' : 'workouts'}`,
        progressLabel: `${goal.current_value} / ${goal.target_value} workouts · ${goal.progress_pct}%`,
      };
    case 'score':
      return {
        targetLabel: `Target ${goal.target_value} pts`,
        progressLabel: `${goal.current_value} / ${goal.target_value} pts · ${goal.progress_pct}%`,
      };
  }
}

function formatNumber(n: number): string {
  // Strip trailing zeroes but keep up to 1 decimal — display only.
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
