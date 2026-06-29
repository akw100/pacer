import { Hono } from 'hono';
import {
  CreateChallengeInputSchema,
  UpdateChallengeInputSchema,
  RespondChallengeInputSchema,
  CheckInInputSchema,
  challengeState,
  normalizeYouTubeUrl,
  type ChallengeWithProgress,
  type ParticipantStatus,
} from '@pacer/shared';
import type { AppEnv } from '../lib/auth';
import { broadcast } from '../lib/realtime';
import { serviceClient } from '../lib/supabase';
import { zValidator } from '../lib/validate';
import { computeChallengeProgress, type ParticipantSeed } from '../lib/challenge-progress';

// Challenges slice. Reads groups + activity through the service client (a
// challenge spans many users), so every handler enforces visibility itself —
// mirroring the SQL `can_see_challenge` from migration 0012. Writes are narrow:
// create (creator), respond (own invite), join (open/group), check-in (self).

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface ChallengeRow {
  id: string;
  creator_id: string;
  audience: 'user' | 'group' | 'everyone';
  group_id: string | null;
  metric: ChallengeWithProgress['metric'];
  target: number | string;
  start_date: string;
  end_date: string;
  description: string | null;
  youtube_url: string | null;
  created_at: string;
}

type ProfileBits = { display_name: string; handle: string; avatar_emoji: string | null };

async function myGroupIds(userId: string): Promise<string[]> {
  const { data } = await serviceClient().from('group_members').select('group_id').eq('user_id', userId);
  return (data ?? []).map((r: { group_id: string }) => r.group_id);
}

// Participants of a challenge joined with their profile bits.
async function loadParticipants(challengeId: string): Promise<ParticipantSeed[]> {
  const { data } = await serviceClient()
    .from('challenge_participants')
    .select('user_id, status, profiles!inner(display_name, handle, avatar_emoji)')
    .eq('challenge_id', challengeId);
  type Raw = { user_id: string; status: ParticipantStatus; profiles: ProfileBits };
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    user_id: r.user_id,
    status: r.status,
    display_name: r.profiles.display_name,
    handle: r.profiles.handle,
    avatar_emoji: r.profiles.avatar_emoji,
  }));
}

// Whether `viewer` may see `challenge`, given its participants + the viewer's
// group memberships. Mirrors the can_see_challenge SQL helper.
function canSee(
  challenge: ChallengeRow,
  participants: ParticipantSeed[],
  viewer: string,
  groupIds: string[],
): boolean {
  if (challenge.creator_id === viewer) return true;
  if (challenge.audience === 'everyone') return true;
  if (participants.some((p) => p.user_id === viewer)) return true;
  if (challenge.audience === 'group' && challenge.group_id && groupIds.includes(challenge.group_id)) return true;
  return false;
}

async function buildView(
  challenge: ChallengeRow,
  participants: ParticipantSeed[],
  creator: ProfileBits,
  viewerId: string,
): Promise<ChallengeWithProgress> {
  const leaderboard = await computeChallengeProgress(
    serviceClient(),
    { id: challenge.id, metric: challenge.metric, start_date: challenge.start_date, end_date: challenge.end_date },
    participants,
  );
  const mine = participants.find((p) => p.user_id === viewerId);
  const myRow = leaderboard.find((r) => r.user_id === viewerId);
  return {
    id: challenge.id,
    creator_id: challenge.creator_id,
    audience: challenge.audience,
    group_id: challenge.group_id,
    metric: challenge.metric,
    target: Number(challenge.target),
    start_date: challenge.start_date,
    end_date: challenge.end_date,
    description: challenge.description,
    youtube_url: challenge.youtube_url,
    created_at: challenge.created_at,
    state: challengeState(challenge.start_date, challenge.end_date, todayKey()),
    creator_handle: creator.handle,
    creator_display_name: creator.display_name,
    my_status: mine?.status ?? null,
    my_progress: myRow?.progress ?? 0,
    accepted_count: participants.filter((p) => p.status === 'accepted').length,
    participant_count: participants.filter((p) => p.status !== 'declined').length,
    leaderboard,
  };
}

async function loadCreators(creatorIds: string[]): Promise<Map<string, ProfileBits>> {
  const map = new Map<string, ProfileBits>();
  if (creatorIds.length === 0) return map;
  const { data } = await serviceClient()
    .from('profiles')
    .select('id, display_name, handle, avatar_emoji')
    .in('id', creatorIds);
  for (const p of (data ?? []) as ({ id: string } & ProfileBits)[]) {
    map.set(p.id, { display_name: p.display_name, handle: p.handle, avatar_emoji: p.avatar_emoji });
  }
  return map;
}

// Fetch a single challenge + enforce visibility. Returns null reasons for the
// handler to map to 404/403.
async function loadVisible(
  challengeId: string,
  viewerId: string,
): Promise<
  | { ok: true; challenge: ChallengeRow; participants: ParticipantSeed[] }
  | { ok: false; reason: '404' | '403' }
> {
  const { data: challenge } = await serviceClient()
    .from('challenges')
    .select('*')
    .eq('id', challengeId)
    .maybeSingle();
  if (!challenge) return { ok: false, reason: '404' };
  const participants = await loadParticipants(challengeId);
  const groupIds = await myGroupIds(viewerId);
  if (!canSee(challenge as ChallengeRow, participants, viewerId, groupIds)) {
    return { ok: false, reason: '403' };
  }
  return { ok: true, challenge: challenge as ChallengeRow, participants };
}

function notify(userIds: string[], challengeId: string): void {
  const unique = [...new Set(userIds)];
  for (const id of unique) {
    void broadcast(`user:${id}`, { type: 'challenge.updated', ids: { challengeId, userId: id } });
  }
}

// ── Routes ──────────────────────────────────────────────────────────────────

export const challenges = new Hono<AppEnv>()

  // Every challenge the caller can see: created, participating, open, or in a
  // group they belong to. Each carries its computed state + leaderboard.
  .get('/', async (c) => {
    const userId = c.get('userId');
    const svc = serviceClient();
    const groupIds = await myGroupIds(userId);

    // Challenge ids I participate in.
    const { data: myParts } = await svc
      .from('challenge_participants')
      .select('challenge_id')
      .eq('user_id', userId);
    const participatingIds = (myParts ?? []).map((r: { challenge_id: string }) => r.challenge_id);

    // Pull the candidate rows in a few targeted queries, then dedupe by id.
    const byId = new Map<string, ChallengeRow>();
    const collect = (rows: ChallengeRow[] | null) => {
      for (const r of rows ?? []) byId.set(r.id, r);
    };

    const { data: mineOrOpen } = await svc
      .from('challenges')
      .select('*')
      .or(`creator_id.eq.${userId},audience.eq.everyone`);
    collect(mineOrOpen as ChallengeRow[] | null);

    if (participatingIds.length) {
      const { data } = await svc.from('challenges').select('*').in('id', participatingIds);
      collect(data as ChallengeRow[] | null);
    }
    if (groupIds.length) {
      const { data } = await svc.from('challenges').select('*').eq('audience', 'group').in('group_id', groupIds);
      collect(data as ChallengeRow[] | null);
    }

    const list = [...byId.values()];
    const creators = await loadCreators(list.map((ch) => ch.creator_id));
    const fallback: ProfileBits = { display_name: '—', handle: 'unknown', avatar_emoji: null };

    const views = await Promise.all(
      list.map(async (ch) => {
        const participants = await loadParticipants(ch.id);
        return buildView(ch, participants, creators.get(ch.creator_id) ?? fallback, userId);
      }),
    );

    // Newest first; the web groups them into upcoming/active/finished sections.
    views.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return c.json(views);
  })

  // Create a challenge. `audience` drives the initial participant set.
  .post('/', zValidator('json', CreateChallengeInputSchema), async (c) => {
    const userId = c.get('userId');
    const input = c.req.valid('json');
    const svc = serviceClient();

    // Normalise the optional YouTube url; a present-but-unparseable url is a 422.
    let youtube_url: string | null = null;
    if (input.youtube_url) {
      youtube_url = normalizeYouTubeUrl(input.youtube_url);
      if (!youtube_url) return c.json({ error: 'Not a recognisable YouTube video URL' }, 422);
    }

    // Resolve audience → participant seeds (creator always accepted).
    const invited: { user_id: string; status: ParticipantStatus }[] = [
      { user_id: userId, status: 'accepted' },
    ];
    let group_id: string | null = null;

    if (input.audience === 'user') {
      const { data: target } = await svc
        .from('profiles')
        .select('id')
        .eq('handle', input.target_handle!.toLowerCase())
        .maybeSingle();
      if (!target) return c.json({ error: 'No user with that handle' }, 404);
      if (target.id !== userId) invited.push({ user_id: target.id, status: 'invited' });
    } else if (input.audience === 'group') {
      group_id = input.group_id!;
      // Creator must belong to the group they're challenging.
      const { data: membership } = await svc
        .from('group_members')
        .select('user_id')
        .eq('group_id', group_id)
        .eq('user_id', userId)
        .maybeSingle();
      if (!membership) return c.json({ error: 'You are not a member of that group' }, 403);
      const { data: members } = await svc.from('group_members').select('user_id').eq('group_id', group_id);
      for (const m of (members ?? []) as { user_id: string }[]) {
        if (m.user_id !== userId) invited.push({ user_id: m.user_id, status: 'invited' });
      }
    }

    const { data: challenge, error } = await svc
      .from('challenges')
      .insert({
        creator_id: userId,
        audience: input.audience,
        group_id,
        metric: input.metric,
        target: input.target,
        start_date: input.start_date,
        end_date: input.end_date,
        description: input.description ?? null,
        youtube_url,
      })
      .select('*')
      .single();
    if (error || !challenge) return c.json({ error: error?.message ?? 'Insert failed' }, 400);

    const { error: partErr } = await svc
      .from('challenge_participants')
      .insert(invited.map((p) => ({ challenge_id: challenge.id, user_id: p.user_id, status: p.status })));
    if (partErr) {
      await svc.from('challenges').delete().eq('id', challenge.id); // roll back the orphan
      return c.json({ error: partErr.message }, 400);
    }

    const participants = await loadParticipants(challenge.id);
    const creators = await loadCreators([userId]);
    notify(invited.map((p) => p.user_id), challenge.id);
    const view = await buildView(challenge as ChallengeRow, participants, creators.get(userId)!, userId);
    return c.json(view, 201);
  })

  // Accept or decline an invitation (own participant row only).
  .post('/:id/respond', zValidator('json', RespondChallengeInputSchema), async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    const { status } = c.req.valid('json');
    const visible = await loadVisible(id, userId);
    if (!visible.ok) return c.json({ error: visible.reason === '404' ? 'Not found' : 'Forbidden' }, visible.reason === '404' ? 404 : 403);

    const mine = visible.participants.find((p) => p.user_id === userId);
    if (!mine) return c.json({ error: 'You were not invited to this challenge' }, 403);

    const svc = serviceClient();
    const { error } = await svc
      .from('challenge_participants')
      .update({ status })
      .eq('challenge_id', id)
      .eq('user_id', userId);
    if (error) return c.json({ error: error.message }, 400);

    const participants = await loadParticipants(id);
    const creators = await loadCreators([visible.challenge.creator_id]);
    notify([visible.challenge.creator_id, userId], id);
    return c.json(await buildView(visible.challenge, participants, creators.get(visible.challenge.creator_id)!, userId));
  })

  // Join an open ('everyone') or group challenge.
  .post('/:id/join', async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    const visible = await loadVisible(id, userId);
    if (!visible.ok) return c.json({ error: visible.reason === '404' ? 'Not found' : 'Forbidden' }, visible.reason === '404' ? 404 : 403);
    if (visible.challenge.audience === 'user') return c.json({ error: 'This challenge is invite-only' }, 400);

    const svc = serviceClient();
    const { error } = await svc
      .from('challenge_participants')
      .upsert({ challenge_id: id, user_id: userId, status: 'accepted' }, { onConflict: 'challenge_id,user_id' });
    if (error) return c.json({ error: error.message }, 400);

    const participants = await loadParticipants(id);
    const creators = await loadCreators([visible.challenge.creator_id]);
    notify([visible.challenge.creator_id, userId], id);
    return c.json(await buildView(visible.challenge, participants, creators.get(visible.challenge.creator_id)!, userId));
  })

  // Self-report a check-in (metric = 'check_in' only).
  .post('/:id/check-in', zValidator('json', CheckInInputSchema), async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    const { date } = c.req.valid('json');
    const visible = await loadVisible(id, userId);
    if (!visible.ok) return c.json({ error: visible.reason === '404' ? 'Not found' : 'Forbidden' }, visible.reason === '404' ? 404 : 403);
    if (visible.challenge.metric !== 'check_in') return c.json({ error: 'This challenge is not a check-in challenge' }, 400);

    const checkDate = date ?? todayKey();
    if (checkDate < visible.challenge.start_date || checkDate > visible.challenge.end_date) {
      return c.json({ error: 'Check-in date is outside the challenge window' }, 400);
    }

    const svc = serviceClient();
    // Ensure the caller is a participant (joining an open challenge by checking in).
    if (!visible.participants.some((p) => p.user_id === userId)) {
      if (visible.challenge.audience === 'user') return c.json({ error: 'You are not part of this challenge' }, 403);
      await svc
        .from('challenge_participants')
        .upsert({ challenge_id: id, user_id: userId, status: 'accepted' }, { onConflict: 'challenge_id,user_id' });
    }

    const { error } = await svc
      .from('challenge_check_ins')
      .upsert({ challenge_id: id, user_id: userId, check_date: checkDate }, { onConflict: 'challenge_id,user_id,check_date', ignoreDuplicates: true });
    if (error) return c.json({ error: error.message }, 400);

    const participants = await loadParticipants(id);
    const creators = await loadCreators([visible.challenge.creator_id]);
    notify(participants.map((p) => p.user_id), id);
    return c.json(await buildView(visible.challenge, participants, creators.get(visible.challenge.creator_id)!, userId));
  })

  // Edit a challenge (creator only, before it starts). Audience + participants
  // are fixed at creation; only the rules/content change here.
  .patch('/:id', zValidator('json', UpdateChallengeInputSchema), async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    const body = c.req.valid('json');
    const svc = serviceClient();

    const { data: existing } = await svc.from('challenges').select('*').eq('id', id).maybeSingle();
    if (!existing) return c.json({ error: 'Not found' }, 404);
    if ((existing as ChallengeRow).creator_id !== userId) return c.json({ error: 'Only the creator can edit a challenge' }, 403);
    if (challengeState((existing as ChallengeRow).start_date, (existing as ChallengeRow).end_date, todayKey()) !== 'upcoming') {
      return c.json({ error: 'A challenge can only be edited before it starts' }, 400);
    }

    const patch: Record<string, unknown> = {};
    if (body.metric !== undefined) patch.metric = body.metric;
    if (body.target !== undefined) patch.target = body.target;
    if (body.start_date !== undefined) patch.start_date = body.start_date;
    if (body.end_date !== undefined) patch.end_date = body.end_date;
    if (body.description !== undefined) patch.description = body.description;
    if (body.youtube_url !== undefined) {
      if (body.youtube_url === null) {
        patch.youtube_url = null;
      } else {
        const normalized = normalizeYouTubeUrl(body.youtube_url);
        if (!normalized) return c.json({ error: 'Not a recognisable YouTube video URL' }, 422);
        patch.youtube_url = normalized;
      }
    }
    // Validate the resulting window if either bound changed.
    const newStart = (patch.start_date as string) ?? (existing as ChallengeRow).start_date;
    const newEnd = (patch.end_date as string) ?? (existing as ChallengeRow).end_date;
    if (newEnd < newStart) return c.json({ error: 'end_date must be on or after start_date' }, 422);

    const { data: updated, error } = await svc.from('challenges').update(patch).eq('id', id).select('*').single();
    if (error || !updated) return c.json({ error: error?.message ?? 'Update failed' }, 400);

    const participants = await loadParticipants(id);
    const creators = await loadCreators([userId]);
    notify(participants.map((p) => p.user_id), id);
    return c.json(await buildView(updated as ChallengeRow, participants, creators.get(userId)!, userId));
  })

  // Cancel a challenge (creator only). Cascades delete participants + check-ins
  // via the migration's ON DELETE CASCADE; we notify everyone who was in it.
  .delete('/:id', async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    const svc = serviceClient();
    const { data: challenge } = await svc
      .from('challenges')
      .select('id, creator_id')
      .eq('id', id)
      .maybeSingle();
    if (!challenge) return c.json({ error: 'Not found' }, 404);
    if (challenge.creator_id !== userId) return c.json({ error: 'Only the creator can cancel a challenge' }, 403);

    const participants = await loadParticipants(id);
    const { error } = await svc.from('challenges').delete().eq('id', id);
    if (error) return c.json({ error: error.message }, 400);
    notify(participants.map((p) => p.user_id), id);
    return c.body(null, 204);
  });
