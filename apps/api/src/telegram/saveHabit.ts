import type { RealtimeEvent } from '@pacer/shared';
import { emit } from '../lib/events';
import { broadcast } from '../lib/realtime';
import { serviceClient } from '../lib/supabase';

export type HabitResult = { ok: true; habitName: string } | { ok: false; error: string };

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
  return { ok: true, habitName: habit.name as string };
}
