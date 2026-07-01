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

// Whether `userId` already has a participant row in `raceId`. Used for the
// membership / invite / participation authorization checks below (all writes go
// through the service client, so each handler must authorize itself).
async function isParticipant(raceId: string, userId: string): Promise<boolean> {
  const { data } = await serviceClient()
    .from('race_participants')
    .select('user_id')
    .eq('race_id', raceId)
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(data);
}

// Close the race once no runner is still `racing` (called after a finish or
// an abandon, since either can empty out the racing pool). Conditional on
// status='active' so the terminal transition can only fire once — a
// concurrent caller who already flipped it gets no rows back.
async function maybeFinishRace(db: ReturnType<typeof serviceClient>, raceId: string): Promise<void> {
  const { count, error } = await db
    .from('race_participants')
    .select('*', { count: 'exact', head: true })
    .eq('race_id', raceId)
    .eq('state', 'racing');
  if (error) return;
  if ((count ?? 0) > 0) return;
  const { data: finishedRows } = await db
    .from('races')
    .update({ status: 'finished', finished_at: new Date().toISOString() })
    .eq('id', raceId)
    .eq('status', 'active')
    .select('id');
  if ((finishedRows?.length ?? 0) > 0) {
    void broadcast(`race:${raceId}`, { type: 'race.finished', ids: { raceId } });
  }
}

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
    const { error: joinError } = await db
      .from('race_participants')
      .insert({ race_id: race.id, user_id: userId, role: 'runner', state: 'joined' });
    if (joinError) {
      await db.from('races').delete().eq('id', race.id);
      return c.json({ error: joinError.message }, 400);
    }
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
    if (!(await isParticipant(id, c.get('userId')))) return c.json({ error: 'not found' }, 404);
    const { data: parts } = await db.from('race_participants').select('*').eq('race_id', id);
    return c.json({ race, participants: parts ?? [] });
  })

  // Invite users into a lobby (idempotent — already-present rows are kept).
  .post('/:id/invite', zValidator('json', InviteInputSchema), async (c) => {
    const id = c.req.param('id');
    const { userIds } = c.req.valid('json');
    const db = serviceClient();
    const { data: race } = await db.from('races').select('creator_id').eq('id', id).maybeSingle();
    if (!race) return c.json({ error: 'not found' }, 404);
    if (race.creator_id !== c.get('userId')) return c.json({ error: 'host only' }, 403);
    const rows = userIds.map((uid) => ({ race_id: id, user_id: uid, role: 'runner', state: 'invited' }));
    const { error } = await db
      .from('race_participants')
      .upsert(rows, { onConflict: 'race_id,user_id', ignoreDuplicates: true });
    if (error) return c.json({ error: error.message }, 400);
    void broadcast(`race:${id}`, { type: 'race.lobby', ids: { raceId: id } });
    return c.json({ ok: true });
  })

  // Join a lobby (as runner or spectator); accepting an invite or self-joining.
  .post('/:id/join', zValidator('json', JoinInputSchema), async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const { role } = c.req.valid('json');
    const db = serviceClient();
    const { data: race } = await db.from('races').select('creator_id, status').eq('id', id).maybeSingle();
    if (!race) return c.json({ error: 'not found' }, 404);
    // Must already have an invite row, or be the race creator.
    if (!(await isParticipant(id, userId)) && race.creator_id !== userId) {
      return c.json({ error: 'not invited' }, 403);
    }
    // The lobby's late-join cutoff: once a race is active, its roster is fixed.
    if (race.status !== 'lobby') return c.json({ error: 'race already started' }, 409);
    const { error } = await db
      .from('race_participants')
      .upsert({ race_id: id, user_id: userId, role, state: 'joined' }, { onConflict: 'race_id,user_id' });
    if (error) return c.json({ error: error.message }, 400);
    void broadcast(`race:${id}`, { type: 'race.lobby', ids: { raceId: id } });
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
    void broadcast(`race:${id}`, { type: 'race.lobby', ids: { raceId: id } });
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
    void broadcast(`race:${id}`, { type: 'race.lobby', ids: { raceId: id } });
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
    // Only a runner who is actually still racing may finish (and thus claim the
    // win + bonus). A non-participant or already-finished/dnf caller is rejected
    // before any winner-claim or award logic runs.
    const { data: me } = await db
      .from('race_participants')
      .select('state')
      .eq('race_id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!me || me.state !== 'racing') return c.json({ error: 'not racing' }, 409);
    const elapsed = Math.round((Date.now() - new Date(race.start_at).getTime()) / 1000);
    // anti-cheat: impossible average speed, or an auto-finish that never
    // actually covered the target distance ⇒ DNF, never crowned
    const reachedTarget = body.manual || body.final_meters >= race.target_meters;
    if (!isPlausibleFinish(race.target_meters, elapsed) || !reachedTarget) {
      await db
        .from('race_participants')
        .update({ state: 'dnf' })
        .eq('race_id', id)
        .eq('user_id', userId)
        .eq('state', 'racing');
      await maybeFinishRace(db, id);
      return c.json({ ok: false, reason: 'implausible' }, 422);
    }
    // Claim the finish atomically (conditioned on state='racing') before doing
    // any side effects — this is what stops two concurrent /finish calls from
    // both logging a run for the same finish.
    const { data: claimed } = await db
      .from('race_participants')
      .update({
        state: 'finished',
        finished_at: new Date().toISOString(),
        elapsed_seconds: elapsed,
        final_meters: body.final_meters,
        manual_finish: body.manual,
      })
      .eq('race_id', id)
      .eq('user_id', userId)
      .eq('state', 'racing')
      .select('user_id')
      .maybeSingle();
    if (!claimed) return c.json({ error: 'not racing' }, 409);
    const runId = await logRaceRun(userId, race.target_meters, elapsed);
    if (!runId) {
      // Logging the run failed. Don't revert to 'racing' — by now another
      // finisher may have already closed the race via maybeFinishRace, and
      // reopening this participant would leave a finished race with a racing
      // participant. Land in the terminal 'dnf' state instead and let the
      // caller retry the finish flow as a fresh attempt if needed.
      await db
        .from('race_participants')
        .update({ state: 'dnf' })
        .eq('race_id', id)
        .eq('user_id', userId);
      await maybeFinishRace(db, id);
      return c.json({ error: 'could not log run' }, 500);
    }
    await db.from('race_participants').update({ run_id: runId }).eq('race_id', id).eq('user_id', userId);
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
    await maybeFinishRace(db, id);
    return c.json({ ok: true, won, elapsed });
  })

  // A runner gives up mid-race ⇒ DNF.
  .post('/:id/abandon', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const db = serviceClient();
    if (!(await isParticipant(id, userId))) return c.json({ error: 'not racing' }, 409);
    await db
      .from('race_participants')
      .update({ state: 'dnf' })
      .eq('race_id', id)
      .eq('user_id', userId)
      .eq('state', 'racing');
    await maybeFinishRace(db, id);
    return c.json({ ok: true });
  })

  // Clone a finished race's roster into a fresh lobby (the caller hosts it).
  .post('/:id/rematch', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const db = serviceClient();
    const { data: prev } = await db.from('races').select('target_meters, status').eq('id', id).maybeSingle();
    if (!prev || prev.status !== 'finished') return c.json({ error: 'only finished races' }, 409);
    if (!(await isParticipant(id, userId))) return c.json({ error: 'not a participant' }, 403);
    const { data: parts } = await db.from('race_participants').select('user_id, role').eq('race_id', id);
    const { data: race } = await db
      .from('races')
      .insert({ creator_id: userId, target_meters: prev.target_meters, rematch_of: id })
      .select('*')
      .single();
    if (!race) return c.json({ error: 'rematch failed' }, 400);
    const rows = (parts ?? []).map((p) => ({
      race_id: race.id,
      user_id: p.user_id,
      role: p.role,
      state: p.user_id === userId ? 'joined' : 'invited',
    }));
    await db.from('race_participants').insert(rows);
    return c.json(race, 201);
  });
