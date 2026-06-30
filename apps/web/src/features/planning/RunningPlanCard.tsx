import { useMemo, useState, type ChangeEvent } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { metersToKm } from '@pacer/shared'
import { AlertTriangle, Footprints, Home, Pencil, Trash2 } from 'lucide-react'
import { Button } from '../../components/Button'
import { assessPlan, buildRamp, summarizeRamp, type PlanAdvice, type RunningPlanInput } from './plan'
import { useRunningPlan } from './useRunningPlan'
import { useHomePlanPrefs } from './useHomePlanPrefs'

interface FormState {
  current: string
  goal: string
  weeks: string
  runsPerWeek: string
}

const KM = 1000

const chipButton =
  'inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink'
const chipButtonActive =
  'inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium text-accent bg-accent/10 transition-colors hover:bg-accent/15'

function toForm(plan: RunningPlanInput | null): FormState {
  if (!plan)
    return { current: '20', goal: '40', weeks: '8', runsPerWeek: '3' }
  return {
    current: String(metersToKm(plan.currentWeeklyMeters)),
    goal: String(metersToKm(plan.goalWeeklyMeters)),
    weeks: String(plan.weeks),
    runsPerWeek: String(plan.runsPerWeek),
  }
}

function parseForm(form: FormState): RunningPlanInput {
  const current = Math.max(0, Number(form.current) || 0)
  const goal = Math.max(0, Number(form.goal) || 0)
  const weeks = Math.min(52, Math.max(1, Math.round(Number(form.weeks) || 1)))
  const runsPerWeek = Math.min(7, Math.max(1, Math.round(Number(form.runsPerWeek) || 1)))
  return {
    currentWeeklyMeters: Math.round(current * KM),
    goalWeeklyMeters: Math.round(goal * KM),
    weeks,
    runsPerWeek,
    createdAt: new Date().toISOString(),
  }
}

export default function RunningPlanCard() {
  const { plan, save, clear } = useRunningPlan()
  const { prefs, toggle } = useHomePlanPrefs()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<FormState>(() => toForm(plan))

  const showForm = !plan || editing

  // Derived live from the current form while editing, otherwise from the saved
  // plan. Distances are computed in meters and converted to km for display.
  const ramp = useMemo(() => {
    const input = showForm ? parseForm(form) : plan
    return input ? buildRamp(input) : []
  }, [showForm, form, plan])

  const summary = useMemo(() => summarizeRamp(ramp), [ramp])

  // Friendly heads-up for severe (unrealistic) plans only — shown live while
  // editing and on the saved plan.
  const advice = useMemo<PlanAdvice>(() => {
    const input = showForm ? parseForm(form) : plan
    return input ? assessPlan(input) : { severity: 'ok' }
  }, [showForm, form, plan])

  const chartData = useMemo(
    () =>
      ramp.map((w) => ({
        label: `W${w.week}`,
        km: Number(metersToKm(w.weeklyMeters).toFixed(1)),
        recovery: w.recovery,
      })),
    [ramp],
  )

  const set = (key: keyof FormState) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSave = () => {
    save(parseForm(form))
    setEditing(false)
  }

  return (
    <section className="rounded-card border border-border bg-panel p-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-pill bg-accent/10 text-accent">
            <Footprints size={18} strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-ink">Running plan</h2>
            <p className="text-xs text-ink-muted">A graded weekly mileage ramp.</p>
          </div>
        </div>
        {plan && !editing && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => toggle('running')}
              aria-pressed={prefs.running}
              className={prefs.running ? chipButtonActive : chipButton}
            >
              <Home size={15} strokeWidth={1.8} /> {prefs.running ? 'On Home' : 'Add to Home'}
            </button>
            <button type="button" onClick={() => { setForm(toForm(plan)); setEditing(true) }} className={chipButton}>
              <Pencil size={15} strokeWidth={1.8} /> Edit
            </button>
            <button type="button" onClick={clear} className={chipButton}>
              <Trash2 size={15} strokeWidth={1.8} /> Clear
            </button>
          </div>
        )}
      </header>

      {showForm && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Current km / week" value={form.current} onChange={set('current')} />
          <Field label="Goal km / week" value={form.goal} onChange={set('goal')} />
          <Field label="Weeks" value={form.weeks} onChange={set('weeks')} min={1} max={52} step={1} />
          <Field label="Runs / week" value={form.runsPerWeek} onChange={set('runsPerWeek')} min={1} max={7} step={1} />
        </div>
      )}

      {/* Generated ramp — shown live as a preview before saving (per spec). */}
      <div className="mt-4 rounded-card border border-border bg-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-ink-muted">Weekly distance (km)</span>
          {showForm && <span className="text-[11px] text-ink-muted">Preview</span>}
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--color-border)' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                tickLine={false}
                axisLine={false}
                width={34}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-ink)', fillOpacity: 0.04 }}
                contentStyle={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-card)',
                  fontSize: 12,
                  color: 'var(--color-ink)',
                }}
                formatter={(v: number) => [`${v} km`, 'Target']}
              />
              <Bar dataKey="km" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.recovery ? 'var(--color-success)' : 'var(--color-accent)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Stat label="Weeks" value={String(summary.weeks)} />
          <Stat label="Peak week" value={`${summary.peakWeeklyKm.toFixed(1)} km`} />
          <Stat label="Total" value={`${summary.totalKm.toFixed(0)} km`} />
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-muted">
          <span className="inline-block h-2 w-2 rounded-pill bg-success" /> Green weeks are lighter
          recovery weeks.
        </p>
      </div>

      {advice.severity === 'severe' && advice.message && (
        <div
          role="status"
          className="mt-4 flex items-start gap-2.5 rounded-card border border-streak/40 bg-streak/10 p-3 text-sm text-ink"
        >
          <AlertTriangle size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-streak" />
          <p className="leading-relaxed">{advice.message}</p>
        </div>
      )}

      {showForm && (
        <div className="mt-4 flex justify-end gap-2">
          {plan && editing && (
            <Button variant="secondary" onClick={() => { setForm(toForm(plan)); setEditing(false) }}>
              Cancel
            </Button>
          )}
          <Button onClick={onSave}>{plan ? 'Save changes' : 'Save plan'}</Button>
        </div>
      )}
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
}: {
  label: string
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-ink-muted">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        className="w-full rounded-card border border-border bg-surface px-3 py-2.5 text-sm text-ink transition-colors focus:border-accent focus:outline-none"
      />
    </label>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-panel p-3 text-center">
      <div className="text-[11px] text-ink-muted">{label}</div>
      <div className="font-display text-lg font-bold text-ink">{value}</div>
    </div>
  )
}
