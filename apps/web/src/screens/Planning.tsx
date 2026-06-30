import RunningPlanCard from '../features/planning/RunningPlanCard'
import WorkoutPlanCard from '../features/planning/WorkoutPlanCard'

export default function Planning() {
  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6 lg:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">Planning</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink">Running &amp; workout plans</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
          Build a graded weekly mileage ramp and a repeatable weekly workout template. Plans are saved
          on this device and stay private to you.
        </p>
      </header>

      <div className="grid gap-6">
        <RunningPlanCard />
        <WorkoutPlanCard />
      </div>
    </div>
  )
}
