import { useMemo, useState } from 'react'
import { CalendarDays, CircleDot } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useProgressCalendar, type CalendarDay, type DayType } from './useProgressCalendar'

// Real activity calendar for the current month. Dots reflect what the
// user actually logged (runs / workouts / habit checks); empty days are
// honest "No entry".

const dotClasses: Record<DayType, string> = {
  run: 'bg-accent',
  workout: 'bg-success',
  habits: 'bg-streak',
  none: 'bg-transparent',
}

const labels: Record<DayType, string> = {
  run: 'Run',
  workout: 'Workout',
  habits: 'Habits',
  none: 'No entry',
}

export default function ProgressCalendar() {
  const { days, monthLabel, todayKey, summary, isLoading, isError } = useProgressCalendar()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  // Default selection: today (when today's cell is in the current month),
  // otherwise the last real day. Recomputes whenever data changes.
  const selected: CalendarDay | null = useMemo(() => {
    const real = days.filter((d) => !d.isPlaceholder)
    if (real.length === 0) return null
    if (selectedKey) {
      const found = real.find((d) => d.dateKey === selectedKey)
      if (found) return found
    }
    return real.find((d) => d.dateKey === todayKey) ?? real[real.length - 1] ?? null
  }, [days, selectedKey, todayKey])

  if (isLoading) {
    return (
      <section
        aria-label="Loading calendar"
        className="space-y-4 rounded-card border border-border bg-white p-5"
      >
        <div className="h-6 w-40 rounded bg-ink/5 animate-pulse" />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-card bg-ink/5 animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  if (isError) {
    return (
      <section className="rounded-card border border-border bg-white p-5 text-sm text-ink-muted">
        Couldn't load this month's activity. Refresh to retry.
      </section>
    )
  }

  return (
    <section className="space-y-4 rounded-card border border-border bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Calendar</p>
          <h2 className="mt-2 text-xl font-display font-bold text-ink">{monthLabel}</h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-pill bg-surface px-3 py-2 text-sm text-ink-muted">
          <CalendarDays size={16} />
          {days.filter((d) => !d.isPlaceholder).length} days
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.25fr_0.75fr]">
        <div className="grid grid-cols-7 gap-2 rounded-card border border-border bg-surface p-4">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dow, i) => (
            <div
              key={`${dow}-${i}`}
              className="text-center text-xs font-semibold text-ink-muted"
            >
              {dow}
            </div>
          ))}
          {days.map((cell, i) => {
            if (cell.isPlaceholder) {
              return <div key={`pad-${i}`} aria-hidden="true" />
            }
            const isSelected = selected?.dateKey === cell.dateKey
            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => setSelectedKey(cell.dateKey)}
                className={`group flex aspect-square flex-col items-center justify-center rounded-card border px-2 py-1 text-sm transition ${
                  isSelected
                    ? 'border-accent bg-accent/10'
                    : cell.isToday
                      ? 'border-accent/40 hover:border-accent'
                      : 'border-transparent hover:border-border'
                }`}
              >
                <span className="font-semibold text-ink">{cell.day}</span>
                <span
                  aria-hidden="true"
                  className={`mt-2 h-2.5 w-2.5 rounded-full ${dotClasses[cell.type]}`}
                />
              </button>
            )
          })}
        </div>

        <div className="rounded-card border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
            <CircleDot size={16} />
            <span>Selected day</span>
          </div>
          <div className="mt-4 rounded-card border border-border bg-white p-4">
            <p className="text-sm text-ink-muted">
              {selected ? labels[selected.type] : 'No entry'}
            </p>
            <p className="mt-2 text-2xl font-display font-bold text-ink">
              {selected ? format(parseISO(selected.dateKey), 'MMM d, yyyy') : '—'}
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              {selected && selected.type !== 'none'
                ? `You logged ${describe(selected.type)} on this day.`
                : 'Tap a day to see its entries.'}
            </p>
          </div>

          <div className="mt-5 grid gap-3 rounded-card border border-border bg-white p-4">
            <SummaryRow label="Run days" value={summary.runDays} tone="accent" />
            <SummaryRow label="Workout days" value={summary.workoutDays} tone="success" />
            <SummaryRow label="Habit days" value={summary.habitDays} tone="streak" />
          </div>
        </div>
      </div>
    </section>
  )
}

function describe(type: DayType): string {
  switch (type) {
    case 'run':
      return 'a run'
    case 'workout':
      return 'a workout'
    case 'habits':
      return 'one or more habits'
    case 'none':
      return 'nothing'
  }
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'accent' | 'success' | 'streak'
}) {
  const toneClass =
    tone === 'accent'
      ? 'bg-accent/10 text-accent'
      : tone === 'success'
        ? 'bg-success/10 text-success'
        : 'bg-streak/10 text-streak'
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm text-ink-muted">{label}</p>
        <p className="text-xl font-semibold text-ink tabular-nums">{value}</p>
      </div>
      <span className={`rounded-pill px-3 py-2 text-sm font-semibold tabular-nums ${toneClass}`}>
        {value} {value === 1 ? 'day' : 'days'}
      </span>
    </div>
  )
}
