import { useMemo, useState } from 'react'
import { CheckCircle2, Circle, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { scoreFor, toDateKey } from '@pacer/shared'
import { toast } from 'sonner'
import {
  useCheckHabit,
  useCreateHabit,
  useDeleteHabit,
  useHabitChecksForDate,
  useHabits,
  useUncheckHabit,
} from './useHabits'

// HabitsSection — real data only. Reads habits from GET /habits and today's
// `habit_checks` directly from Supabase (own-rows RLS). Toggling a row
// persists via PUT/DELETE /habits/:id/check?date=today. Adding a habit
// hits POST /habits. No hardcoded counts, no fake streaks, no fake weekly
// scores: side cards that previously showed mock numbers are gone.

const EMOJI_PALETTE = ['🧘', '🥗', '🥤', '😴', '📚', '💪', '🚶', '🧹', '🎯', '✨']

export default function HabitsSection() {
  const habits = useHabits()
  // `todayKey` is the max the date picker will accept — future is blocked.
  const todayKey = toDateKey(new Date())
  const [selectedDate, setSelectedDate] = useState<string>(todayKey)
  const isToday = selectedDate === todayKey
  const checks = useHabitChecksForDate(selectedDate)
  const create = useCreateHabit()
  const check = useCheckHabit(selectedDate)
  const uncheck = useUncheckHabit(selectedDate)
  const remove = useDeleteHabit()

  const [adding, setAdding] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftEmoji, setDraftEmoji] = useState<string>(EMOJI_PALETTE[0]!)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const checkedIds = useMemo(
    () => new Set((checks.data ?? []).map((c) => c.habit_id)),
    [checks.data],
  )
  const rows = habits.data ?? []
  const total = rows.length
  const done = rows.filter((h) => checkedIds.has(h.id)).length
  const allDone = total > 0 && done === total
  const todayPoints =
    done * scoreFor({ reason: 'habit' }) +
    (allDone ? scoreFor({ reason: 'habit_day_bonus' }) : 0)

  async function submitNewHabit() {
    const name = draftName.trim()
    if (!name) return
    try {
      await create.mutateAsync({ name, emoji: draftEmoji })
      toast.success(`Added "${name}"`)
      setDraftName('')
      setDraftEmoji(EMOJI_PALETTE[0]!)
      setAdding(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add habit')
    }
  }

  async function toggleHabit(habitId: string) {
    const isChecked = checkedIds.has(habitId)
    try {
      if (isChecked) {
        await uncheck.mutateAsync(habitId)
      } else {
        await check.mutateAsync(habitId)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update')
    }
  }

  async function deleteHabit(habitId: string) {
    try {
      await remove.mutateAsync(habitId)
      toast.success('Habit removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete')
    } finally {
      setConfirmDeleteId(null)
    }
  }

  if (habits.isLoading) {
    return (
      <section
        aria-label="Loading habits"
        className="rounded-card border border-border bg-surface p-5 shadow-sm"
      >
        <div className="h-5 w-32 rounded bg-ink/10 animate-pulse" />
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-card bg-ink/5 animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  if (habits.isError) {
    return (
      <section className="rounded-card border border-accent/30 bg-accent/5 p-4 text-sm text-ink">
        Couldn't load habits. Refresh to retry.
      </section>
    )
  }

  return (
    <section
      aria-labelledby="habits-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-4"
    >
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 id="habits-heading" className="font-display text-lg font-semibold text-ink">
            Daily habits
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            Tap to mark complete for the selected day. Streak is shared with your weekly score.
          </p>
        </div>
        {total > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent">
            <Sparkles size={12} strokeWidth={2} />
            +{todayPoints} pts possible {isToday ? 'today' : 'on this day'}
          </span>
        )}
      </header>

      {/* Date picker — default today, past dates allowed, future blocked
          via max={todayKey}. Persists real habit_checks for the selected
          date through the same PUT/DELETE API. */}
      <div className="flex items-center gap-2">
        <label htmlFor="habit-date" className="text-xs font-medium text-ink-muted shrink-0">
          Day
        </label>
        <input
          id="habit-date"
          type="date"
          value={selectedDate}
          max={todayKey}
          onChange={(e) => {
            const next = e.target.value
            if (next && next <= todayKey) setSelectedDate(next)
          }}
          className="rounded-pill border border-border bg-surface px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-accent"
        />
        {!isToday && (
          <button
            type="button"
            onClick={() => setSelectedDate(todayKey)}
            className="rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink hover:bg-ink/5"
          >
            Today
          </button>
        )}
      </div>

      {total === 0 && !adding && (
        <EmptyState onAdd={() => setAdding(true)} />
      )}

      {total > 0 && (
        <ul role="list" className="flex flex-col gap-2">
          {rows.map((habit) => {
            const isChecked = checkedIds.has(habit.id)
            const isConfirming = confirmDeleteId === habit.id
            return (
              <li key={habit.id}>
                <div
                  className={`group flex items-center gap-3 rounded-card border px-3 py-2.5 transition-colors ${
                    isChecked
                      ? 'border-success/30 bg-success/10'
                      : 'border-border bg-surface'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleHabit(habit.id)}
                    aria-label={`${habit.name}: ${isChecked ? 'mark not done' : 'mark done'}`}
                    aria-pressed={isChecked}
                    className="flex-1 flex items-center gap-3 text-left focus:outline-none focus:ring-2 focus:ring-accent/40 rounded-card"
                  >
                    <span
                      aria-hidden="true"
                      className={`grid place-items-center w-9 h-9 rounded-pill shrink-0 ${
                        isChecked ? 'bg-success/20 text-success' : 'bg-ink/5 text-ink-muted'
                      }`}
                    >
                      {isChecked ? (
                        <CheckCircle2 size={18} strokeWidth={1.8} />
                      ) : (
                        <Circle size={18} strokeWidth={1.8} />
                      )}
                    </span>
                    <span aria-hidden="true" className="text-xl">{habit.emoji}</span>
                    <span className="text-sm font-medium text-ink truncate">{habit.name}</span>
                  </button>

                  {isConfirming ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-pill text-xs text-ink-muted hover:bg-ink/5 px-2 py-1"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteHabit(habit.id)}
                        className="rounded-pill bg-accent text-white px-2.5 py-1 text-xs font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Delete ${habit.name}`}
                      onClick={() => setConfirmDeleteId(habit.id)}
                      className="p-1.5 rounded-pill text-ink-muted hover:text-accent hover:bg-accent/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} strokeWidth={1.8} />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {adding ? (
        <div className="rounded-card border border-accent/30 bg-accent/5 p-3 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              autoFocus
              placeholder="e.g. Stretching"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitNewHabit()
                else if (e.key === 'Escape') {
                  setAdding(false)
                  setDraftName('')
                }
              }}
              className="flex-1 rounded-pill border border-border bg-surface px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={submitNewHabit}
              disabled={create.isPending || !draftName.trim()}
              className="rounded-pill bg-accent text-white px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
            >
              {create.isPending ? 'Adding…' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setDraftName('')
              }}
              aria-label="Cancel"
              className="p-1.5 rounded-pill text-ink-muted hover:text-ink hover:bg-ink/5"
            >
              <X size={14} strokeWidth={1.8} />
            </button>
          </div>
          <div role="radiogroup" aria-label="Habit emoji" className="flex flex-wrap gap-1">
            {EMOJI_PALETTE.map((emoji) => {
              const active = draftEmoji === emoji
              return (
                <button
                  key={emoji}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setDraftEmoji(emoji)}
                  className={`w-9 h-9 rounded-pill text-lg transition-colors ${
                    active ? 'bg-accent/20 ring-2 ring-accent' : 'bg-ink/5 hover:bg-ink/10'
                  }`}
                >
                  {emoji}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        total > 0 && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="self-start inline-flex items-center gap-1 rounded-pill border border-dashed border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink hover:bg-ink/5"
          >
            <Plus size={12} strokeWidth={2.2} />
            Add habit
          </button>
        )
      )}
    </section>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-card border border-dashed border-border bg-surface p-6 text-center flex flex-col items-center gap-3">
      <span className="grid place-items-center w-12 h-12 rounded-full bg-accent/10 text-accent">
        <Sparkles size={20} strokeWidth={1.8} />
      </span>
      <div>
        <div className="font-display text-base font-semibold text-ink">
          Start your daily ritual
        </div>
        <p className="mt-1 text-xs text-ink-muted leading-relaxed max-w-xs">
          Add habits like Stretching, Nutrition or Hydration. Tap to mark them done each day to
          build your streak.
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-pill bg-accent text-white px-4 py-2 text-sm font-semibold shadow-sm shadow-accent/20"
      >
        <Plus size={14} strokeWidth={2.2} />
        Add your first habit
      </button>
    </div>
  )
}
