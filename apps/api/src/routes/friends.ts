import { Hono } from 'hono';
import {
  FriendRequestInputSchema,
  HandleSchema,
  emptyWorkoutKindCounts,
  scoreFor,
  WEEK_START,
  WORKOUT_KINDS,
  type FriendLeaderboardRow,
  type FriendLookupResponse,
  type FriendProfile,
  type FriendsLeaderboardResponse,
  type FriendsListResponse,
  type Friendship,
  type FriendshipWithProfile,
  type WorkoutKind,
} from '@pacer/shared';
import { startOfWeek, endOfWeek } from 'date-fns';
import { z } from 'zod';
import type { AppEnv } from '../lib/auth';
import { serviceClient } from '../lib/supabase';
import { zValidator } from '../lib/validate';

// Friends / accepted social graph.
//
// Trust model (from 0005_friendships.sql):
//   • RLS denies all direct client writes — there are NO INSERT/UPDATE/DELETE
//     policies on `friendships`. Every mutation here runs through the
//     service-role `serviceClient()` after the API validates auth, identity,
//     and the requested state transition.
//   • Reads from supabase-js are participant-scoped, so the GET endpoints
//     could in principle run as the user client too. We still use the
//     service client for them because it lets us JOIN to profiles with the
//     minimal projection without depending on profiles RLS allowing the
//     friend's row through — profiles RLS is INTENTIONALLY UNCHANGED in
//     this slice.
//   • Identity is taken from `c.get('userId')` (set by requireAuth from the
//     JWT). Request bodies NEVER provide the caller's id — any column that
//     names the caller (requester_id, blocked_by) is set server-side.
//
// Privacy:
//   • Every response that mentions another user returns ONLY
//     {id, handle, display_name, avatar_emoji}.
//   • Block status is never leaked: a request to a user who has blocked the
//     caller, or a lookup for one, returns the same shape as "not found".

// ── Helpers ─────────────────────────────────────────────────────────────────

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

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Look up an existing friendship row by canonical pair. Returns null if no
 * row exists in either direction. The unique (least, greatest) index means
 * at most one row can match.
 */
async function findFriendship(
  a: string,
  b: string,
): Promise<Friendship | null> {
  const svc = serviceClient();
  const { data } = await svc
    .from('friendships')
    .select('*')
    .or(
      `and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`,
    )
    .maybeSingle();
  return (data as Friendship | null) ?? null;
}

/**
 * Resolve a request body (`{handle}` | `{user_id}`) to a target user id.
 * Used by POST /friends/request only. Returns null when no profile matches
 * — the caller treats this as "not found" without leaking why.
 */
async function resolveTarget(
  input: { handle?: string; user_id?: string },
): Promise<string | null> {
  if (input.user_id) return input.user_id;
  if (input.handle) {
    const svc = serviceClient();
    const { data } = await svc
      .from('profiles')
      .select('id')
      .eq('handle', input.handle)
      .maybeSingle();
    return (data?.id as string | undefined) ?? null;
  }
  return null;
}

/**
 * Discriminated result of `createOrUpdateFriendRequest`. The route layer
 * maps `kind` to an HTTP status; the helper never touches Hono context so
 * it can be shared between the handle/user_id endpoint and the email
 * endpoint without either taking on privacy concerns of the other.
 *
 *   • `ok`                → row created or reused (idempotent); `created`
 *                           flags whether an INSERT ran (→ 201) versus a
 *                           row that already existed / was updated (→ 200).
 *   • `not_found`         → target has blocked the caller. Same shape as
 *                           unknown-target so callers cannot probe block
 *                           status.
 *   • `blocked_by_caller` → caller has blocked the target; only surface
 *                           this to the caller — they need to unblock
 *                           first.
 *   • `error`             → downstream Supabase error surfaced verbatim.
 *
 * The helper does NOT validate caller ≠ target — routes must do that
 * themselves so the correct error text is returned per surface (handle
 * flow says "Cannot friend yourself"; email flow uses that same guard).
 */
export type FriendRequestResult =
  | { kind: 'ok'; row: Friendship; created: boolean }
  | { kind: 'not_found' }
  | { kind: 'blocked_by_caller' }
  | { kind: 'error'; message: string };

export async function createOrUpdateFriendRequest(
  callerId: string,
  targetId: string,
): Promise<FriendRequestResult> {
  const svc = serviceClient();
  const existing = await findFriendship(callerId, targetId);

  if (existing?.status === 'blocked' && existing.blocked_by !== callerId) {
    return { kind: 'not_found' };
  }
  if (existing?.status === 'blocked' && existing.blocked_by === callerId) {
    return { kind: 'blocked_by_caller' };
  }

  if (existing?.status === 'accepted') {
    return { kind: 'ok', row: existing, created: false };
  }

  if (existing?.status === 'pending') {
    // Reverse-pending → auto-accept.
    if (existing.addressee_id === callerId) {
      const { data: updated, error } = await svc
        .from('friendships')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('requester_id', existing.requester_id)
        .eq('addressee_id', existing.addressee_id)
        .select('*')
        .single();
      if (error || !updated) return { kind: 'error', message: error?.message ?? 'Update failed' };
      return { kind: 'ok', row: updated as Friendship, created: false };
    }
    // Forward-pending already exists — idempotent return.
    return { kind: 'ok', row: existing, created: false };
  }

  if (existing?.status === 'declined') {
    // Allow a retry by overwriting the declined row in place.
    const { data: updated, error } = await svc
      .from('friendships')
      .update({
        status: 'pending',
        responded_at: null,
        created_at: new Date().toISOString(),
      })
      .eq('requester_id', existing.requester_id)
      .eq('addressee_id', existing.addressee_id)
      .select('*')
      .single();
    if (error || !updated) return { kind: 'error', message: error?.message ?? 'Retry failed' };
    return { kind: 'ok', row: updated as Friendship, created: false };
  }

  // No row exists in either direction — insert a fresh pending row.
  const { data: inserted, error: insertErr } = await svc
    .from('friendships')
    .insert({ requester_id: callerId, addressee_id: targetId, status: 'pending' })
    .select('*')
    .single();
  if (insertErr || !inserted) {
    return { kind: 'error', message: insertErr?.message ?? 'Insert failed' };
  }
  return { kind: 'ok', row: inserted as Friendship, created: true };
}

// ── Routes ──────────────────────────────────────────────────────────────────

export const friends = new Hono<AppEnv>()

  // List my friendships grouped by state. Excludes blocked rows from the
  // public-ish surfaces (accepted/incoming/outgoing) — blocked rows are
  // internal bookkeeping; we don't surface them as friendships.
  .get('/', async (c) => {
    const userId = c.get('userId');
    const svc = serviceClient();

    const { data: rows, error } = await svc
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .neq('status', 'blocked');
    if (error) return c.json({ error: error.message }, 400);

    const friendshipRows = (rows ?? []) as Friendship[];

    // Collect the OTHER user id from each row so we can fetch profiles in
    // one round-trip instead of N+1.
    const otherIds = friendshipRows.map((r) =>
      r.requester_id === userId ? r.addressee_id : r.requester_id,
    );
    const profilesById = new Map<string, ProfileRow>();
    if (otherIds.length) {
      const { data: profs } = await svc
        .from('profiles')
        .select(PROFILE_PROJECTION)
        .in('id', otherIds);
      for (const p of (profs ?? []) as ProfileRow[]) profilesById.set(p.id, p);
    }

    const accepted: FriendshipWithProfile[] = [];
    const incoming: FriendshipWithProfile[] = [];
    const outgoing: FriendshipWithProfile[] = [];

    for (const r of friendshipRows) {
      const otherId = r.requester_id === userId ? r.addressee_id : r.requester_id;
      const other = profilesById.get(otherId);
      if (!other) continue; // dangling FK shouldn't happen; skip defensively
      const direction: 'outgoing' | 'incoming' =
        r.requester_id === userId ? 'outgoing' : 'incoming';
      const item: FriendshipWithProfile = {
        status: r.status,
        direction,
        blocked_by: r.blocked_by,
        created_at: r.created_at,
        responded_at: r.responded_at,
        other: toFriendProfile(other),
      };
      if (r.status === 'accepted') accepted.push(item);
      else if (r.status === 'pending') {
        if (direction === 'incoming') incoming.push(item);
        else outgoing.push(item);
      }
      // 'declined' rows are intentionally omitted from the list — they
      // become noise once handled. The pair is preserved at the DB so a
      // retry can detect and overwrite, but the UI doesn't need to see it.
    }

    const payload: FriendsListResponse = { accepted, incoming, outgoing };
    return c.json(payload);
  })

  // Look up a profile by handle so the caller can decide whether to send a
  // request. Returns the same minimal projection as everything else. Never
  // differentiates "not found" from "blocked by target" to avoid leaking
  // block status to the caller.
  .get(
    '/lookup',
    zValidator('query', z.object({ handle: HandleSchema })),
    async (c) => {
      const callerId = c.get('userId');
      const { handle } = c.req.valid('query');
      const svc = serviceClient();

      const { data: profile } = await svc
        .from('profiles')
        .select(PROFILE_PROJECTION)
        .eq('handle', handle)
        .maybeSingle();

      if (!profile) return c.json<FriendLookupResponse>(null);

      // Self-lookup: doesn't matter for safety but pointless — return null
      // so the UI surfaces the same "search someone else" hint.
      if (profile.id === callerId) return c.json<FriendLookupResponse>(null);

      // If the target has blocked the caller, hide them from search.
      const existing = await findFriendship(callerId, profile.id);
      if (existing?.status === 'blocked' && existing.blocked_by !== callerId) {
        return c.json<FriendLookupResponse>(null);
      }

      return c.json<FriendLookupResponse>(toFriendProfile(profile as ProfileRow));
    },
  )

  // Send a friend request, OR auto-accept if a reverse-pending row exists.
  // Body: { handle } or { user_id }. Identity for `requester_id` is taken
  // from the JWT (`c.get('userId')`) — never from the body.
  .post('/request', zValidator('json', FriendRequestInputSchema), async (c) => {
    const callerId = c.get('userId');
    const input = c.req.valid('json');

    const targetId = await resolveTarget(input);
    if (!targetId) return c.json({ error: 'User not found' }, 404);
    if (targetId === callerId) return c.json({ error: 'Cannot friend yourself' }, 400);

    const result = await createOrUpdateFriendRequest(callerId, targetId);
    if (result.kind === 'not_found') return c.json({ error: 'User not found' }, 404);
    if (result.kind === 'blocked_by_caller') {
      return c.json({ error: 'You have blocked this user' }, 409);
    }
    if (result.kind === 'error') return c.json({ error: result.message }, 400);
    return c.json(result.row satisfies Friendship, result.created ? 201 : 200);
  })

  // Accept an incoming pending request. Only the addressee may accept.
  .post('/:userId/accept', async (c) => {
    const callerId = c.get('userId');
    const otherId = c.req.param('userId');

    const existing = await findFriendship(callerId, otherId);
    if (!existing) return c.json({ error: 'Not found' }, 404);
    if (existing.status !== 'pending') return c.json({ error: 'Not pending' }, 409);
    if (existing.addressee_id !== callerId) {
      return c.json({ error: 'Cannot accept your own request' }, 403);
    }

    const svc = serviceClient();
    const { data: updated, error } = await svc
      .from('friendships')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('requester_id', existing.requester_id)
      .eq('addressee_id', existing.addressee_id)
      .select('*')
      .single();
    if (error || !updated) return c.json({ error: error?.message ?? 'Update failed' }, 400);
    return c.json(updated satisfies Friendship);
  })

  // Decline an incoming pending request. Only the addressee may decline.
  .post('/:userId/decline', async (c) => {
    const callerId = c.get('userId');
    const otherId = c.req.param('userId');

    const existing = await findFriendship(callerId, otherId);
    if (!existing) return c.json({ error: 'Not found' }, 404);
    if (existing.status !== 'pending') return c.json({ error: 'Not pending' }, 409);
    if (existing.addressee_id !== callerId) {
      return c.json({ error: 'Cannot decline your own request' }, 403);
    }

    const svc = serviceClient();
    const { data: updated, error } = await svc
      .from('friendships')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('requester_id', existing.requester_id)
      .eq('addressee_id', existing.addressee_id)
      .select('*')
      .single();
    if (error || !updated) return c.json({ error: error?.message ?? 'Update failed' }, 400);
    return c.json(updated satisfies Friendship);
  })

  // Delete a friendship row. Covers: unfriend (accepted), cancel-pending
  // (outgoing), drop-declined. For BLOCKED rows, only the blocker may
  // delete (which is the unblock path's mechanism here too, but we expose
  // /:userId/unblock as the intended API).
  .delete('/:userId', async (c) => {
    const callerId = c.get('userId');
    const otherId = c.req.param('userId');

    const existing = await findFriendship(callerId, otherId);
    if (!existing) return c.json({ error: 'Not found' }, 404);

    if (existing.status === 'blocked' && existing.blocked_by !== callerId) {
      // The blocked party cannot remove the row to "unblock" themselves.
      return c.json({ error: 'Forbidden' }, 403);
    }

    const svc = serviceClient();
    const { error } = await svc
      .from('friendships')
      .delete()
      .eq('requester_id', existing.requester_id)
      .eq('addressee_id', existing.addressee_id);
    if (error) return c.json({ error: error.message }, 400);
    return c.body(null, 204);
  })

  // Block a user. Wipes any prior row (accepted/pending/declined) and
  // writes a fresh blocked row with `blocked_by = callerId`. Idempotent:
  // if the caller has already blocked this user, returns the existing row.
  .post('/:userId/block', async (c) => {
    const callerId = c.get('userId');
    const otherId = c.req.param('userId');
    if (otherId === callerId) return c.json({ error: 'Cannot block yourself' }, 400);

    const svc = serviceClient();
    const existing = await findFriendship(callerId, otherId);

    if (existing?.status === 'blocked' && existing.blocked_by === callerId) {
      return c.json(existing satisfies Friendship, 200);
    }

    if (existing?.status === 'blocked' && existing.blocked_by !== callerId) {
      // The OTHER party has blocked the caller — they can't block back via
      // this path because the row's slot is taken. Return the same 404 the
      // request endpoint uses to avoid leaking that state.
      return c.json({ error: 'Not found' }, 404);
    }

    // Wipe whatever existed (accepted/pending/declined) and insert fresh.
    if (existing) {
      const { error: delErr } = await svc
        .from('friendships')
        .delete()
        .eq('requester_id', existing.requester_id)
        .eq('addressee_id', existing.addressee_id);
      if (delErr) return c.json({ error: delErr.message }, 400);
    }

    const { data: inserted, error: insertErr } = await svc
      .from('friendships')
      .insert({
        requester_id: callerId,
        addressee_id: otherId,
        status: 'blocked',
        blocked_by: callerId,
      })
      .select('*')
      .single();
    if (insertErr || !inserted) {
      return c.json({ error: insertErr?.message ?? 'Block failed' }, 400);
    }
    return c.json(inserted satisfies Friendship, 201);
  })

  // Unblock — delete the blocked row. Only the blocker (blocked_by) may
  // unblock. Returns 204 on success.
  .post('/:userId/unblock', async (c) => {
    const callerId = c.get('userId');
    const otherId = c.req.param('userId');

    const existing = await findFriendship(callerId, otherId);
    if (!existing || existing.status !== 'blocked') {
      return c.json({ error: 'Not found' }, 404);
    }
    if (existing.blocked_by !== callerId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const svc = serviceClient();
    const { error } = await svc
      .from('friendships')
      .delete()
      .eq('requester_id', existing.requester_id)
      .eq('addressee_id', existing.addressee_id);
    if (error) return c.json({ error: error.message }, 400);
    return c.body(null, 204);
  })

  // Weekly leaderboard across accepted friends + caller. Computed
  // server-side from real runs/workouts of the participating users for the
  // current ISO week (Monday start, mirroring group-stats convention).
  // Never returns activity rows or third parties — only the caller's
  // accepted-friend graph plus caller.
  .get('/leaderboard', async (c) => {
    const callerId = c.get('userId');
    const svc = serviceClient();

    // 1) Resolve accepted friends.
    const { data: edges, error: edgeErr } = await svc
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${callerId},addressee_id.eq.${callerId}`);
    if (edgeErr) return c.json({ error: edgeErr.message }, 400);

    const friendIds = new Set<string>();
    for (const e of (edges ?? []) as { requester_id: string; addressee_id: string }[]) {
      friendIds.add(e.requester_id === callerId ? e.addressee_id : e.requester_id);
    }
    // Caller always in the set so the leaderboard always renders "you".
    const participantIds = [callerId, ...friendIds];

    // 2) Week boundaries — app-wide WEEK_START (Sunday), matching group-stats.
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: WEEK_START });
    const end = endOfWeek(now, { weekStartsOn: WEEK_START });
    const weekStartKey = toDateKey(start);
    const weekEndKey = toDateKey(end);

    // 3) Pull the week's PERSONAL activity for participants. Friends
    //    standing uses each user's full personal activity for the week —
    //    NOT just group-tagged activity. Anyone-mode runs count.
    const { data: weekRuns } = await svc
      .from('runs')
      .select('user_id, distance_meters')
      .in('user_id', participantIds)
      .gte('run_date', weekStartKey)
      .lte('run_date', weekEndKey);

    // `kind` is projected alongside user_id so we can derive
    // workout_kind_counts in the same aggregation pass (§0002_logging
    // CHECK constraint guarantees kind is one of the five values, so
    // the switch below never falls through). No new query — same row
    // set, one extra column.
    const { data: weekWorkouts } = await svc
      .from('workouts')
      .select('user_id, kind')
      .in('user_id', participantIds)
      .gte('workout_date', weekStartKey)
      .lte('workout_date', weekEndKey);

    // 4) Minimal profiles for everyone on the board.
    const { data: profs } = await svc
      .from('profiles')
      .select(PROFILE_PROJECTION)
      .in('id', participantIds);

    const profilesById = new Map<string, ProfileRow>();
    for (const p of (profs ?? []) as ProfileRow[]) profilesById.set(p.id, p);

    // 5) Aggregate per user using shared `scoreFor()` — same source of
    //    truth as group-stats so numbers agree across the app.
    const rows = new Map<string, FriendLeaderboardRow>();
    for (const id of participantIds) {
      const p = profilesById.get(id);
      if (!p) continue;
      rows.set(id, {
        user_id: id,
        handle: p.handle,
        display_name: p.display_name,
        avatar_emoji: p.avatar_emoji,
        score: 0,
        distance_meters: 0,
        runs: 0,
        workouts: 0,
        workout_kind_counts: emptyWorkoutKindCounts(),
      });
    }

    for (const r of (weekRuns ?? []) as { user_id: string; distance_meters: number | string }[]) {
      const row = rows.get(r.user_id);
      if (!row) continue;
      const m = Number(r.distance_meters);
      if (!Number.isFinite(m) || m <= 0) continue;
      row.distance_meters += m;
      row.runs += 1;
      row.score += scoreFor({ reason: 'run', distanceMeters: m });
    }
    for (const w of (weekWorkouts ?? []) as { user_id: string; kind: string }[]) {
      const row = rows.get(w.user_id);
      if (!row) continue;
      row.workouts += 1;
      row.score += scoreFor({ reason: 'workout' });
      // The DB CHECK guarantees `kind` is one of WORKOUT_KINDS, but we
      // guard defensively so an unexpected value (backfill, future
      // migration) never explodes the aggregator — it silently drops
      // instead of misclassifying.
      if (row.workout_kind_counts && (WORKOUT_KINDS as readonly string[]).includes(w.kind)) {
        row.workout_kind_counts[w.kind as WorkoutKind] += 1;
      }
    }

    const leaderboard = [...rows.values()].sort(
      (a, b) => b.score - a.score || b.distance_meters - a.distance_meters,
    );

    const youIdx = leaderboard.findIndex((r) => r.user_id === callerId);
    const first = leaderboard[0];
    const you = youIdx >= 0 ? leaderboard[youIdx] : null;
    const youVsFriends = {
      rank: youIdx >= 0 ? youIdx + 1 : null,
      score_gap_to_first: you && first ? Math.max(0, first.score - you.score) : 0,
    };

    const payload: FriendsLeaderboardResponse = {
      week_start: weekStartKey,
      week_end: weekEndKey,
      leaderboard,
      you_vs_friends: youVsFriends,
    };
    return c.json(payload);
  });
