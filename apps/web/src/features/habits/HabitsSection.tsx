import { useMemo, useState } from 'react'
import { CheckCircle2, Flame, Sparkles, CalendarDays } from 'lucide-react'
import { scoreFor } from '@pacer/shared'

type LocalHabit = {
  id: string
  userId: string
  name: string
  emoji: string
  sort: number
  createdAt: string
  checkedToday: boolean
  weeklyChecks: string[]
}

const initialHabits: Array<LocalHabit> = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000010',
    name: 'Stretching',
    emoji: '🧘',
    sort: 0,
    createdAt: new Date().toISOString(),
    checkedToday: true,
    weeklyChecks: ['2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21', '2026-06-22', '2026-06-23', '2026-06-24'],
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    userId: '00000000-0000-0000-0000-000000000010',
    name: 'Nutrition',
    emoji: '🥗',
    sort: 1,
    createdAt: new Date().toISOString(),
    checkedToday: true,
    weeklyChecks: ['2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21', '2026-06-22', '2026-06-23', '2026-06-24'],
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    userId: '00000000-0000-0000-0000-000000000010',
    name: 'Hydration',
    emoji: '🥤',
    sort: 2,
    createdAt: new Date().toISOString(),
    checkedToday: false,
    weeklyChecks: ['2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21', '2026-06-22', '2026-06-23'],
  },
]

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function formatDayLabel(dateString: string) {
  const date = new Date(dateString)
  return `${date.getDate()}`
}

function chipValue(value: number) {
  return value.toString().padStart(2, '0')
}

export default function HabitsSection() {
  const [habits, setHabits] = useState(initialHabits)

  const completedToday = habits.filter((habit) => habit.checkedToday).length
  const allDone = completedToday === habits.length
  const todayPoints = useMemo(() => {
    const habitPoints = completedToday * scoreFor({ reason: 'habit' })
    return habitPoints + (allDone ? scoreFor({ reason: 'habit_day_bonus' }) : 0)
  }, [completedToday, allDone])

  const toggleHabit = (habitId: string) => {
    setHabits((current) =>
      current.map((habit) =>
        habit.id === habitId ? { ...habit, checkedToday: !habit.checkedToday } : habit,
      ),
    )
  }

  const firstHabit = habits[0]

  return (
    <section className="space-y-6">
      <div className="rounded-card border border-border bg-surface p-5 shadow-sm shadow-ink/5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Daily ritual</p>
            <h1 className="mt-2 text-2xl font-display font-bold text-ink">Habits & score</h1>
          </div>
          <div className="rounded-pill bg-accent/10 px-3 py-2 text-sm font-semibold text-accent inline-flex items-center gap-2">
            <Sparkles size={16} />
            +{chipValue(todayPoints)} pts possible today
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4 rounded-card border border-border bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-ink">Today</h2>
                <p className="text-sm text-ink-muted">Tap to mark a habit complete.</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-pill bg-success/10 px-3 py-2 text-sm font-semibold text-success">
                <CheckCircle2 size={16} /> {completedToday}/{habits.length} done
              </span>
            </div>

            <div className="space-y-3">
              {habits.map((habit) => (
                <button
                  key={habit.id}
                  type="button"
                  onClick={() => toggleHabit(habit.id)}
                  className={`flex items-center justify-between gap-4 rounded-card border px-4 py-3 text-left transition ${
                    habit.checkedToday
                      ? 'border-success bg-success/10 text-ink'
                      : 'border-border bg-surface text-ink'
                  }`}
                >
                  <span className="text-xl">{habit.emoji}</span>
                  <span className="min-w-0 flex-1 text-sm font-medium">{habit.name}</span>
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">
                    {habit.checkedToday ? 'Done' : 'Tap'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-card border border-border bg-white p-4">
            <div className="flex items-center gap-3">
              <Flame size={20} className="text-streak" />
              <div>
                <p className="text-sm font-semibold text-ink">Streak heat</p>
                <p className="text-lg font-semibold text-ink">6 days in a row</p>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              <div className="rounded-card border border-border bg-surface p-3">
                <p className="text-sm text-ink-muted">Today’s score</p>
                <p className="mt-1 text-3xl font-display font-bold text-ink">+{todayPoints}</p>
              </div>
              <div className="rounded-card border border-border bg-surface p-3">
                <div className="flex items-center gap-2 text-sm text-ink-muted">
                  <CalendarDays size={16} />
                  <span>7-day habit grid</span>
                </div>
                <div className="mt-3 grid grid-cols-7 gap-2 text-center text-xs text-ink-muted">
                  {weekDays.map((day) => (
                    <div key={day} className="font-semibold">{day}</div>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-2 text-center text-sm">
                  {firstHabit?.weeklyChecks.map((dateString: string) => (
                    <div key={dateString} className="flex flex-col items-center gap-1">
                      <span className="text-sm font-semibold text-ink">{formatDayLabel(dateString)}</span>
                      <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-card border border-border bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Habit score</p>
              <h2 className="mt-2 text-xl font-semibold text-ink">Weekly momentum</h2>
            </div>
            <span className="rounded-pill bg-accent/10 px-3 py-2 text-sm font-semibold text-accent">
              {completedToday}/{habits.length} habits
            </span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-card border border-border bg-surface p-4">
              <p className="text-sm text-ink-muted">Habit points</p>
              <p className="mt-2 text-3xl font-display font-bold text-ink">+{completedToday * scoreFor({ reason: 'habit' })}</p>
            </div>
            <div className="rounded-card border border-border bg-surface p-4">
              <p className="text-sm text-ink-muted">All-habits bonus</p>
              <p className="mt-2 text-3xl font-display font-bold text-ink">+2</p>
            </div>
          </div>
        </div>

        <div className="rounded-card border border-border bg-white p-5">
          <div className="flex items-center gap-3">
            <Sparkles size={22} className="text-accent" />
            <div>
              <p className="text-sm font-semibold text-ink-muted">Habit rhythm</p>
              <p className="mt-1 text-lg font-semibold text-ink">4 of 7 days complete</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            <div className="rounded-card border border-border bg-surface p-4">
              <p className="text-sm text-ink-muted">This week</p>
              <p className="mt-2 text-2xl font-display font-bold text-ink">18 pts</p>
            </div>
            <div className="rounded-card border border-border bg-surface p-4">
              <p className="text-sm text-ink-muted">Next milestone</p>
              <p className="mt-2 text-base font-semibold text-ink">Complete every habit tomorrow</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
