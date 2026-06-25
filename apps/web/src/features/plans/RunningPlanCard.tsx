import { useMemo, useState } from 'react'
import { ArrowUpRight, BarChart2, CalendarDays } from 'lucide-react'
import { Button } from '../../components/Button'

const planPhases = ['Build', 'Tune', 'Peak'] as const

type RunningPlan = {
  currentWeeklyKm: number
  goalWeeklyKm: number
  runsPerWeek: number
  weeks: number
  startDate: string
  active: boolean
}

function buildRamp(plan: RunningPlan) {
  const { currentWeeklyKm, goalWeeklyKm, weeks } = plan
  const weekly = [] as number[]
  let value = currentWeeklyKm
  const growth = (goalWeeklyKm / currentWeeklyKm) ** (1 / (weeks - 1))

  for (let i = 0; i < weeks; i += 1) {
    weekly.push(Math.round(value * 10) / 10)
    value = Math.min(goalWeeklyKm, value * growth)
  }

  return weekly
}

export default function RunningPlanCard() {
  const [plan, setPlan] = useState<RunningPlan>({
    currentWeeklyKm: 18,
    goalWeeklyKm: 30,
    runsPerWeek: 3,
    weeks: 6,
    startDate: '2026-07-01',
    active: true,
  })
  const [isEditing, setIsEditing] = useState(false)

  const ramp = useMemo(() => buildRamp(plan), [plan])

  const applyEdit = () => {
    setIsEditing(false)
  }

  return (
    <section className="rounded-card border border-border bg-white p-6 shadow-sm shadow-ink/5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Running plan</p>
          <h2 className="mt-2 text-2xl font-display font-bold text-ink">Weekly ramp</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
            A progressive running plan that builds from your current weekly km to the goal in {plan.weeks} weeks.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setIsEditing((current) => !current)}>
          {isEditing ? 'Cancel' : 'Edit plan'}
        </Button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="text-sm text-ink-muted">Current weekly km</p>
          <p className="mt-2 text-3xl font-display font-bold text-ink">{plan.currentWeeklyKm} km</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="text-sm text-ink-muted">Goal weekly km</p>
          <p className="mt-2 text-3xl font-display font-bold text-ink">{plan.goalWeeklyKm} km</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="text-sm text-ink-muted">Runs per week</p>
          <p className="mt-2 text-3xl font-display font-bold text-ink">{plan.runsPerWeek}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-card border border-border bg-surface p-4">
            <p className="text-sm text-ink-muted">Start date</p>
            <p className="mt-2 text-lg font-semibold text-ink">{plan.startDate}</p>
          </div>
          <div className="rounded-card border border-border bg-surface p-4">
            <p className="text-sm text-ink-muted">Weeks</p>
            <p className="mt-2 text-lg font-semibold text-ink">{plan.weeks}</p>
          </div>
          <div className="rounded-card border border-border bg-surface p-4">
            <p className="text-sm text-ink-muted">Phase</p>
            <p className="mt-2 text-lg font-semibold text-ink">{planPhases[(plan.weeks - 1) % planPhases.length]}</p>
          </div>
        </div>

        <div className="rounded-card border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <CalendarDays size={16} />
            <span>Ramp preview</span>
          </div>
          <div className="mt-4 flex items-end gap-2">
            {ramp.map((value, index) => (
              <div key={index} className="flex-1 text-center">
                <div className="mx-auto h-24 w-full rounded-card bg-accent/10 text-accent" style={{ height: `${Math.max(10, value)}%` }} />
                <p className="mt-2 text-sm font-semibold text-ink">{value} km</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="mt-6 rounded-card border border-border bg-surface p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-ink-muted">
              Current weekly km
              <input
                type="number"
                value={plan.currentWeeklyKm}
                onChange={(event) => setPlan({ ...plan, currentWeeklyKm: Number(event.target.value) })}
                className="w-full rounded-card border border-border bg-white px-4 py-3 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="space-y-2 text-sm text-ink-muted">
              Goal weekly km
              <input
                type="number"
                value={plan.goalWeeklyKm}
                onChange={(event) => setPlan({ ...plan, goalWeeklyKm: Number(event.target.value) })}
                className="w-full rounded-card border border-border bg-white px-4 py-3 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-ink-muted">
              Runs per week
              <input
                type="number"
                value={plan.runsPerWeek}
                min={1}
                max={7}
                onChange={(event) => setPlan({ ...plan, runsPerWeek: Number(event.target.value) })}
                className="w-full rounded-card border border-border bg-white px-4 py-3 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="space-y-2 text-sm text-ink-muted">
              Duration (weeks)
              <input
                type="number"
                value={plan.weeks}
                min={2}
                max={12}
                onChange={(event) => setPlan({ ...plan, weeks: Number(event.target.value) })}
                className="w-full rounded-card border border-border bg-white px-4 py-3 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={applyEdit}>
              Save plan
            </Button>
            <Button variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3 rounded-card border border-border bg-accent/10 px-4 py-3 text-sm text-accent">
        <BarChart2 size={18} />
        <span>When a run is logged, the next scheduled plan run for the week is auto-completed.</span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
        <ArrowUpRight size={16} />
        <span>Missed week? The app suggests a repeat week instead of silently falling behind.</span>
      </div>
    </section>
  )
}
