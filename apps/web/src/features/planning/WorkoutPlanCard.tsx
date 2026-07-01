import { useMemo } from 'react'
import { CalendarDays, Dumbbell, Footprints, Home, Moon, RotateCcw } from 'lucide-react'
import { DAY_KIND_LABEL, DAY_LABELS, type DayKind } from './plan'
import { useWorkoutPlan } from './useWorkoutPlan'
import { useHomePlanPrefs } from './useHomePlanPrefs'

const chipButton =
  'inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink'
const chipButtonActive =
  'inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium text-accent bg-accent/10 transition-colors hover:bg-accent/15'

// Token-based styling per kind. `dot` is used in the legend.
const KIND_STYLE: Record<DayKind, { cell: string; dot: string }> = {
  rest: { cell: 'border-border bg-surface text-ink-muted', dot: 'bg-ink-muted' },
  run: { cell: 'border-accent/40 bg-accent/10 text-accent', dot: 'bg-accent' },
  strength: { cell: 'border-success/40 bg-success/10 text-success', dot: 'bg-success' },
}

function KindIcon({ kind, size = 18 }: { kind: DayKind; size?: number }) {
  if (kind === 'run') return <Footprints size={size} strokeWidth={1.8} />
  if (kind === 'strength') return <Dumbbell size={size} strokeWidth={1.8} />
  return <Moon size={size} strokeWidth={1.8} />
}

export default function WorkoutPlanCard() {
  const { template, cycleDay, reset } = useWorkoutPlan()
  const { prefs, toggle } = useHomePlanPrefs()

  const counts = useMemo(() => {
    const c: Record<DayKind, number> = { rest: 0, run: 0, strength: 0 }
    for (const k of template) c[k] += 1
    return c
  }, [template])

  return (
    <section className="rounded-card border border-border bg-panel p-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-pill bg-success/10 text-success">
            <CalendarDays size={18} strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-ink">Workout plan</h2>
            <p className="text-xs text-ink-muted">Tap a day to set Rest → Run → Strength.</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => toggle('workout')}
            aria-pressed={prefs.workout}
            className={prefs.workout ? chipButtonActive : chipButton}
          >
            <Home size={15} strokeWidth={1.8} /> {prefs.workout ? 'On Home' : 'Add to Home'}
          </button>
          <button type="button" onClick={reset} className={chipButton}>
            <RotateCcw size={15} strokeWidth={1.8} /> Reset
          </button>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2">
        {template.map((kind, i) => (
          <button
            key={i}
            type="button"
            onClick={() => cycleDay(i)}
            aria-label={`${DAY_LABELS[i]}: ${DAY_KIND_LABEL[kind]} — tap to change`}
            className={`flex flex-col items-center gap-1.5 rounded-card border px-1 py-3 transition-colors ${KIND_STYLE[kind].cell}`}
          >
            <span className="text-[11px] font-medium uppercase tracking-wide opacity-70">
              {DAY_LABELS[i]}
            </span>
            <KindIcon kind={kind} />
            <span className="text-[11px] font-semibold">{DAY_KIND_LABEL[kind]}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted">
        <Legend kind="run" count={counts.run} />
        <Legend kind="strength" count={counts.strength} />
        <Legend kind="rest" count={counts.rest} />
      </div>
    </section>
  )
}

function Legend({ kind, count }: { kind: DayKind; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-pill ${KIND_STYLE[kind].dot}`} />
      {DAY_KIND_LABEL[kind]} · {count}
      {count === 1 ? ' day' : ' days'}
    </span>
  )
}
