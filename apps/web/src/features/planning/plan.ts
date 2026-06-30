// Pure plan helpers + types for the Planning screen.
//
// Canonical units: distances are stored as METERS (per docs/08-CONVENTIONS.md
// §4). The UI converts km → m on save and derives km via metersToKm at display
// time — we never persist a display value. The weekly ramp is *derived* from
// the saved inputs (a pure function), so there's no stored display state.

import { metersToKm } from '@pacer/shared'

// ── Running plan ───────────────────────────────────────────────────────────

export interface RunningPlanInput {
  /** Current weekly volume, meters. */
  currentWeeklyMeters: number
  /** Goal weekly volume, meters. */
  goalWeeklyMeters: number
  /** Plan length in weeks. */
  weeks: number
  /** Scheduled runs per week. */
  runsPerWeek: number
  /** ISO timestamp the plan was saved. */
  createdAt: string
}

export interface RampWeek {
  /** 1-based week number. */
  week: number
  /** Target volume for the week, meters. */
  weeklyMeters: number
  /** Average distance per scheduled run, meters. */
  perRunMeters: number
  /** True on a cutback (recovery) week. */
  recovery: boolean
}

// A "graded" ramp: linear progression from current → goal with a lighter
// cutback every 4th week (a recovery week), the standard way to ramp mileage
// without piling on fatigue. The final week is never a cutback — it's the peak.
const RECOVERY_EVERY = 4
const RECOVERY_FACTOR = 0.85

export function buildRamp(input: RunningPlanInput): RampWeek[] {
  const weeks = Math.max(1, Math.floor(input.weeks))
  const runs = Math.max(1, Math.floor(input.runsPerWeek))
  const { currentWeeklyMeters: from, goalWeeklyMeters: to } = input

  const ramp: RampWeek[] = []
  for (let i = 0; i < weeks; i++) {
    const t = weeks === 1 ? 1 : i / (weeks - 1)
    let weekly = from + (to - from) * t
    const recovery = (i + 1) % RECOVERY_EVERY === 0 && i + 1 !== weeks
    if (recovery) weekly *= RECOVERY_FACTOR
    const weeklyMeters = Math.max(0, Math.round(weekly))
    ramp.push({
      week: i + 1,
      weeklyMeters,
      perRunMeters: Math.round(weeklyMeters / runs),
      recovery,
    })
  }
  return ramp
}

export interface RampSummary {
  peakWeeklyKm: number
  totalKm: number
  weeks: number
}

export function summarizeRamp(ramp: RampWeek[]): RampSummary {
  let peak = 0
  let total = 0
  for (const w of ramp) {
    if (w.weeklyMeters > peak) peak = w.weeklyMeters
    total += w.weeklyMeters
  }
  return { peakWeeklyKm: metersToKm(peak), totalKm: metersToKm(total), weeks: ramp.length }
}

// ── Weekly workout template ──────────────────────────────────────────────────

export type DayKind = 'rest' | 'run' | 'strength'

/** Cycle order when tapping a day. */
export const DAY_KINDS: readonly DayKind[] = ['rest', 'run', 'strength']

/** A 7-day template, ordered Sunday-first to match the app's WEEK_START. */
export type WeeklyTemplate = readonly [
  DayKind,
  DayKind,
  DayKind,
  DayKind,
  DayKind,
  DayKind,
  DayKind,
]

/** Sunday-first day labels (Pacer starts the week on Sunday everywhere). */
export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export const DEFAULT_TEMPLATE: WeeklyTemplate = [
  'rest',
  'run',
  'strength',
  'run',
  'strength',
  'run',
  'rest',
]

export const DAY_KIND_LABEL: Record<DayKind, string> = {
  rest: 'Rest',
  run: 'Run',
  strength: 'Strength',
}

/** Next kind in the cycle — used when a day cell is tapped. */
export function nextDayKind(kind: DayKind): DayKind {
  const i = DAY_KINDS.indexOf(kind)
  return DAY_KINDS[(i + 1) % DAY_KINDS.length] ?? 'rest'
}
