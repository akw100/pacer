import { Hono } from 'hono';
import {
  CreateRaceInputSchema,
  InviteInputSchema,
  JoinInputSchema,
  FinishInputSchema,
  isPlausibleFinish,
} from '@pacer/shared';
import type { AppEnv } from '../lib/auth';
import { broadcast } from '../lib/realtime';
import { logRaceRun, awardRaceWin } from '../lib/race-result';
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
  })

  // Host starts the race: a short synchronized countdown (start_at = now + 5s)
  // so every client begins together. Runners flip joined/ready → racing.
  .post('/:id/start', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const db = serviceClient();
    const { data: race } = await db.from('races').select('*').eq('id', id).maybeSingle();
    if (!race) return c.json({ error: 'not found' }, 404);
    if (race.creator_id !== userId) return c.json({ error: 'host only' }, 403);
    if (race.status !== 'lobby') return c.json({ error: 'not in lobby' }, 409);
    const COUNTDOWN_MS = 5000;
    const startAt = new Date(Date.now() + COUNTDOWN_MS).toISOString();
    await db.from('races').update({ status: 'active', start_at: startAt }).eq('id', id);
    await db
      .from('race_participants')
      .update({ state: 'racing' })
      .eq('race_id', id)
      .eq('role', 'runner')
      .in('state', ['joined', 'ready']);
    void broadcast(`race:${id}`, { type: 'race.started', ids: { raceId: id } });
    return c.json({ start_at: startAt });
  })

  // Host cancels a lobby that never started.
  .post('/:id/cancel', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const db = serviceClient();
    const { data: race } = await db.from('races').select('creator_id, status').eq('id', id).maybeSingle();
    if (!race) return c.json({ error: 'not found' }, 404);
    if (race.creator_id !== userId) return c.json({ error: 'host only' }, 403);
    if (race.status !== 'lobby') return c.json({ error: 'only a lobby can be cancelled' }, 409);
    await db.from('races').update({ status: 'cancelled' }).eq('id', id);
    return c.json({ ok: true });
  })

  // A runner reaches the target. Elapsed is derived server-side from start_at;
  // an implausibly fast finish is rejected as DNF (anti-cheat). The first valid
  // finisher is crowned (winner_id set only while still null), gets a logged run
  // + RACE_WIN bonus; when no runner is still racing the race finishes.
  .post('/:id/finish', zValidator('json', FinishInputSchema), async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const db = serviceClient();
    const { data: race } = await db.from('races').select('*').eq('id', id).maybeSingle();
    if (!race || race.status !== 'active' || !race.start_at) return c.json({ error: 'race not active' }, 409);
    const elapsed = Math.round((Date.now() - new Date(race.start_at).getTime()) / 1000);
    // anti-cheat: impossible average speed ⇒ DNF, never crowned
    if (!isPlausibleFinish(race.target_meters, elapsed)) {
      await db.from('race_participants').update({ state: 'dnf' }).eq('race_id', id).eq('user_id', userId);
      return c.json({ ok: false, reason: 'implausible' }, 422);
    }
    const runId = await logRaceRun(userId, race.target_meters, elapsed);
    await db
      .from('race_participants')
      .update({
        state: 'finished',
        finished_at: new Date().toISOString(),
        elapsed_seconds: elapsed,
        final_meters: body.final_meters,
        manual_finish: body.manual,
        run_id: runId,
      })
      .eq('race_id', id)
      .eq('user_id', userId)
      .eq('state', 'racing');
    // first finisher wins: only set winner if still null
    const { data: updated } = await db
      .from('races')
      .update({ winner_id: userId })
      .eq('id', id)
      .is('winner_id', null)
      .select('winner_id')
      .maybeSingle();
    const won = updated?.winner_id === userId;
    if (won) await awardRaceWin(userId, id);
    // finish the race when no runner is still racing
    const { count } = await db
      .from('race_participants')
      .select('*', { count: 'exact', head: true })
      .eq('race_id', id)
      .eq('state', 'racing');
    if ((count ?? 0) === 0) {
      await db.from('races').update({ status: 'finished', finished_at: new Date().toISOString() }).eq('id', id);
      void broadcast(`race:${id}`, { type: 'race.finished', ids: { raceId: id } });
    } else {
      void broadcast(`race:${id}`, { type: 'race.finished', ids: { raceId: id, finisher: userId } });
    }
    return c.json({ ok: true, won, elapsed });
  })

  // A runner gives up mid-race ⇒ DNF.
  .post('/:id/abandon', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    await serviceClient()
      .from('race_participants')
      .update({ state: 'dnf' })
      .eq('race_id', id)
      .eq('user_id', userId)
      .eq('state', 'racing');
    return c.json({ ok: true });
  });
