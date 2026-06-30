import { useEffect } from 'react'
import { toast } from 'sonner'
import { startOfWeek } from 'date-fns'
import { metersToKm, toDateKey, WEEK_START } from '@pacer/shared'
import { useRunningPlan } from './useRunningPlan'
import { useRuns } from '../logging/useLogging'
import { weekProgress } from './progress'

// Mounted globally (when authenticated) so a run logged from any screen — or
// from the Telegram bot via realtime — triggers the congratulation. Reads the
// runs query (the logging slice's public hook) and the saved plan; fires at
// most once per calendar week, tracked in localStorage.

const STORAGE_KEY = 'pacer.planning.celebrated-week'

function usePlanCelebration() {
  const { plan } = useRunningPlan()
  const { data: runs } = useRuns()

  useEffect(() => {
    if (!plan || !runs) return
    const progress = weekProgress(plan, runs)
    if (!progress.beatTarget) return

    const weekKey = toDateKey(startOfWeek(new Date(), { weekStartsOn: WEEK_START }))
    let lastCelebrated: string | null = null
    try {
      lastCelebrated = window.localStorage.getItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    if (lastCelebrated === weekKey) return

    try {
      window.localStorage.setItem(STORAGE_KEY, weekKey)
    } catch {
      /* ignore */
    }

    toast.success(
      `You beat your running plan this week! ${metersToKm(progress.loggedMeters).toFixed(1)} km ` +
        `logged against a ${metersToKm(progress.targetMeters).toFixed(1)} km target. Nice work! 🎉`,
    )
  }, [plan, runs])
}

export function PlanCelebration() {
  usePlanCelebration()
  return null
}
