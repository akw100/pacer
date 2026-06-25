import { startOfWeek, endOfWeek, isWithinInterval, format, subDays } from 'date-fns';
import type { WeekStart } from './types';

// Week-start is configurable per profile (0 = Sunday, 1 = Monday). All helpers
// are pure — the caller fetches the data (e.g. the active-date list for streaks).

export function weekRange(date: Date, weekStart: WeekStart): { start: Date; end: Date } {
  return {
    start: startOfWeek(date, { weekStartsOn: weekStart }),
    end: endOfWeek(date, { weekStartsOn: weekStart }),
  };
}

export function isInCurrentWeek(date: Date, weekStart: WeekStart, now: Date = new Date()): boolean {
  const { start, end } = weekRange(now, weekStart);
  return isWithinInterval(date, { start, end });
}

/** 'yyyy-MM-dd' — the key shape used by run_date / check_date columns. */
export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Consecutive days with activity ending today (today inclusive). Returns 0 if
 * there's no activity today, so the streak "breaks" the day it's missed.
 * Powers the streak flame and the +10 streak event.
 */
export function streakLength(activeDateKeys: string[], now: Date = new Date()): number {
  const active = new Set(activeDateKeys);
  let streak = 0;
  let cursor = now;
  while (active.has(toDateKey(cursor))) {
    streak++;
    cursor = subDays(cursor, 1);
  }
  return streak;
}
