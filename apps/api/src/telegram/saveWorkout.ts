import type { RealtimeEvent } from '@pacer/shared';
import { emit } from '../lib/events';
import { broadcast } from '../lib/realtime';
import { serviceClient } from '../lib/supabase';
import { draftToWorkoutCreate, type WorkoutDraft } from './workoutDraft';

export type SaveResult =
  | { ok: true; workoutId: string }
  | { ok: false; error: string };

/**
 * SEAM: the bot's single workout save path. Mirrors POST /workouts using the
 * service-role client (the bot has no per-user JWT). When the assistant tool
 * layer (P3) lands, replace this body with:
 *   return executeTool('log_workout', draftToWorkoutCreate(draft, today), { userId });
 */
export async function logWorkoutForUser(
  userId: string,
  draft: WorkoutDraft,
  today: string,
): Promise<SaveResult> {
  const { sets, ...rest } = draftToWorkoutCreate(draft, today);
  const db = serviceClient();
  const { data: workout, error } = await db
    .from('workouts')
    .insert({ ...rest, user_id: userId })
    .select('*')
    .single();
  if (error || !workout) return { ok: false, error: error?.message ?? 'insert failed' };

  if (sets && sets.length > 0) {
    const rows = sets.map((s) => ({ ...s, workout_id: workout.id as string }));
    const { error: setsError } = await db.from('workout_sets').insert(rows);
    if (setsError) return { ok: false, error: setsError.message };
  }

  emit('workout.logged', {
    userId,
    workoutId: workout.id as string,
    workoutDate: workout.workout_date as string,
  });
  await fanOut(userId, { type: 'workout.logged', ids: { workoutId: workout.id as string } });
  return { ok: true, workoutId: workout.id as string };
}

// Same best-effort fan-out as routes/workouts.ts: user channel + each group.
async function fanOut(userId: string, event: RealtimeEvent): Promise<void> {
  void broadcast(`user:${userId}`, event);
  const { data } = await serviceClient()
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);
  for (const row of data ?? []) {
    void broadcast(`group:${row.group_id as string}`, event);
  }
}
