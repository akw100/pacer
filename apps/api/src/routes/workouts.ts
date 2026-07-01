import { Hono } from 'hono';
import { WorkoutCreateSchema, WorkoutUpdateSchema } from '@pacer/shared';
import type { AppEnv } from '../lib/auth';
import { emit } from '../lib/events';
import { broadcast } from '../lib/realtime';
import { serviceClient } from '../lib/supabase';
import { zValidator } from '../lib/validate';
import type { RealtimeEvent } from '@pacer/shared';

export const workouts = new Hono<AppEnv>()

  .get('/', async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    // Optional yyyy-MM-dd window (inclusive). The assistant's get_recent_activity
    // tool relies on these; omitting either bound returns the full list.
    const from = c.req.query('from');
    const to = c.req.query('to');
    let q = db.from('workouts').select('*, workout_sets(*)').eq('user_id', userId);
    if (from) q = q.gte('workout_date', from);
    if (to) q = q.lte('workout_date', to);
    const { data, error } = await q.order('workout_date', { ascending: false });
    if (error) return c.json({ error: error.message }, 400);
    return c.json(data);
  })

  .post('/', zValidator('json', WorkoutCreateSchema), async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    const { sets, ...rest } = c.req.valid('json');

    const { data: workout, error } = await db
      .from('workouts')
      .insert({ ...rest, user_id: userId })
      .select('*')
      .single();
    if (error) return c.json({ error: error.message }, 400);

    if (sets && sets.length > 0) {
      const rows = sets.map((s) => ({ ...s, workout_id: workout.id }));
      const { error: setsError } = await db.from('workout_sets').insert(rows);
      if (setsError) return c.json({ error: setsError.message }, 400);
    }

    const { data: full } = await db
      .from('workouts')
      .select('*, workout_sets(*)')
      .eq('id', workout.id)
      .single();

    emit('workout.logged', {
      userId,
      workoutId: workout.id as string,
      workoutDate: workout.workout_date as string,
    });
    void fanOut(userId, { type: 'workout.logged', ids: { workoutId: workout.id as string } });

    return c.json(full ?? workout, 201);
  })

  .patch('/:id', zValidator('json', WorkoutUpdateSchema), async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    const id = c.req.param('id');
    const body = c.req.valid('json');
    // Owner-only by construction: `.eq('user_id', userId)` + RLS on the
    // workouts table. Sets aren't editable via this route (mirrors
    // WorkoutUpdateSchema which omits `sets`). Score-events triggers on
    // the DB handle any score recompute triggered by field changes.
    const { data, error } = await db
      .from('workouts')
      .update(body)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*, workout_sets(*)')
      .single();
    if (error) return c.json({ error: error.message }, 400);
    if (!data) return c.json({ error: 'Not found' }, 404);
    return c.json(data);
  })

  .delete('/:id', async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    const id = c.req.param('id');
    // workout_sets cascade-delete via FK; score_events via trigger in migration
    const { error } = await db
      .from('workouts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) return c.json({ error: error.message }, 400);
    return c.body(null, 204);
  });

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
