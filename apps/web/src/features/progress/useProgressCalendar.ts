import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from 'date-fns';
import { toDateKey } from '@pacer/shared';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { useRuns, useWorkouts } from '../logging/useLogging';

// Current-month activity calendar. Three real sources:
//   • /runs?from=&to=   (existing API)
//   • /workouts?from=&to= (existing API)
//   • habit_checks via supabase-js own-rows SELECT — same RLS-safe pattern
//     useTodayChecks uses, just with a date range instead of a single day.
//
// No new backend and no migration. If habit_checks is empty for the
// month, calendar dots just don't show 'habits' — that's the honest
// state, not a workaround.

export type DayType = 'run' | 'workout' | 'habits' | 'none';

export interface CalendarDay {
  /** yyyy-MM-dd for real days; empty string for pre-month padding cells. */
  dateKey: string;
  /** Day-of-month number (1..31) for real days; 0 for placeholders. */
  day: number;
  type: DayType;
  isPlaceholder?: boolean;
  isToday?: boolean;
}

interface HabitCheckRow {
  id: string;
  user_id: string;
  habit_id: string;
  check_date: string;
}

interface UseProgressCalendarResult {
  /** Cells in render order — placeholders first (to pad the first week to
   *  Monday-start), then the real days of the current month. */
  days: CalendarDay[];
  monthLabel: string;
  todayKey: string;
  summary: { runDays: number; workoutDays: number; habitDays: number };
  isLoading: boolean;
  isError: boolean;
}

export function useProgressCalendar(): UseProgressCalendarResult {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const monthStartKey = toDateKey(monthStart);
  const monthEndKey = toDateKey(monthEnd);
  const todayKey = toDateKey(today);

  const runs = useRuns({ from: monthStartKey, to: monthEndKey });
  const workouts = useWorkouts({ from: monthStartKey, to: monthEndKey });
  const habitChecks = useMonthHabitChecks(monthStartKey, monthEndKey);

  const days = useMemo<CalendarDay[]>(() => {
    if (!runs.data || !workouts.data || !habitChecks.data) return [];

    const runDates = new Set(runs.data.map((r) => r.run_date));
    const workoutDates = new Set(workouts.data.map((w) => w.workout_date));
    const habitDates = new Set(habitChecks.data.map((h) => h.check_date));

    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Pre-month padding so the first row of the calendar aligns to a
    // Monday-start week. JS Date.getDay() returns 0..6 with 0=Sunday;
    // convert to Monday-based 0..6 with 0=Monday.
    const firstDow = getDay(monthStart);
    const mondayBasedDow = firstDow === 0 ? 6 : firstDow - 1;
    const padding: CalendarDay[] = Array.from({ length: mondayBasedDow }, () => ({
      dateKey: '',
      day: 0,
      type: 'none',
      isPlaceholder: true,
    }));

    const real = monthDays.map((d): CalendarDay => {
      const key = toDateKey(d);
      // Priority: run > workout > habits. A single dot is rendered per
      // day, so we surface the "biggest" activity for visual clarity.
      let type: DayType = 'none';
      if (runDates.has(key)) type = 'run';
      else if (workoutDates.has(key)) type = 'workout';
      else if (habitDates.has(key)) type = 'habits';
      return { dateKey: key, day: d.getDate(), type, isToday: key === todayKey };
    });

    return [...padding, ...real];
  }, [runs.data, workouts.data, habitChecks.data, monthStart, monthEnd, todayKey]);

  const summary = useMemo(
    () => ({
      runDays: days.filter((d) => !d.isPlaceholder && d.type === 'run').length,
      workoutDays: days.filter((d) => !d.isPlaceholder && d.type === 'workout').length,
      habitDays: days.filter((d) => !d.isPlaceholder && d.type === 'habits').length,
    }),
    [days],
  );

  return {
    days,
    monthLabel: format(today, 'MMMM yyyy'),
    todayKey,
    summary,
    isLoading: runs.isLoading || workouts.isLoading || habitChecks.isLoading,
    isError: runs.isError || workouts.isError || habitChecks.isError,
  };
}

/**
 * Direct supabase-js SELECT against `habit_checks` for the current month.
 * `habit_checks` has own-rows RLS (see migration 0002_habits_scoring.sql),
 * so the anon JWT + user_id filter is enough — no service-role surface in
 * the browser. Mirrors the pattern useTodayChecks established.
 */
function useMonthHabitChecks(start: string, end: string) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  return useQuery<HabitCheckRow[]>({
    queryKey: ['habits', 'checks', 'month', start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('habit_checks')
        .select('id, user_id, habit_id, check_date')
        .eq('user_id', userId!)
        .gte('check_date', start)
        .lte('check_date', end);
      if (error) throw new Error(error.message);
      return (data ?? []) as HabitCheckRow[];
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}
