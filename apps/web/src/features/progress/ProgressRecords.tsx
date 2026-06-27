import { Award, Flame, Sparkles, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useProgressRecords, type PersonalRecord } from './useProgressRecords'

// Records card — real personal bests derived from the user's own runs,
// workouts and /score/summary streak.

const ICONS: Record<PersonalRecord['label'], LucideIcon> = {
  'Fastest pace': Award,
  'Longest run': TrendingUp,
  'Biggest week': Sparkles,
  'Current streak': Flame,
}

export default function ProgressRecords() {
  const { records, isLoading, isError } = useProgressRecords()

  return (
    <section className="space-y-4 rounded-card border border-border bg-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Records</p>
          <h2 className="mt-2 text-xl font-display font-bold text-ink">Personal bests</h2>
        </div>
        <span className="inline-flex items-center gap-2 rounded-pill bg-accent/10 px-3 py-2 text-sm font-semibold text-accent">
          <Sparkles size={16} /> Lifetime
        </span>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-card bg-ink/5 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-card border border-border bg-surface p-4 text-sm text-ink-muted">
          Couldn't load records. Refresh to retry.
        </div>
      ) : records ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {records.map((record) => {
            const Icon = ICONS[record.label]
            return (
              <div key={record.label} className="rounded-card border border-border bg-surface p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{record.label}</p>
                    <p className="text-2xl font-display font-bold text-ink tabular-nums">
                      {record.value}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-ink-muted">{record.detail}</p>
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
