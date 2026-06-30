import { differenceInCalendarWeeks, startOfWeek } from 'date-fns'
import { WEEK_START, type Run } from '@pacer/shared'
import { buildRamp, type RunningPlanInput } from './plan'

// 'yyyy-MM-dd' parsed in local time to avoid a UTC off-by-one (same approach as
// the Trends charts).
function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const [, y, mo, d] = m
  if (!y || !mo || !d) return null
  return new Date(Number(y), Number(mo) - 1, Number(d))
}

/** Which 0-based plan week "now" falls in, or null once the plan has ended. */
export function currentPlanWeekIndex(plan: RunningPlanInput, now: Date = new Date()): number | null {
  const idx = differenceInCalendarWeeks(now, new Date(plan.createdAt), { weekStartsOn: WEEK_START })
  if (idx < 0) return 0
  if (idx >= plan.weeks) return null
  return idx
}

export interface WeekProgress {
  /** 1-based plan week, or null if the plan has finished. */
  weekNumber: number | null
  /** Planned volume for the current week, meters (0 once finished). */
  targetMeters: number
  /** Running distance logged in the current calendar week, meters. */
  loggedMeters: number
  remainingMeters: number
  /** loggedMeters / targetMeters (0 when there's no target). */
  pct: number
  /** True once this week's logged distance meets or beats the plan target. */
  beatTarget: boolean
}

export function weekProgress(
  plan: RunningPlanInput,
  runs: Run[],
  now: Date = new Date(),
): WeekProgress {
  const ramp = buildRamp(plan)
  const idx = currentPlanWeekIndex(plan, now)
  const targetMeters = idx === null ? 0 : (ramp[idx]?.weeklyMeters ?? 0)

  const weekStart = startOfWeek(now, { weekStartsOn: WEEK_START })
  let loggedMeters = 0
  for (const r of runs) {
    const d = parseDateKey(r.run_date)
    if (d && d >= weekStart) loggedMeters += r.distance_meters
  }

  return {
    weekNumber: idx === null ? null : idx + 1,
    targetMeters,
    loggedMeters,
    remainingMeters: Math.max(0, targetMeters - loggedMeters),
    pct: targetMeters > 0 ? loggedMeters / targetMeters : 0,
    beatTarget: targetMeters > 0 && loggedMeters >= targetMeters,
  }
}
