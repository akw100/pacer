import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { CalendarDays, Dumbbell, Footprints, Moon } from 'lucide-react'
import { metersToKm, type Run } from '@pacer/shared'
import { useRuns } from '../logging/useLogging'
import { useHomePlanPrefs } from './useHomePlanPrefs'
import { useRunningPlan } from './useRunningPlan'
import { useWorkoutPlan } from './useWorkoutPlan'
import { weekProgress } from './progress'
import { DAY_KIND_LABEL, DAY_LABELS, type DayKind } from './plan'

// Compact, read-only Home versions of the plans — the editable cards live on
// /planning. Renders only the plans the user pinned to Home (see
// useHomePlanPrefs); renders nothing when neither is pinned.

const KIND_DOT: Record<DayKind, string> = {
  rest: 'bg-ink-muted/40',
  run: 'bg-accent',
  strength: 'bg-success',
}

export function HomePlansSection() {
  const { prefs } = useHomePlanPrefs()
  if (!prefs.running && !prefs.workout) return null

  return (
    <section className="grid gap-4 md:grid-cols-2 md:gap-5 items-start">
      {prefs.running && <RunningSummary />}
      {prefs.workout && <WorkoutSummary />}
    </section>
  )
}

function CardShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-panel p-4 shadow-sm shadow-ink/5">{children}</div>
  )
}

function CardHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-display text-base font-bold text-ink">{title}</h2>
      </div>
      <Link to="/planning" className="text-xs font-medium text-accent hover:underline">
        View plan
      </Link>
    </div>
  )
}

function RunningSummary() {
  const { plan } = useRunningPlan()
  const { data } = useRuns()
  const runs: Run[] = data ?? []

  const icon = (
    <span className="grid h-7 w-7 place-items-center rounded-pill bg-accent/10 text-accent">
      <Footprints size={15} strokeWidth={1.8} />
    </span>
  )

  if (!plan) {
    return (
      <CardShell>
        <CardHeader icon={icon} title="Running plan" />
        <p className="text-sm text-ink-muted">
          No running plan yet.{' '}
          <Link to="/planning" className="font-medium text-accent hover:underline">
            Set one up
          </Link>{' '}
          to track your weekly ramp here.
        </p>
      </CardShell>
    )
  }

  const progress = weekProgress(plan, runs)
  const loggedKm = metersToKm(progress.loggedMeters)
  const targetKm = metersToKm(progress.targetMeters)
  const remainingKm = metersToKm(progress.remainingMeters)
  const widthPct = Math.min(100, Math.round(progress.pct * 100))

  return (
    <CardShell>
      <CardHeader icon={icon} title="Running plan" />
      {progress.weekNumber === null ? (
        <p className="text-sm text-ink-muted">Plan complete — nice work. 🎉</p>
      ) : (
        <>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-ink-muted">
                Week {progress.weekNumber} target
              </div>
              <div className="font-display text-2xl font-bold text-ink">{targetKm.toFixed(1)} km</div>
            </div>
            <div className="text-right text-xs text-ink-muted">
              <div>{loggedKm.toFixed(1)} km logged</div>
              {progress.beatTarget ? (
                <div className="font-medium text-success">Target reached 🎉</div>
              ) : (
                <div>{remainingKm.toFixed(1)} km to go</div>
              )}
            </div>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-pill bg-border">
            <div
              className={`h-full rounded-pill ${progress.beatTarget ? 'bg-success' : 'bg-accent'}`}
              style={{ width: `${widthPct}%` }}
            />
          </div>
        </>
      )}
    </CardShell>
  )
}

function WorkoutSummary() {
  const { template } = useWorkoutPlan()
  const todayIndex = new Date().getDay() // 0=Sun … 6=Sat, matches DAY_LABELS
  const today = template[todayIndex] ?? 'rest'

  const icon = (
    <span className="grid h-7 w-7 place-items-center rounded-pill bg-success/10 text-success">
      <CalendarDays size={15} strokeWidth={1.8} />
    </span>
  )

  return (
    <CardShell>
      <CardHeader icon={icon} title="Workout plan" />
      <div className="flex items-center gap-2 text-sm text-ink">
        <span className="text-ink-muted">Today:</span>
        {today === 'run' ? (
          <Footprints size={16} strokeWidth={1.8} className="text-accent" />
        ) : today === 'strength' ? (
          <Dumbbell size={16} strokeWidth={1.8} className="text-success" />
        ) : (
          <Moon size={16} strokeWidth={1.8} className="text-ink-muted" />
        )}
        <span className="font-semibold">{DAY_KIND_LABEL[today]}</span>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1">
        {template.map((kind, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span
              className={`text-[10px] uppercase ${i === todayIndex ? 'font-bold text-ink' : 'text-ink-muted'}`}
            >
              {DAY_LABELS[i]}
            </span>
            <span className={`h-1.5 w-full rounded-pill ${KIND_DOT[kind]}`} />
          </div>
        ))}
      </div>
    </CardShell>
  )
}
