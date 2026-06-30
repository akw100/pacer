import { useSyncExternalStore } from 'react'

// Whether each plan is pinned to the Home screen. A tiny module-level store so
// the Planning toggles and the Home section share ONE source of truth and stay
// in sync (no split-state races between the two plan cards), persisted to
// localStorage like the plans themselves.

export type PlanKind = 'running' | 'workout'

export interface HomePlanPrefs {
  running: boolean
  workout: boolean
}

const STORAGE_KEY = 'pacer.planning.home'
const DEFAULT: HomePlanPrefs = { running: false, workout: false }

function read(): HomePlanPrefs {
  if (typeof window === 'undefined') return DEFAULT
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT
    const parsed = JSON.parse(raw) as Partial<HomePlanPrefs>
    return { running: !!parsed.running, workout: !!parsed.workout }
  } catch {
    return DEFAULT
  }
}

let current: HomePlanPrefs = read()
const listeners = new Set<() => void>()

function write(next: HomePlanPrefs) {
  current = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable — keep in-memory state */
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// `current` is a stable reference until write() replaces it, so this is a safe
// useSyncExternalStore snapshot.
function getSnapshot(): HomePlanPrefs {
  return current
}

export function useHomePlanPrefs() {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT)

  const setShown = (kind: PlanKind, shown: boolean) => write({ ...current, [kind]: shown })
  const toggle = (kind: PlanKind) => write({ ...current, [kind]: !current[kind] })

  return { prefs, setShown, toggle }
}
