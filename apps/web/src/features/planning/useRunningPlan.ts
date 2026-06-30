import { useCallback, useState } from 'react'
import type { RunningPlanInput } from './plan'

// Client-only persistence. Plans are a personal planning aid that lives in the
// browser — no API/DB table, so nothing else in the app is touched.
const STORAGE_KEY = 'pacer.planning.running'

function load(): RunningPlanInput | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as RunningPlanInput) : null
  } catch {
    return null
  }
}

export function useRunningPlan() {
  const [plan, setPlan] = useState<RunningPlanInput | null>(load)

  const save = useCallback((next: RunningPlanInput) => {
    setPlan(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* storage unavailable (private mode / quota) — keep in-memory state */
    }
  }, [])

  const clear = useCallback(() => {
    setPlan(null)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  return { plan, save, clear }
}
