import { useCallback, useState } from 'react'
import { DEFAULT_TEMPLATE, nextDayKind, type DayKind, type WeeklyTemplate } from './plan'

const STORAGE_KEY = 'pacer.planning.workout'

function isTemplate(value: unknown): value is WeeklyTemplate {
  return (
    Array.isArray(value) &&
    value.length === 7 &&
    value.every((d) => d === 'rest' || d === 'run' || d === 'strength')
  )
}

function load(): WeeklyTemplate {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_TEMPLATE
    const parsed: unknown = JSON.parse(raw)
    return isTemplate(parsed) ? parsed : DEFAULT_TEMPLATE
  } catch {
    return DEFAULT_TEMPLATE
  }
}

function persist(template: WeeklyTemplate) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(template))
  } catch {
    /* storage unavailable — keep in-memory state */
  }
}

export function useWorkoutPlan() {
  const [template, setTemplate] = useState<WeeklyTemplate>(load)

  // Tap a day to advance it Rest → Run → Strength → Rest.
  const cycleDay = useCallback((index: number) => {
    setTemplate((current) => {
      const days = [...current] as DayKind[]
      const day = days[index]
      if (day === undefined) return current
      days[index] = nextDayKind(day)
      const next = days as unknown as WeeklyTemplate
      persist(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setTemplate(DEFAULT_TEMPLATE)
    persist(DEFAULT_TEMPLATE)
  }, [])

  return { template, cycleDay, reset }
}
