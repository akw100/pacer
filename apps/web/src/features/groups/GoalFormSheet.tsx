import { useEffect, useMemo, useState } from 'react';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import {
  metersToKm,
  type CreateGroupGoalInput,
  type GroupGoalMetric,
  type GroupGoalWithProgress,
  type UpdateGroupGoalInput,
} from '@pacer/shared';
import { useCreateGroupGoal, useUpdateGroupGoal } from './useGroupGoals';

// Bottom-sheet form for creating or editing a goal. Single component, two
// modes, to keep the file count small (mirrors the InviteSheet style).
//
// Unit note (v1 limitation): the `distance` metric stores meters server-side
// but the input here is always KM, regardless of profile.units. The shared
// package only exposes a meters→display helper; there is no safe inverse,
// and we don't want to introduce a half-baked one here. Multiplying km by
// 1000 is exact arithmetic. Mi-profile users can still see goal numbers in
// km on this card — explicit and predictable. Adding a proper
// `displayDistanceToMeters` helper to packages/shared is a follow-up if the
// product wants mi input later.

type Mode =
  | { kind: 'create' }
  | { kind: 'edit'; goal: GroupGoalWithProgress };

interface GoalFormSheetProps {
  groupId: string;
  open: boolean;
  mode: Mode | null;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  title: string;
  metric: GroupGoalMetric;
  /** What the user typed: km for distance, integer for the rest. */
  targetDisplay: string;
  start_date: string;
  end_date: string;
}

const METRIC_OPTIONS: ReadonlyArray<{
  value: GroupGoalMetric;
  label: string;
  unit: string;
  placeholder: string;
}> = [
  { value: 'distance', label: 'Distance', unit: 'km', placeholder: '20' },
  { value: 'runs',     label: 'Runs',     unit: 'runs', placeholder: '10' },
  { value: 'workouts', label: 'Workouts', unit: 'workouts', placeholder: '8' },
  { value: 'score',    label: 'Score',    unit: 'pts', placeholder: '300' },
];

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function plusDaysKey(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function initialStateForMode(mode: Mode): FormState {
  if (mode.kind === 'create') {
    return {
      title: '',
      metric: 'distance',
      targetDisplay: '',
      start_date: todayKey(),
      end_date: plusDaysKey(7),
    };
  }
  const g = mode.goal;
  const displayTarget =
    g.metric === 'distance'
      ? String(metersToKm(g.target_value))
      : String(g.target_value);
  return {
    title: g.title,
    metric: g.metric,
    targetDisplay: displayTarget,
    start_date: g.start_date,
    end_date: g.end_date,
  };
}

export function GoalFormSheet({ groupId, open, mode, onOpenChange }: GoalFormSheetProps) {
  const create = useCreateGroupGoal(groupId);
  const update = useUpdateGroupGoal(
    groupId,
    mode?.kind === 'edit' ? mode.goal.id : '',
  );

  const isEdit = mode?.kind === 'edit';
  const [form, setForm] = useState<FormState>(() =>
    mode ? initialStateForMode(mode) : initialStateForMode({ kind: 'create' }),
  );

  // Reset whenever the sheet opens (or switches mode) so we never show stale
  // values from a previous open.
  useEffect(() => {
    if (open && mode) setForm(initialStateForMode(mode));
  }, [open, mode]);

  const metricMeta = useMemo(
    () => METRIC_OPTIONS.find((m) => m.value === form.metric) ?? METRIC_OPTIONS[0]!,
    [form.metric],
  );

  const pending = create.isPending || update.isPending;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  async function submit() {
    const title = form.title.trim();
    if (!title) {
      toast.error('Give the goal a title');
      return;
    }
    const parsed = Number(form.targetDisplay);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error('Target must be a positive number');
      return;
    }
    if (form.end_date < form.start_date) {
      toast.error('End date must be on or after the start date');
      return;
    }

    // Distance: canonical storage is meters; 1 km = 1000 m. Integer metrics
    // round to the nearest whole unit (the API also rejects non-positive).
    const target_value =
      form.metric === 'distance' ? parsed * 1000 : Math.round(parsed);

    try {
      if (isEdit) {
        const input: UpdateGroupGoalInput = {
          title,
          target_value,
          start_date: form.start_date,
          end_date: form.end_date,
        };
        await update.mutateAsync(input);
        toast.success('Goal updated');
      } else {
        const input: CreateGroupGoalInput = {
          title,
          metric: form.metric,
          target_value,
          start_date: form.start_date,
          end_date: form.end_date,
        };
        await create.mutateAsync(input);
        toast.success('Goal created');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save goal');
    }
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col rounded-t-card border border-border bg-surface md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:w-[26rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-card"
        >
          <Drawer.Title className="sr-only">
            {isEdit ? 'Edit goal' : 'Create goal'}
          </Drawer.Title>
          <div className="mx-auto my-2 h-1.5 w-10 rounded-pill bg-border md:hidden" />
          <header className="flex items-center justify-between px-5 pt-2 pb-3">
            <h2 className="font-display text-lg font-semibold text-ink">
              {isEdit ? 'Edit goal' : 'New goal'}
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-pill text-ink-muted hover:text-ink hover:bg-ink/5"
            >
              <X size={18} strokeWidth={1.8} />
            </button>
          </header>

          <div className="px-5 pb-5 flex flex-col gap-4 overflow-y-auto">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Title
              </span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="e.g. October 100km club"
                maxLength={80}
                className="rounded-card border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
              />
            </label>

            {/* Metric — radio group. Disabled when editing (immutable per backend). */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Metric
              </span>
              <div role="radiogroup" aria-label="Metric" className="grid grid-cols-2 gap-2">
                {METRIC_OPTIONS.map((opt) => {
                  const active = form.metric === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={isEdit}
                      onClick={() => setField('metric', opt.value)}
                      className={`rounded-card border px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border bg-surface text-ink hover:bg-ink/5'
                      } ${isEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {isEdit && (
                <p className="text-xs text-ink-muted">
                  Metric can't be changed after creation.
                </p>
              )}
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Target ({metricMeta.unit})
              </span>
              <input
                type="number"
                min="0"
                step={form.metric === 'distance' ? '0.1' : '1'}
                value={form.targetDisplay}
                onChange={(e) => setField('targetDisplay', e.target.value)}
                placeholder={metricMeta.placeholder}
                className="rounded-card border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
              />
              {form.metric === 'distance' && (
                <p className="text-xs text-ink-muted">
                  Distance targets are in km. Stored as meters server-side.
                </p>
              )}
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Start
                </span>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setField('start_date', e.target.value)}
                  className="rounded-card border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  End
                </span>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setField('end_date', e.target.value)}
                  className="rounded-card border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-pill border border-border bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-ink/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-accent/20 disabled:opacity-50"
              >
                {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create goal'}
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
