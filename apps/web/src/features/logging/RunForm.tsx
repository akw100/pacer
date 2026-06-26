import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ChevronDown } from 'lucide-react';
import {
  scoreFor,
  toDateKey,
  type Run,
  type RunCreate,
  type Units,
} from '@pacer/shared';
import { useCreateRun, useUpdateRun } from './useLogging';

// Big, friendly inputs LABELED in the profile's unit (km/mi) but normalized to
// canonical meters/seconds before submit. The wellness toggles live under a
// "Details" disclosure so the form stays one screen at first glance.

const METERS_PER_MILE = 1609.344;

// Form values mirror the user's UNIT-LABELED inputs (km/mi + mm:ss). We
// transform to canonical meters/seconds before calling the mutation.
const FormSchema = z.object({
  distance: z
    .string()
    .min(1, 'Enter a distance')
    .refine((v) => Number(v) > 0, 'Distance must be positive'),
  durationMinutes: z
    .string()
    .min(1)
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 0, 'Minutes must be a whole number ≥ 0'),
  durationSeconds: z
    .string()
    .min(1)
    .refine(
      (v) => Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) < 60,
      'Seconds must be 0–59',
    ),
  runDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  exertionRating: z.number().int().min(1).max(10),
  warmUp: z.boolean(),
  stretched: z.boolean(),
  postRunFood: z.boolean(),
  sleepHours: z.string(),
  notes: z.string(),
});
type FormValues = z.infer<typeof FormSchema>;

interface RunFormProps {
  units: Units;
  initial?: Run;
  /** Optional group to count this run in (null = personal only). */
  sharedGroupId?: string | null;
  onDone: () => void;
}

export function RunForm({ units, initial, sharedGroupId, onDone }: RunFormProps) {
  const create = useCreateRun();
  const update = useUpdateRun();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const initialDistance = initial
    ? units === 'km'
      ? initial.distance_meters / 1000
      : initial.distance_meters / METERS_PER_MILE
    : 0;
  const initialMins = initial ? Math.floor(initial.duration_seconds / 60) : 0;
  const initialSecs = initial ? initial.duration_seconds % 60 : 0;

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      distance: initial ? String(Number(initialDistance.toFixed(2))) : '',
      durationMinutes: initial ? String(initialMins) : '',
      durationSeconds: initial ? String(initialSecs).padStart(2, '0') : '00',
      runDate: initial?.run_date ?? toDateKey(new Date()),
      exertionRating: initial?.exertion_rating ?? 5,
      warmUp: initial?.warm_up ?? false,
      stretched: initial?.stretched ?? false,
      postRunFood: initial?.post_run_food ?? false,
      sleepHours: initial?.sleep_hours != null ? String(initial.sleep_hours) : '',
      notes: initial?.notes ?? '',
    },
  });

  const exertion = form.watch('exertionRating');

  const onSubmit = form.handleSubmit(async (values) => {
    const distanceUnits = Number(values.distance);
    const distanceMeters = Math.round(
      units === 'km' ? distanceUnits * 1000 : distanceUnits * METERS_PER_MILE,
    );
    const durationSeconds = Number(values.durationMinutes) * 60 + Number(values.durationSeconds);

    if (distanceMeters <= 0 || durationSeconds <= 0) {
      toast.error('Distance and duration must be positive');
      return;
    }

    let sleepHours: number | null = null;
    if (values.sleepHours !== '') {
      const n = Number(values.sleepHours);
      if (Number.isFinite(n) && n >= 0 && n <= 24) sleepHours = n;
    }

    const payload: RunCreate = {
      run_date: values.runDate,
      distance_meters: distanceMeters,
      duration_seconds: durationSeconds,
      exertion_rating: values.exertionRating,
      warm_up: values.warmUp,
      stretched: values.stretched,
      post_run_food: values.postRunFood,
      sleep_hours: sleepHours,
      notes: values.notes || null,
      source: 'web',
      // Additive: present only when the user opted to count this run in a
      // group. Null = personal only (the canonical user record is unchanged
      // either way).
      shared_group_id: sharedGroupId ?? null,
    };

    try {
      if (initial) {
        await update.mutateAsync({ id: initial.id, patch: payload });
        toast.success('Run updated');
      } else {
        await create.mutateAsync(payload);
        const points = scoreFor({ reason: 'run', distanceMeters });
        toast.success(`+${points} pts`);
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
  });

  const busy = create.isPending || update.isPending;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 p-1">
      {/* Big distance + time inputs */}
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Distance (${units})`}>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="5.00"
            {...form.register('distance')}
            className="font-display text-3xl font-bold text-ink bg-transparent w-full focus:outline-none placeholder:text-ink-muted/50"
          />
        </Field>
        <Field label="Duration (mm:ss)">
          <div className="flex items-end gap-1 font-display text-3xl font-bold text-ink">
            <input
              type="number"
              inputMode="numeric"
              placeholder="28"
              {...form.register('durationMinutes')}
              className="bg-transparent w-14 focus:outline-none placeholder:text-ink-muted/50 text-right"
            />
            <span className="text-ink-muted">:</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="00"
              {...form.register('durationSeconds')}
              className="bg-transparent w-14 focus:outline-none placeholder:text-ink-muted/50"
            />
          </div>
        </Field>
      </div>

      <Field label="Date">
        <input
          type="date"
          {...form.register('runDate')}
          className="bg-transparent text-ink text-base focus:outline-none"
        />
      </Field>

      {/* Custom exertion slider */}
      <Field label={`Effort: ${exertion}/10`}>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={exertion}
          onChange={(e) => form.setValue('exertionRating', Number(e.target.value))}
          className="w-full accent-accent"
        />
      </Field>

      {/* Details disclosure */}
      <div className="border-t border-border pt-4">
        <button
          type="button"
          onClick={() => setDetailsOpen((o) => !o)}
          className="flex w-full items-center justify-between text-sm font-medium text-ink"
        >
          <span>Details</span>
          <ChevronDown
            size={16}
            strokeWidth={2}
            className={`transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {detailsOpen && (
          <div className="mt-4 flex flex-col gap-3">
            <WellnessToggle label="Warm-up" {...form.register('warmUp')} />
            <WellnessToggle label="Stretched after" {...form.register('stretched')} />
            <WellnessToggle label="Ate after" {...form.register('postRunFood')} />
            <Field label="Sleep last night (hours)">
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                placeholder="7.5"
                {...form.register('sleepHours')}
                className="bg-transparent w-full text-ink text-base focus:outline-none placeholder:text-ink-muted/50"
              />
            </Field>
            <Field label="Notes">
              <textarea
                rows={2}
                placeholder="Felt strong last 2 km."
                {...form.register('notes')}
                className="bg-transparent w-full text-ink text-sm focus:outline-none placeholder:text-ink-muted/50 resize-none"
              />
            </Field>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={busy}
        className="rounded-pill bg-accent text-white py-3 font-medium active:scale-[0.98] disabled:opacity-50 transition-transform"
      >
        {busy ? 'Saving…' : initial ? 'Save changes' : 'Log run'}
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

// Custom token-styled toggle (no native checkbox visual). Plays nice with
// react-hook-form's register() spread.
const WellnessToggle = ({
  label,
  ...rest
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
    <span className="text-sm text-ink">{label}</span>
    <span className="relative inline-block">
      <input type="checkbox" className="sr-only peer" {...rest} />
      <span className="block w-10 h-6 rounded-pill bg-border transition-colors peer-checked:bg-accent" />
      <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
    </span>
  </label>
);
