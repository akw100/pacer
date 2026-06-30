import { Hono } from 'hono';
import { CreateRaceInputSchema, InviteInputSchema, JoinInputSchema } from '@pacer/shared';
import type { AppEnv } from '../lib/auth';
import { serviceClient } from '../lib/supabase';
import { zValidator } from '../lib/validate';

// Live Race lifecycle. A race spans many users, so every handler reads/writes
// through the service client (RLS on races/race_participants is read-only for
// participants — all writes are server-authoritative here). The creator is the
// host: only they may start or cancel. Live GPS positions are NOT persisted —
// they are browser→browser broadcasts on the race:<id> channel.

export const races = new Hono<AppEnv>()

  // Open a new race lobby for a target distance; the creator joins as a runner.
  .post('/', zValidator('json', CreateRaceInputSchema), async (c) => {
    const userId = c.get('userId');
    const { target_meters } = c.req.valid('json');
    const db = serviceClient();
    const { data: race, error } = await db
      .from('races')
      .insert({ creator_id: userId, target_meters })
      .select('*')
      .single();
    if (error || !race) return c.json({ error: error?.message ?? 'create failed' }, 400);
    await db
      .from('race_participants')
      .insert({ race_id: race.id, user_id: userId, role: 'runner', state: 'joined' });
    return c.json(race, 201);
  })

  // Races the caller participates in, newest first.
  .get('/', async (c) => {
    const userId = c.get('userId');
    const { data } = await serviceClient()
      .from('race_participants')
      .select('race_id, races!inner(*)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false })
      .limit(20);
    return c.json((data ?? []).map((r) => (r as { races: unknown }).races));
  })

  // A single race plus its participant rows.
  .get('/:id', async (c) => {
    const id = c.req.param('id');
    const db = serviceClient();
    const { data: race } = await db.from('races').select('*').eq('id', id).maybeSingle();
    if (!race) return c.json({ error: 'not found' }, 404);
    const { data: parts } = await db.from('race_participants').select('*').eq('race_id', id);
    return c.json({ race, participants: parts ?? [] });
  })

  // Invite users into a lobby (idempotent — already-present rows are kept).
  .post('/:id/invite', zValidator('json', InviteInputSchema), async (c) => {
    const id = c.req.param('id');
    const { userIds } = c.req.valid('json');
    const rows = userIds.map((uid) => ({ race_id: id, user_id: uid, role: 'runner', state: 'invited' }));
    const { error } = await serviceClient()
      .from('race_participants')
      .upsert(rows, { onConflict: 'race_id,user_id', ignoreDuplicates: true });
    if (error) return c.json({ error: error.message }, 400);
    return c.json({ ok: true });
  })

  // Join a lobby (as runner or spectator); accepting an invite or self-joining.
  .post('/:id/join', zValidator('json', JoinInputSchema), async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const { role } = c.req.valid('json');
    const { error } = await serviceClient()
      .from('race_participants')
      .upsert({ race_id: id, user_id: userId, role, state: 'joined' }, { onConflict: 'race_id,user_id' });
    if (error) return c.json({ error: error.message }, 400);
    return c.json({ ok: true });
  })

  // Toggle ready (only meaningful from the joined state).
  .post('/:id/ready', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const { error } = await serviceClient()
      .from('race_participants')
      .update({ state: 'ready' })
      .eq('race_id', id)
      .eq('user_id', userId)
      .eq('state', 'joined');
    if (error) return c.json({ error: error.message }, 400);
    return c.json({ ok: true });
  });
