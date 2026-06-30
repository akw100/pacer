import { Hono } from 'hono';
import { RunCreateSchema, RunUpdateSchema } from '@pacer/shared';
import type { AppEnv } from '../lib/auth';
import { emit } from '../lib/events';
import { broadcast } from '../lib/realtime';
import { serviceClient } from '../lib/supabase';
import { zValidator } from '../lib/validate';
import type { RealtimeEvent } from '@pacer/shared';

export const runs = new Hono<AppEnv>()

  .get('/', async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    // Optional yyyy-MM-dd window (inclusive). The assistant's get_recent_activity
    // tool relies on these; omitting either bound returns the full list.
    const from = c.req.query('from');
    const to = c.req.query('to');
    let q = db.from('runs').select('*').eq('user_id', userId);
    if (from) q = q.gte('run_date', from);
    if (to) q = q.lte('run_date', to);
    const { data, error } = await q.order('run_date', { ascending: false });
    if (error) return c.json({ error: error.message }, 400);
    return c.json(data);
  })

  .post('/', zValidator('json', RunCreateSchema), async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const { data, error } = await db
      .from('runs')
      .insert({ ...body, user_id: userId })
      .select('*')
      .single();
    if (error) return c.json({ error: error.message }, 400);

    emit('run.logged', { userId, runId: data.id, runDate: data.run_date as string, distanceMeters: Number(data.distance_meters) });
    void fanOut(userId, { type: 'run.logged', ids: { runId: data.id as string } });

    return c.json(data, 201);
  })

  .patch('/:id', zValidator('json', RunUpdateSchema), async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    const id = c.req.param('id');
    const body = c.req.valid('json');
    const { data, error } = await db
      .from('runs')
      .update(body)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) return c.json({ error: error.message }, 400);
    if (!data) return c.json({ error: 'Not found' }, 404);
    return c.json(data);
  })

  .delete('/:id', async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    const id = c.req.param('id');
    const { error } = await db
      .from('runs')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) return c.json({ error: error.message }, 400);
    return c.body(null, 204);
  });

// Broadcast to the user's own channel + every group they belong to.
// Best-effort: query/broadcast errors are swallowed so a realtime hiccup
// never fails the write. group_members may not exist yet — that's safe.
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
