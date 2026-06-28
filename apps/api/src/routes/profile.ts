import { Hono } from 'hono';
import { ProfileUpdateSchema } from '@pacer/shared';
import type { AppEnv } from '../lib/auth';
import { zValidator } from '../lib/validate';
import { serviceClient } from '../lib/supabase';

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
  })
  // Permanently delete the caller's account. `userId` is server-verified from the
  // JWT — the body is ignored, so a user can only ever delete themselves. Needs the
  // service-role client twice: deleting the profile row cascades every user-owned
  // table (all FK `profiles(id) on delete cascade`), and there's no DELETE policy on
  // profiles for the user client anyway; then we drop the auth identity so the
  // account is fully gone and the email is freed. Irreversible.
  .delete('/me', async (c) => {
    const userId = c.get('userId');
    const admin = serviceClient();

    const { error: dataErr } = await admin.from('profiles').delete().eq('id', userId);
    if (dataErr) {
      return c.json({ error: dataErr.message }, 400);
    }
    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr) {
      return c.json({ error: authErr.message }, 400);
    }
    return c.body(null, 204);
  });
