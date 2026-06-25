import RunningPlanCard from '../features/plans/RunningPlanCard'
import WorkoutPlanCard from '../features/plans/WorkoutPlanCard'

export default function Plans() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 rounded-card border border-border bg-surface p-5 shadow-sm shadow-ink/5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Plans</p>
        <h1 className="mt-2 text-3xl font-display font-bold text-ink">Running & workout plans</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted">
          Manage your weekly running ramp and workout template in one place. This page is built to the Pacer plans spec.
        </p>
      </div>

      <div className="grid gap-6">
        <RunningPlanCard />
        <WorkoutPlanCard />
      </div>
    </div>
  )
}
