import { useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Command } from 'cmdk';
import { Plus, Trash2, Repeat } from 'lucide-react';
import {
  scoreFor,
  toDateKey,
  type WorkoutCreate,
} from '@pacer/shared';
import { useCreateWorkout, useWorkouts } from './useLogging';

type WorkoutKind = WorkoutCreate['kind'];
const KIND_OPTIONS: WorkoutKind[] = ['strength', 'mobility', 'swim', 'bike', 'other'];

const SetSchema = z.object({
  exerciseName: z.string().min(1, 'Name an exercise'),
  sets: z.string(),
  reps: z.string(),
  weight: z.string(),
});

const FormSchema = z.object({
  name: z.string().min(1, 'Name your workout'),
  kind: z.enum(['strength', 'mobility', 'swim', 'bike', 'other']),
  workoutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.string(),
  sets: z.array(SetSchema).min(1, 'Add at least one exercise'),
});
type FormValues = z.infer<typeof FormSchema>;

interface WorkoutFormProps {
  onDone: () => void;
}

export function WorkoutForm({ onDone }: WorkoutFormProps) {
  const create = useCreateWorkout();
  const { data: history = [] } = useWorkouts();
  const [nameOpen, setNameOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
      kind: 'strength',
      workoutDate: toDateKey(new Date()),
      durationMinutes: '',
      sets: [{ exerciseName: '', sets: '', reps: '', weight: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'sets' });

  // Distinct prior workout names for autocomplete — most-recent first.
  const nameSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const w of history) {
      if (!seen.has(w.name)) {
        seen.add(w.name);
        out.push(w.name);
      }
    }
    return out;
  }, [history]);

  const last = history[0];

  function repeatLast() {
    if (!last) return;
    form.reset({
      name: last.name,
      kind: last.kind,
      workoutDate: toDateKey(new Date()),
      durationMinutes: last.duration_seconds ? String(Math.round(last.duration_seconds / 60)) : '',
      sets:
        last.sets && last.sets.length > 0
          ? last.sets.map((s) => ({
              exerciseName: s.exercise_name,
              sets: s.sets != null ? String(s.sets) : '',
              reps: s.reps != null ? String(s.reps) : '',
              weight: s.weight != null ? String(s.weight) : '',
            }))
          : [{ exerciseName: '', sets: '', reps: '', weight: '' }],
    });
    toast.success(`Prefilled from "${last.name}"`);
  }

  const onSubmit = form.handleSubmit(async (values) => {
    const durationMinutes = Number(values.durationMinutes);
    const durationSeconds =
      values.durationMinutes !== '' && Number.isFinite(durationMinutes) && durationMinutes > 0
        ? Math.round(durationMinutes * 60)
        : null;

    // Server requires `sets` and `reps` as positive ints — only include rows
    // the user actually filled out. Empty exercise names are skipped.
    const sets = values.sets
      .filter((s) => s.exerciseName.trim() !== '' && s.sets !== '' && s.reps !== '')
      .map((s) => ({
        exercise_name: s.exerciseName.trim(),
        sets: Number(s.sets),
        reps: Number(s.reps),
        weight: s.weight === '' ? null : Number(s.weight),
      }));

    const payload: WorkoutCreate = {
      name: values.name.trim(),
      kind: values.kind,
      workout_date: values.workoutDate,
      duration_seconds: durationSeconds,
      sets,
      source: 'web',
    };

    try {
      await create.mutateAsync(payload);
      const points = scoreFor({ reason: 'workout' });
      toast.success(`+${points} pts`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
  });

  const nameValue = form.watch('name');

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 p-1">
      {last && (
        <button
          type="button"
          onClick={repeatLast}
          className="self-start inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-ink/5"
        >
          <Repeat size={14} strokeWidth={1.8} />
          Repeat last
        </button>
      )}

      {/* Name with cmdk autocomplete from user's prior workout names */}
      <div className="relative">
        <Field label="Workout name">
          <input
            type="text"
            placeholder="Strength A"
            value={nameValue}
            onChange={(e) => {
              form.setValue('name', e.target.value);
              setNameOpen(true);
            }}
            onFocus={() => setNameOpen(true)}
            onBlur={() => setTimeout(() => setNameOpen(false), 120)}
            className="bg-transparent w-full text-ink text-base focus:outline-none placeholder:text-ink-muted/50"
          />
        </Field>
        {nameOpen && nameSuggestions.length > 0 && (
          <Command
            className="absolute left-0 right-0 top-full mt-1 z-10 rounded-card border border-border bg-surface shadow-lg"
            label="Workout name suggestions"
          >
            <Command.List className="max-h-48 overflow-auto py-1">
              <Command.Empty className="px-3 py-2 text-sm text-ink-muted">
                No matches
              </Command.Empty>
              {nameSuggestions
                .filter((n) =>
                  nameValue ? n.toLowerCase().includes(nameValue.toLowerCase()) : true,
                )
                .slice(0, 6)
                .map((n) => (
                  <Command.Item
                    key={n}
                    value={n}
                    onSelect={(v) => {
                      form.setValue('name', v);
                      setNameOpen(false);
                    }}
                    className="px-3 py-2 text-sm text-ink cursor-pointer data-[selected=true]:bg-ink/5"
                  >
                    {n}
                  </Command.Item>
                ))}
            </Command.List>
          </Command>
        )}
      </div>

      {/* Custom kind segmented control (no native select) */}
      <Field label="Kind">
        <div className="flex flex-wrap gap-2">
          {KIND_OPTIONS.map((k) => {
            const active = form.watch('kind') === k;
            return (
              <button
                type="button"
                key={k}
                onClick={() => form.setValue('kind', k)}
                className={`rounded-pill px-3 py-1.5 text-xs font-medium capitalize border transition-colors ${
                  active
                    ? 'bg-accent text-white border-accent'
                    : 'bg-surface text-ink border-border hover:bg-ink/5'
                }`}
              >
                {k}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input
            type="date"
            {...form.register('workoutDate')}
            className="bg-transparent text-ink text-base focus:outline-none"
          />
        </Field>
        <Field label="Duration (min)">
          <input
            type="number"
            inputMode="numeric"
            placeholder="45"
            {...form.register('durationMinutes')}
            className="bg-transparent w-full text-ink text-base focus:outline-none placeholder:text-ink-muted/50"
          />
        </Field>
      </div>

      {/* Exercise rows */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-ink-muted">Exercises</span>
          <button
            type="button"
            onClick={() => append({ exerciseName: '', sets: '', reps: '', weight: '' })}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent"
          >
            <Plus size={14} strokeWidth={2} />
            Add row
          </button>
        </div>
        {fields.map((field, i) => (
          <div
            key={field.id}
            className="grid grid-cols-[1fr_3.5rem_3.5rem_4rem_2rem] gap-2 items-center"
          >
            <input
              type="text"
              placeholder="Bench press"
              {...form.register(`sets.${i}.exerciseName`)}
              className="rounded-card border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-accent"
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder="Sets"
              {...form.register(`sets.${i}.sets`)}
              className="rounded-card border border-border bg-surface px-2 py-2 text-sm text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-accent text-center"
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder="Reps"
              {...form.register(`sets.${i}.reps`)}
              className="rounded-card border border-border bg-surface px-2 py-2 text-sm text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-accent text-center"
            />
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              placeholder="Wt"
              {...form.register(`sets.${i}.weight`)}
              className="rounded-card border border-border bg-surface px-2 py-2 text-sm text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-accent text-center"
            />
            <button
              type="button"
              onClick={() => fields.length > 1 && remove(i)}
              aria-label="Remove exercise"
              className="p-2 rounded-pill text-ink-muted hover:text-accent hover:bg-accent/10 disabled:opacity-30"
              disabled={fields.length === 1}
            >
              <Trash2 size={14} strokeWidth={1.8} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={create.isPending}
        className="rounded-pill bg-accent text-white py-3 font-medium active:scale-[0.98] disabled:opacity-50 transition-transform"
      >
        {create.isPending ? 'Saving…' : 'Log workout'}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 rounded-card border border-border bg-surface px-4 py-3">
      <span className="text-xs uppercase tracking-wide text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
