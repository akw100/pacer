import { useMemo, useState } from 'react'
import { ChevronRight, LayoutGrid, Repeat } from 'lucide-react'
import { Button } from '../../components/Button'

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

type WorkoutSlotKind = 'Run' | 'Strength' | 'Rest'

type WorkoutSlot = {
  label: WorkoutSlotKind
  detail: string
}

const defaultSlots: WorkoutSlot[] = [
  { label: 'Run', detail: 'Easy run' },
  { label: 'Strength', detail: 'Strength A' },
  { label: 'Run', detail: 'Tempo run' },
  { label: 'Rest', detail: 'Rest' },
  { label: 'Strength', detail: 'Strength B' },
  { label: 'Run', detail: 'Long run' },
  { label: 'Rest', detail: 'Recovery' },
]

export default function WorkoutPlanCard() {
  const [slots, setSlots] = useState<WorkoutSlot[]>(defaultSlots)
  const [isEditing, setIsEditing] = useState(false)

  const planSummary = useMemo(
    () => ({
      runCount: slots.filter((slot) => slot.label === 'Run').length,
      strengthCount: slots.filter((slot) => slot.label === 'Strength').length,
      restCount: slots.filter((slot) => slot.label === 'Rest').length,
    }),
    [slots],
  )

  const cycleSlot = (index: number) => {
    setSlots((current) =>
      current.map((slot, i) => {
        if (i !== index) return slot
        if (slot.label === 'Run') return { label: 'Strength', detail: 'Strength A' }
        if (slot.label === 'Strength') return { label: 'Rest', detail: 'Rest' }
        return { label: 'Run', detail: 'Easy run' }
      }),
    )
  }

  return (
    <section className="rounded-card border border-border bg-white p-6 shadow-sm shadow-ink/5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Workout plan</p>
          <h2 className="mt-2 text-2xl font-display font-bold text-ink">Weekly template</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
            Build a weekly plan with runs, strength sessions, and rest days. Tap a day to switch the slot type.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setIsEditing((current) => !current)}>
          {isEditing ? 'Done' : 'Edit template'}
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="text-sm text-ink-muted">Run sessions</p>
          <p className="mt-2 text-3xl font-display font-bold text-ink">{planSummary.runCount}</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="text-sm text-ink-muted">Strength sessions</p>
          <p className="mt-2 text-3xl font-display font-bold text-ink">{planSummary.strengthCount}</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="text-sm text-ink-muted">Rest days</p>
          <p className="mt-2 text-3xl font-display font-bold text-ink">{planSummary.restCount}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-7">
        {slots.map((slot, index) => (
          <button
            key={weekdayLabels[index]}
            type="button"
            onClick={() => isEditing && cycleSlot(index)}
            className={`rounded-card border p-4 text-left transition ${
              isEditing ? 'hover:border-accent/60' : 'border-border'
            } ${
              slot.label === 'Run'
                ? 'bg-accent/10 border-accent/20'
                : slot.label === 'Strength'
                ? 'bg-success/10 border-success/20'
                : 'bg-surface border-border'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink">{weekdayLabels[index]}</span>
              {isEditing ? <ChevronRight size={16} /> : null}
            </div>
            <p className="mt-3 text-sm font-semibold text-ink">{slot.label}</p>
            <p className="mt-1 text-sm text-ink-muted">{slot.detail}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-card border border-border bg-accent/10 px-4 py-3 text-sm text-accent">
        <LayoutGrid size={18} />
        <span>Your workout plan syncs with the active week. Tap a day in edit mode to rotate the session type.</span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
        <Repeat size={16} />
        <span>The plan can be updated any time; the active template is always the one used for weekly scheduling.</span>
      </div>
    </section>
  )
}
