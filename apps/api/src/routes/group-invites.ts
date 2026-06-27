import { Hono } from 'hono';
import {
  CreateGroupInviteInputSchema,
  type FriendProfile,
  type GroupInvite,
  type GroupInviteWithProfiles,
} from '@pacer/shared';
import type { AppEnv } from '../lib/auth';
import { serviceClient } from '../lib/supabase';
import { zValidator } from '../lib/validate';

// Group invites — pending requests from a group member to one of their
// accepted friends. Two Hono routers are exported from this file so they
// can be mounted under different prefixes in `routes/index.ts`:
//
//   • groupInvitesUnderGroup → mounted at `/groups/:id/invites`
//       - POST /  → create (caller invites a friend to :id)
//       - GET  /  → list pending invites for :id (owner sees all; inviter
//                   sees own; other members see nothing — same shape as RLS)
//   • groupInvitesActions    → mounted at `/group-invites`
//       - GET    /me                → pending invites I (the caller) received
//       - POST   /:inviteId/accept  → invited_user only; idempotent
//       - POST   /:inviteId/decline → invited_user only
//       - DELETE /:inviteId         → invited_by only; cancels pending
//
// Trust model (mirrors 0007_group_invites.sql):
//   • RLS denies all direct client writes — there are NO INSERT/UPDATE/
//     DELETE policies on `group_invites`. All mutations here run through
//     `serviceClient()` AFTER:
//       1. requireAuth populated `c.get('userId')` from the JWT.
//       2. The handler verified membership / friendship / target state.
//   • Identity-bearing columns (invited_by, status) are set server-side
//     from the JWT and the route — NEVER from the request body.
//   • The accept handler is RACE-SAFE: if the invited_user is already a
//     member (e.g. joined via join_code), `group_members` UPSERT with
//     `ignoreDuplicates` is a no-op and the invite is still marked
//     accepted, returning 200. The /me list stays clean.

// ── Shared helpers ─────────────────────────────────────────────────────────

const PROFILE_PROJECTION = 'id, handle, display_name, avatar_emoji' as const;

interface ProfileRow {
  id: string;
  handle: string;
  display_name: string;
  avatar_emoji: string | null;
}

function toFriendProfile(p: ProfileRow): FriendProfile {
  return {
    id: p.id,
    handle: p.handle,
    display_name: p.display_name,
    avatar_emoji: p.avatar_emoji,
  };
}

async function assertMember(
  groupId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; reason: '403' | '404' }> {
  const svc = serviceClient();
  const { data: group } = await svc
    .from('groups')
    .select('id')
    .eq('id', groupId)
    .maybeSingle();
  if (!group) return { ok: false, reason: '404' };
  const { data: membership } = await svc
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!membership) return { ok: false, reason: '403' };
  return { ok: true };
}

async function isMember(groupId: string, userId: string): Promise<boolean> {
  const svc = serviceClient();
  const { data } = await svc
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

async function getGroupOwner(groupId: string): Promise<string | null> {
  const svc = serviceClient();
  const { data } = await svc
    .from('groups')
    .select('owner_id')
    .eq('id', groupId)
    .maybeSingle();
  return (data?.owner_id as string | undefined) ?? null;
}

async function areAcceptedFriends(a: string, b: string): Promise<boolean> {
  const svc = serviceClient();
  const { data } = await svc.rpc('friends_with', { a, b });
  return data === true;
}

/**
 * Decorate raw invite rows with the inviter / invited / group_name fields
 * that the API contract returns. One round-trip per call by `.in()`-ing the
 * profile and group ids.
 */
async function decorateInvites(rows: GroupInvite[]): Promise<GroupInviteWithProfiles[]> {
  if (rows.length === 0) return [];
  const svc = serviceClient();

  const profileIds = new Set<string>();
  const groupIds = new Set<string>();
  for (const r of rows) {
    profileIds.add(r.invited_by);
    profileIds.add(r.invited_user);
    groupIds.add(r.group_id);
  }

  const [profilesRes, groupsRes] = await Promise.all([
    svc.from('profiles').select(PROFILE_PROJECTION).in('id', Array.from(profileIds)),
    svc.from('groups').select('id, name').in('id', Array.from(groupIds)),
  ]);

  const profileById = new Map<string, ProfileRow>();
  for (const p of (profilesRes.data ?? []) as ProfileRow[]) profileById.set(p.id, p);

  const groupNameById = new Map<string, string>();
  for (const g of (groupsRes.data ?? []) as { id: string; name: string }[]) {
    groupNameById.set(g.id, g.name);
  }

  const out: GroupInviteWithProfiles[] = [];
  for (const r of rows) {
    const inviter = profileById.get(r.invited_by);
    const invited = profileById.get(r.invited_user);
    const groupName = groupNameById.get(r.group_id);
    if (!inviter || !invited || groupName == null) continue; // defensive
    out.push({
      ...r,
      group_name: groupName,
      inviter: toFriendProfile(inviter),
      invited: toFriendProfile(invited),
    });
  }
  return out;
}

async function fetchInviteById(inviteId: string): Promise<GroupInvite | null> {
  const svc = serviceClient();
  const { data } = await svc
    .from('group_invites')
    .select('*')
    .eq('id', inviteId)
    .maybeSingle();
  return (data as GroupInvite | null) ?? null;
}

// ── Router A: mounted under /groups/:id/invites ───────────────────────────

export const groupInvitesUnderGroup = new Hono<AppEnv>()

  // Create an invite from the caller (inviter) to a friend. The friend must
  // be an accepted connection and must not already be a member of :id.
  .post('/', zValidator('json', CreateGroupInviteInputSchema), async (c) => {
    const callerId = c.get('userId');
    const groupId = c.req.param('id')!;
    const { invited_user_id } = c.req.valid('json');

    const member = await assertMember(groupId, callerId);
    if (!member.ok) {
      return c.json(
        { error: member.reason === '404' ? 'Not found' : 'Forbidden' },
        member.reason === '404' ? 404 : 403,
      );
    }

    if (invited_user_id === callerId) {
      return c.json({ error: 'Cannot invite yourself' }, 400);
    }

    if (!(await areAcceptedFriends(callerId, invited_user_id))) {
      return c.json(
        { error: 'You can only invite accepted friends' },
        403,
      );
    }

    if (await isMember(groupId, invited_user_id)) {
      return c.json({ error: 'User is already a group member' }, 409);
    }

    const svc = serviceClient();
    const { data: inserted, error: insertErr } = await svc
      .from('group_invites')
      .insert({
        group_id: groupId,
        invited_by: callerId,
        invited_user: invited_user_id,
        status: 'pending',
      })
      .select('*')
      .single();

    // Partial unique index on (group_id, invited_user) WHERE status='pending'
    // catches a race or duplicate request — return the existing pending row
    // idempotently so the client gets a stable result either way.
    if (insertErr) {
      const code = (insertErr as { code?: string }).code;
      if (code === '23505') {
        const { data: existing } = await svc
          .from('group_invites')
          .select('*')
          .eq('group_id', groupId)
          .eq('invited_user', invited_user_id)
          .eq('status', 'pending')
          .maybeSingle();
        if (existing) {
          const decorated = await decorateInvites([existing as GroupInvite]);
          if (decorated.length) return c.json(decorated[0]!, 200);
        }
        return c.json({ error: 'A pending invite already exists' }, 409);
      }
      return c.json({ error: insertErr.message }, 400);
    }
    if (!inserted) return c.json({ error: 'Insert failed' }, 400);

    const decorated = await decorateInvites([inserted as GroupInvite]);
    if (!decorated.length) return c.json({ error: 'Invite shape invalid' }, 500);
    return c.json(decorated[0]!, 201);
  })

  // List pending invites for :id. Returns the subset visible to the caller:
  //   • group owner → all pending invites
  //   • inviter (non-owner member) → only their outgoing invites
  //   • other members → empty array
  // Same shape as the RLS policy on `group_invites`.
  .get('/', async (c) => {
    const callerId = c.get('userId');
    const groupId = c.req.param('id')!;

    const member = await assertMember(groupId, callerId);
    if (!member.ok) {
      return c.json(
        { error: member.reason === '404' ? 'Not found' : 'Forbidden' },
        member.reason === '404' ? 404 : 403,
      );
    }

    const ownerId = await getGroupOwner(groupId);
    const isOwner = ownerId === callerId;

    const svc = serviceClient();
    let query = svc
      .from('group_invites')
      .select('*')
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!isOwner) {
      query = query.eq('invited_by', callerId);
    }

    const { data, error } = await query;
    if (error) return c.json({ error: error.message }, 400);

    const decorated = await decorateInvites((data ?? []) as GroupInvite[]);
    return c.json(decorated);
  });

// ── Router B: mounted under /group-invites ────────────────────────────────

export const groupInvitesActions = new Hono<AppEnv>()

  // My pending invites (received as invited_user).
  .get('/me', async (c) => {
    const callerId = c.get('userId');
    const svc = serviceClient();
    const { data, error } = await svc
      .from('group_invites')
      .select('*')
      .eq('invited_user', callerId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) return c.json({ error: error.message }, 400);
    const decorated = await decorateInvites((data ?? []) as GroupInvite[]);
    return c.json(decorated);
  })

  // Accept a pending invite. RACE-SAFE: if invited_user already joined via
  // join_code (or otherwise), the upsert is a no-op and we still mark the
  // invite accepted so the caller's /me list stays clean.
  .post('/:inviteId/accept', async (c) => {
    const callerId = c.get('userId');
    const inviteId = c.req.param('inviteId')!;

    const invite = await fetchInviteById(inviteId);
    if (!invite) return c.json({ error: 'Not found' }, 404);
    if (invite.invited_user !== callerId) return c.json({ error: 'Forbidden' }, 403);
    if (invite.status !== 'pending') return c.json({ error: 'Not pending' }, 409);

    const svc = serviceClient();

    // 1) UPSERT membership. Composite PK on (group_id, user_id) means the
    //    onConflict target is satisfied; ignoreDuplicates makes the
    //    no-op-on-existing case a clean success.
    const { error: memberErr } = await svc
      .from('group_members')
      .upsert(
        { group_id: invite.group_id, user_id: callerId },
        { onConflict: 'group_id,user_id', ignoreDuplicates: true },
      );
    if (memberErr) return c.json({ error: memberErr.message }, 400);

    // 2) Mark the invite consumed.
    const { data: updated, error: updateErr } = await svc
      .from('group_invites')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', inviteId)
      .select('*')
      .single();
    if (updateErr || !updated) {
      return c.json({ error: updateErr?.message ?? 'Update failed' }, 400);
    }

    const decorated = await decorateInvites([updated as GroupInvite]);
    if (!decorated.length) return c.json({ error: 'Invite shape invalid' }, 500);
    return c.json(decorated[0]!);
  })

  // Decline a pending invite. The invited user only.
  .post('/:inviteId/decline', async (c) => {
    const callerId = c.get('userId');
    const inviteId = c.req.param('inviteId')!;

    const invite = await fetchInviteById(inviteId);
    if (!invite) return c.json({ error: 'Not found' }, 404);
    if (invite.invited_user !== callerId) return c.json({ error: 'Forbidden' }, 403);
    if (invite.status !== 'pending') return c.json({ error: 'Not pending' }, 409);

    const svc = serviceClient();
    const { data: updated, error } = await svc
      .from('group_invites')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', inviteId)
      .select('*')
      .single();
    if (error || !updated) {
      return c.json({ error: error?.message ?? 'Update failed' }, 400);
    }
    const decorated = await decorateInvites([updated as GroupInvite]);
    if (!decorated.length) return c.json({ error: 'Invite shape invalid' }, 500);
    return c.json(decorated[0]!);
  })

  // Cancel a pending outgoing invite. The inviter only; only while pending.
  // Hard delete (mirrors the friends-cancel flow): once cancelled, the row
  // is gone and a fresh invite can be sent.
  .delete('/:inviteId', async (c) => {
    const callerId = c.get('userId');
    const inviteId = c.req.param('inviteId')!;

    const invite = await fetchInviteById(inviteId);
    if (!invite) return c.json({ error: 'Not found' }, 404);
    if (invite.invited_by !== callerId) return c.json({ error: 'Forbidden' }, 403);
    if (invite.status !== 'pending') return c.json({ error: 'Not pending' }, 409);

    const svc = serviceClient();
    const { error } = await svc.from('group_invites').delete().eq('id', inviteId);
    if (error) return c.json({ error: error.message }, 400);
    return c.body(null, 204);
  });
