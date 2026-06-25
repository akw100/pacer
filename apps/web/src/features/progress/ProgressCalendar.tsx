import { useMemo, useState } from 'react'
import { CalendarDays, CircleDot, Sparkles } from 'lucide-react'

type DayType = 'run' | 'workout' | 'habits' | 'none'

type MonthDate = {
  day: number
  type: DayType
}

const monthDates: MonthDate[] = Array.from({ length: 30 }, (_, index) => 26 - 29 + index).map((day) => ({
  day,
  type: day % 5 === 0 ? 'run' : day % 3 === 0 ? 'workout' : day % 2 === 0 ? 'habits' : 'none',
}))

const dotClasses: Record<DayType, string> = {
  run: 'bg-accent',
  workout: 'bg-success',
  habits: 'bg-streak',
  none: 'bg-transparent',
}

const labels: Record<DayType, string> = {
  run: 'Run',
  workout: 'Workout',
  habits: 'All habits',
  none: 'No entry',
}

export default function ProgressCalendar() {
  const [selectedDay, setSelectedDay] = useState<MonthDate>(monthDates[monthDates.length - 1]!)

  const summary = useMemo(
    () => ({
      runDays: monthDates.filter((item) => item.type === 'run').length,
      workoutDays: monthDates.filter((item) => item.type === 'workout').length,
      fullHabitDays: monthDates.filter((item) => item.type === 'habits').length,
    }),
    [],
  )

  return (
    <section className="space-y-4 rounded-card border border-border bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Calendar</p>
          <h2 className="mt-2 text-xl font-display font-bold text-ink">Month view</h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-pill bg-surface px-3 py-2 text-sm text-ink-muted">
          <CalendarDays size={16} />
          30 days
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.25fr_0.75fr]">
        <div className="grid grid-cols-7 gap-2 rounded-card border border-border bg-surface p-4">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-ink-muted">
              {day}
            </div>
          ))}
          {monthDates.map((date) => (
            <button
              key={date.day}
              type="button"
              onClick={() => setSelectedDay(date)}
              className={`group flex aspect-square flex-col items-center justify-center rounded-card border px-2 py-1 text-sm transition ${
                selectedDay.day === date.day ? 'border-accent bg-accent/10' : 'border-transparent hover:border-border'
              }`}
            >
              <span className="font-semibold text-ink">{date.day}</span>
              <span className={`mt-2 h-2.5 w-2.5 rounded-full ${dotClasses[date.type]}`} />
            </button>
          ))}
        </div>

        <div className="rounded-card border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
            <CircleDot size={16} />
            <span>Selected day</span>
          </div>
          <div className="mt-4 rounded-card border border-border bg-white p-4">
            <p className="text-sm text-ink-muted">{selectedDay.type === 'none' ? 'Nothing logged' : labels[selectedDay.type]}</p>
            <p className="mt-2 text-2xl font-display font-bold text-ink">{selectedDay.day} Jun</p>
            <p className="mt-3 text-sm text-ink-muted">{selectedDay.type === 'none' ? 'Tap a day to see its entries.' : `You logged a ${labels[selectedDay.type].toLowerCase()} session.`}</p>
          </div>

          <div className="mt-5 grid gap-3 rounded-card border border-border bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ink-muted">Run days</p>
                <p className="text-xl font-semibold text-ink">{summary.runDays}</p>
              </div>
              <span className="rounded-pill bg-accent/10 px-3 py-2 text-sm font-semibold text-accent">{summary.runDays} days</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ink-muted">Workout days</p>
                <p className="text-xl font-semibold text-ink">{summary.workoutDays}</p>
              </div>
              <span className="rounded-pill bg-success/10 px-3 py-2 text-sm font-semibold text-success">{summary.workoutDays} days</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ink-muted">All-habits days</p>
                <p className="text-xl font-semibold text-ink">{summary.fullHabitDays}</p>
              </div>
              <span className="rounded-pill bg-streak/10 px-3 py-2 text-sm font-semibold text-streak">{summary.fullHabitDays} days</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
