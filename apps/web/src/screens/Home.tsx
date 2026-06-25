import HabitsSection from '../features/habits/HabitsSection'

export default function Home() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 rounded-card border border-border bg-surface p-5 shadow-sm shadow-ink/5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Today</p>
        <h1 className="mt-2 text-3xl font-display font-bold text-ink">Daily habits & score</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted">
          Your daily ritual lives here. Tap a habit to complete it for today and keep your streak moving.
        </p>
      </div>

      <HabitsSection />
    </div>
  )
}
