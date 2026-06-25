import { Hono } from 'hono';
import { ProfileUpdateSchema } from '@pacer/shared';
import type { AppEnv } from '../lib/auth';
import { zValidator } from '../lib/validate';

// The caller's own profile. Reads/writes go through the per-request `userClient`
// so Postgres RLS guarantees a user can only ever touch their own row — the
// route never trusts a body-supplied id.
export const profile = new Hono<AppEnv>()
  .get('/me', async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      return c.json({ error: error.message }, 404);
    }
    return c.json(data);
  })
  .patch('/me', zValidator('json', ProfileUpdateSchema), async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    const updates = c.req.valid('json');
    const { data, error } = await db
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('*')
      .single();
    if (error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json(data);
  });
