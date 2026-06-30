import type { RealtimeEvent } from '@pacer/shared';
import { emit } from '../lib/events';
import { broadcast } from '../lib/realtime';
import { serviceClient } from '../lib/supabase';
import { streakLength } from './streak';

export type HabitResult =
  | { ok: true; habitName: string; streak: number }
  | { ok: false; error: string };

/** SEAM — check off a habit for the user by habit name, for `today` (yyyy-mm-dd). */
export async function checkHabitForUser(userId: string, habitName: string, today: string): Promise<HabitResult> {
  const db = serviceClient();
  const { data: habit } = await db
    .from('habits')
    .select('id, name')
    .eq('user_id', userId)
    .eq('name', habitName)
    .maybeSingle();
  if (!habit) return { ok: false, error: 'habit not found' };

  const { data: check, error } = await db
    .from('habit_checks')
    .insert({ habit_id: habit.id as string, user_id: userId, check_date: today })
    .select('id')
    .single();
  if (error || !check) return { ok: false, error: error?.message ?? 'insert failed' };

  emit('habit.checked', {
    userId,
    habitId: habit.id as string,
    habitCheckId: check.id as string,
    checkDate: today,
  });
  void broadcast(`user:${userId}`, { type: 'habit.checked', ids: { habitId: habit.id as string } } as RealtimeEvent);

  // Current streak: consecutive days ending today with a check for this habit.
  const { data: checkRows } = await db
    .from('habit_checks')
    .select('check_date')
    .eq('habit_id', habit.id as string)
    .order('check_date', { ascending: false });
  const dates = ((checkRows ?? []) as { check_date: string }[]).map((r) => r.check_date);
  const streak = streakLength(dates, today);

  return { ok: true, habitName: habit.name as string, streak };
}

/** SEAM — check off every habit the user has for `today`, skipping any already checked. */
export async function checkAllHabitsForUser(
  userId: string,
  today: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const db = serviceClient();
  const { data: habits, error: habitsError } = await db
    .from('habits')
    .select('id')
    .eq('user_id', userId);
  if (habitsError) return { ok: false, error: habitsError.message };
  const habitIds = ((habits ?? []) as { id: string }[]).map((h) => h.id);
  if (habitIds.length === 0) return { ok: true, count: 0 };

  // Skip habits already checked today to avoid duplicate rows.
  const { data: existing } = await db
    .from('habit_checks')
    .select('habit_id')
    .eq('user_id', userId)
    .eq('check_date', today);
  const alreadyChecked = new Set(((existing ?? []) as { habit_id: string }[]).map((r) => r.habit_id));
  const toInsert = habitIds.filter((id) => !alreadyChecked.has(id));
  if (toInsert.length === 0) return { ok: true, count: 0 };

  const { data: inserted, error } = await db
    .from('habit_checks')
    .insert(toInsert.map((habit_id) => ({ habit_id, user_id: userId, check_date: today })))
    .select('id, habit_id');
  if (error) return { ok: false, error: error.message };

  for (const row of (inserted ?? []) as { id: string; habit_id: string }[]) {
    emit('habit.checked', {
      userId,
      habitId: row.habit_id,
      habitCheckId: row.id,
      checkDate: today,
    });
    void broadcast(`user:${userId}`, {
      type: 'habit.checked',
      ids: { habitId: row.habit_id },
    } as RealtimeEvent);
  }
  return { ok: true, count: (inserted ?? []).length };
}
