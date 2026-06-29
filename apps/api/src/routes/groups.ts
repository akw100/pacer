import { Hono } from 'hono';
import {
  CreateGroupInputSchema,
  JoinGroupInputSchema,
  RenameGroupInputSchema,
  generateJoinCode,
  WEEK_START,
} from '@pacer/shared';
import type { AppEnv } from '../lib/auth';
import { broadcast } from '../lib/realtime';
import { serviceClient, userClient } from '../lib/supabase';
import { zValidator } from '../lib/validate';
import { computeGroupFeed, computeGroupStats } from '../lib/group-stats';
import { startOfWeek, endOfWeek } from 'date-fns';

// ── Helpers ─────────────────────────────────────────────────────────────────

function toDateKey(d: Date): string {
  // Local-time yyyy-MM-dd — Postgres date columns are TZ-agnostic.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function uniqueJoinCode(): Promise<string> {
  // Birthday-paradox math says collisions are vanishingly rare with 6 chars
  // and a 29-char alphabet (~5.9e8 codes) at family-scale group counts, but
  // we still loop just in case the table grows.
  const svc = serviceClient();
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateJoinCode();
    const { count } = await svc.from('groups').select('id', { count: 'exact', head: true }).eq('join_code', code);
    if (!count) return code;
  }
  throw new Error('Could not generate a unique join code; try again');
}

async function assertMember(
  groupId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; reason: '403' | '404' }> {
  const svc = serviceClient();
  const { data: group } = await svc.from('groups').select('id').eq('id', groupId).maybeSingle();
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

async function assertOwner(
  groupId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; reason: '403' | '404' }> {
  const svc = serviceClient();
  const { data: group } = await svc.from('groups').select('id, owner_id').eq('id', groupId).maybeSingle();
  if (!group) return { ok: false, reason: '404' };
  if (group.owner_id !== userId) return { ok: false, reason: '403' };
  return { ok: true };
}

async function fanOutToGroup(groupId: string, ids: Record<string, string>, type: string): Promise<void> {
  void broadcast(`group:${groupId}`, { type: type as never, ids });
}

// ── Routes ──────────────────────────────────────────────────────────────────

export const groups = new Hono<AppEnv>()

  // List groups the current user belongs to (with member count).
  .get('/', async (c) => {
    const userId = c.get('userId');
    const svc = serviceClient();
    const { data: memberships, error } = await svc
      .from('group_members')
      .select('group_id, groups!inner(id, name, join_code, owner_id, created_at)')
      .eq('user_id', userId);
    if (error) return c.json({ error: error.message }, 400);

    type Row = {
      group_id: string;
      groups: { id: string; name: string; join_code: string; owner_id: string; created_at: string };
    };
    const groupsList = ((memberships ?? []) as unknown as Row[]).map((r) => r.groups);

    // Member counts in one roundtrip via grouped count.
    const ids = groupsList.map((g) => g.id);
    const counts = new Map<string, number>();
    if (ids.length) {
      const { data: countRows } = await svc.from('group_members').select('group_id').in('group_id', ids);
      for (const row of (countRows ?? []) as { group_id: string }[]) {
        counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1);
      }
    }

    return c.json(groupsList.map((g) => ({ ...g, member_count: counts.get(g.id) ?? 0 })));
  })

  // Create a new group. The caller becomes owner + first member.
  .post('/', zValidator('json', CreateGroupInputSchema), async (c) => {
    const userId = c.get('userId');
    const { name } = c.req.valid('json');
    const svc = serviceClient();
    const join_code = await uniqueJoinCode();

    const { data: group, error } = await svc
      .from('groups')
      .insert({ name, join_code, owner_id: userId })
      .select('*')
      .single();
    if (error || !group) return c.json({ error: error?.message ?? 'Insert failed' }, 400);

    // Service client so we sidestep RLS — the row's user is the same caller anyway.
    const { error: memberErr } = await svc
      .from('group_members')
      .insert({ group_id: group.id, user_id: userId });
    if (memberErr) {
      // Roll back the group we just created so we never orphan it.
      await svc.from('groups').delete().eq('id', group.id);
      return c.json({ error: memberErr.message }, 400);
    }

    return c.json({ ...group, member_count: 1 }, 201);
  })

  // Join by 6-char invite code.
  .post('/join', zValidator('json', JoinGroupInputSchema), async (c) => {
    const userId = c.get('userId');
    const { join_code } = c.req.valid('json');
    const svc = serviceClient();
    const { data: group } = await svc.from('groups').select('*').eq('join_code', join_code).maybeSingle();
    if (!group) return c.json({ error: 'Group not found' }, 404);

    const { error } = await svc
      .from('group_members')
      .upsert({ group_id: group.id, user_id: userId }, { onConflict: 'group_id,user_id', ignoreDuplicates: true });
    if (error) return c.json({ error: error.message }, 400);

    void fanOutToGroup(group.id, { groupId: group.id, userId }, 'group.member_joined');

    return c.json(group, 200);
  })

  // Group details — members + owner + counts.
  .get('/:id', async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    const check = await assertMember(id, userId);
    if (!check.ok) return c.json({ error: check.reason === '404' ? 'Not found' : 'Forbidden' }, check.reason === '404' ? 404 : 403);

    const svc = serviceClient();
    const { data: group } = await svc.from('groups').select('*').eq('id', id).single();
    const { data: rows } = await svc
      .from('group_members')
      .select('group_id, user_id, joined_at, profiles!inner(handle, display_name, avatar_emoji)')
      .eq('group_id', id)
      .order('joined_at', { ascending: true });

    type RawMember = {
      group_id: string; user_id: string; joined_at: string;
      profiles: { handle: string; display_name: string; avatar_emoji: string | null };
    };
    const members = ((rows ?? []) as unknown as RawMember[]).map((r) => ({
      group_id: r.group_id,
      user_id: r.user_id,
      joined_at: r.joined_at,
      handle: r.profiles.handle,
      display_name: r.profiles.display_name,
      avatar_emoji: r.profiles.avatar_emoji,
    }));

    return c.json({ ...group, members });
  })

  // Rename or regenerate code (owner only).
  .patch('/:id', zValidator('json', RenameGroupInputSchema), async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    const check = await assertOwner(id, userId);
    if (!check.ok) return c.json({ error: check.reason === '404' ? 'Not found' : 'Forbidden' }, check.reason === '404' ? 404 : 403);

    const body = c.req.valid('json');
    const patch: { name?: string; join_code?: string } = {};
    if (body.name) patch.name = body.name;
    if (body.regenerate_code) patch.join_code = await uniqueJoinCode();

    if (Object.keys(patch).length === 0) return c.json({ error: 'Nothing to update' }, 400);

    const svc = serviceClient();
    const { data, error } = await svc.from('groups').update(patch).eq('id', id).select('*').single();
    if (error) return c.json({ error: error.message }, 400);
    return c.json(data);
  })

  // Remove a member (owner only). Owners can also "remove" themselves via this
  // route which effectively deletes the group via cascading FKs; we keep it
  // simple and let the owner explicitly call DELETE on /:id for that.
  .delete('/:id/members/:userId', async (c) => {
    const callerId = c.get('userId');
    const id = c.req.param('id');
    const memberId = c.req.param('userId');
    const check = await assertOwner(id, callerId);
    if (!check.ok) return c.json({ error: check.reason === '404' ? 'Not found' : 'Forbidden' }, check.reason === '404' ? 404 : 403);
    if (memberId === callerId) return c.json({ error: 'Owner cannot remove self' }, 400);

    const svc = serviceClient();
    const { error } = await svc.from('group_members').delete().eq('group_id', id).eq('user_id', memberId);
    if (error) return c.json({ error: error.message }, 400);
    void fanOutToGroup(id, { groupId: id, userId: memberId }, 'group.member_removed');
    return c.body(null, 204);
  })

  // Leave a group (member action — self).
  .delete('/:id/members/me', async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    // userClient honours RLS — self-leave policy is defined in the migration.
    const db = userClient(c.req.header('Authorization')!.slice(7).trim());
    const { error } = await db.from('group_members').delete().eq('group_id', id).eq('user_id', userId);
    if (error) return c.json({ error: error.message }, 400);
    return c.body(null, 204);
  })

  // Group feed: recent member runs/workouts that were tagged to this group.
  .get('/:id/feed', async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    const check = await assertMember(id, userId);
    if (!check.ok) return c.json({ error: check.reason === '404' ? 'Not found' : 'Forbidden' }, check.reason === '404' ? 404 : 403);

    const items = await computeGroupFeed(serviceClient(), id, userId);
    return c.json(items);
  })

  // Group stats: leaderboard, totals, you-vs-average. Week is configurable
  // via ?week_start in ISO; defaults to the current week using the app-wide
  // WEEK_START (Sunday).
  .get('/:id/stats', async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    const check = await assertMember(id, userId);
    if (!check.ok) return c.json({ error: check.reason === '404' ? 'Not found' : 'Forbidden' }, check.reason === '404' ? 404 : 403);

    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: WEEK_START });
    const end = endOfWeek(now, { weekStartsOn: WEEK_START });
    const stats = await computeGroupStats(serviceClient(), id, userId, toDateKey(start), toDateKey(end));
    return c.json(stats);
  });
