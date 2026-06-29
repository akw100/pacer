import { Hono } from 'hono';
import {
  CreateGroupGoalInputSchema,
  GroupGoalWithProgressSchema,
  UpdateGroupGoalInputSchema,
  scoreFor,
  type GroupGoal,
  type GroupGoalEffectiveStatus,
  type GroupGoalMetric,
  type GroupGoalWithProgress,
} from '@pacer/shared';
import type { AppEnv } from '../lib/auth';
import { serviceClient } from '../lib/supabase';
import { zValidator } from '../lib/validate';

// Group goals.
//
// Mounted at `/groups/:id/goals` in routes/index.ts. The `:id` URL param is
// the group id; sub-paths here use `:goalId`.
//
// Trust model (mirrors friendships):
//   • RLS on `group_goals` allows SELECT to group members only; there are
//     NO INSERT/UPDATE/DELETE policies — RLS denies them by default.
//   • All mutations go through `serviceClient()` here AFTER:
//       1. requireAuth middleware verified the bearer JWT (c.get('userId')).
//       2. assertMember() confirmed the caller belongs to the group.
//       3. For PATCH/archive: assertCreatorOrOwner() confirmed the caller is
//          the goal's creator OR the group's owner.
//   • Identity-bearing columns (created_by) are set server-side from the JWT
//     — NEVER from the request body.
//   • Immutable fields are not in UpdateGroupGoalInputSchema; group_id and
//     metric are silently ignored if smuggled in.
//   • Progress is computed live from runs/workouts where
//     `shared_group_id = goal.group_id` AND date IN [start_date, end_date].
//     NEVER stored. `current_value` reflects the moment of the read.

// ── Helpers ─────────────────────────────────────────────────────────────────

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function diffDays(a: string, b: string): number {
  // a, b are yyyy-MM-dd in local time. Both interpreted at midnight local.
  // Returns whole-day signed difference: positive if a > b, negative if a < b.
  const [ay, am, ad] = a.split('-').map(Number) as [number, number, number];
  const [by, bm, bd] = b.split('-').map(Number) as [number, number, number];
  const da = new Date(ay, am - 1, ad).getTime();
  const db = new Date(by, bm - 1, bd).getTime();
  return Math.round((da - db) / 86_400_000);
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

async function getGroupOwner(groupId: string): Promise<string | null> {
  const svc = serviceClient();
  const { data } = await svc
    .from('groups')
    .select('owner_id')
    .eq('id', groupId)
    .maybeSingle();
  return (data?.owner_id as string | undefined) ?? null;
}

async function fetchGoal(
  goalId: string,
  groupId: string,
): Promise<GroupGoal | null> {
  const svc = serviceClient();
  const { data } = await svc
    .from('group_goals')
    .select('*')
    .eq('id', goalId)
    .eq('group_id', groupId)
    .maybeSingle();
  return (data as GroupGoal | null) ?? null;
}

// ── Progress computation ──────────────────────────────────────────────────
// Always derived from real group-tagged activity. Personal-only runs
// (shared_group_id IS NULL) are NEVER counted toward any group goal — that's
// the additive group-share contract from migration 0003.

async function computeCurrentValue(goal: GroupGoal): Promise<number> {
  const svc = serviceClient();

  if (goal.metric === 'distance' || goal.metric === 'runs') {
    const { data } = await svc
      .from('runs')
      .select('distance_meters')
      .eq('shared_group_id', goal.group_id)
      .gte('run_date', goal.start_date)
      .lte('run_date', goal.end_date);
    const rows = (data ?? []) as { distance_meters: number | string }[];
    if (goal.metric === 'runs') return rows.length;
    let total = 0;
    for (const r of rows) {
      const m = Number(r.distance_meters);
      if (Number.isFinite(m) && m > 0) total += m;
    }
    return total;
  }

  if (goal.metric === 'workouts') {
    const { count } = await svc
      .from('workouts')
      .select('id', { count: 'exact', head: true })
      .eq('shared_group_id', goal.group_id)
      .gte('workout_date', goal.start_date)
      .lte('workout_date', goal.end_date);
    return count ?? 0;
  }

  // metric === 'score' — combine runs + workouts via shared `scoreFor()` so
  // the number always matches what group-stats / personal score show.
  const { data: runs } = await svc
    .from('runs')
    .select('distance_meters')
    .eq('shared_group_id', goal.group_id)
    .gte('run_date', goal.start_date)
    .lte('run_date', goal.end_date);
  const { data: workouts } = await svc
    .from('workouts')
    .select('id')
    .eq('shared_group_id', goal.group_id)
    .gte('workout_date', goal.start_date)
    .lte('workout_date', goal.end_date);

  let score = 0;
  for (const r of (runs ?? []) as { distance_meters: number | string }[]) {
    const m = Number(r.distance_meters);
    if (Number.isFinite(m) && m > 0) {
      score += scoreFor({ reason: 'run', distanceMeters: m });
    }
  }
  for (const _w of (workouts ?? []) as { id: string }[]) {
    score += scoreFor({ reason: 'workout' });
  }
  return score;
}

function deriveEffectiveStatus(
  storedStatus: GroupGoal['status'],
  currentValue: number,
  targetValue: number,
  endDate: string,
  todayKey: string,
): GroupGoalEffectiveStatus {
  if (storedStatus === 'archived') return 'archived';
  if (currentValue >= targetValue) return 'completed';
  if (endDate < todayKey) return 'expired';
  return 'active';
}

async function decorateGoal(goal: GroupGoal): Promise<GroupGoalWithProgress> {
  const currentValue = await computeCurrentValue(goal);
  const target = Number(goal.target_value);
  const progressPct = target > 0 ? Math.min(100, Math.round((currentValue / target) * 100)) : 0;
  const todayKey = toDateKey(new Date());
  const effectiveStatus = deriveEffectiveStatus(
    goal.status,
    currentValue,
    target,
    goal.end_date,
    todayKey,
  );
  const daysLeft = diffDays(goal.end_date, todayKey);

  const decorated: GroupGoalWithProgress = {
    ...goal,
    target_value: target,
    current_value: currentValue,
    progress_pct: progressPct,
    effective_status: effectiveStatus,
    days_left: daysLeft,
  };

  // Boundary validation so a refactor that ever broke this shape would fail
  // at runtime instead of leaking a wrong contract to the client.
  const parsed = GroupGoalWithProgressSchema.safeParse(decorated);
  if (!parsed.success) {
    throw new Error(`group_goal shape invalid: ${JSON.stringify(parsed.error.flatten())}`);
  }
  return parsed.data;
}

// ── Routes ──────────────────────────────────────────────────────────────────
// Sub-router mounted under /groups/:id/goals. Inside this file, paths are
// relative to that mount — `/` is /groups/:id/goals, `/:goalId` is
// /groups/:id/goals/:goalId, etc. The group id is read via
// c.req.param('id') (carried from the mount path).

export const groupGoals = new Hono<AppEnv>()

  // List a group's goals with derived progress. Includes both active and
  // archived rows so the UI can decide how to render history; the UI is
  // expected to filter when needed.
  .get('/', async (c) => {
    const userId = c.get('userId');
    // `:id` from the mount path is typed as `string | undefined` by Hono — narrow here.
    const groupId = c.req.param('id')!;
    const check = await assertMember(groupId, userId);
    if (!check.ok) {
      return c.json(
        { error: check.reason === '404' ? 'Not found' : 'Forbidden' },
        check.reason === '404' ? 404 : 403,
      );
    }

    const svc = serviceClient();
    const { data, error } = await svc
      .from('group_goals')
      .select('*')
      .eq('group_id', groupId)
      .order('end_date', { ascending: false });
    if (error) return c.json({ error: error.message }, 400);

    const rows = (data ?? []) as GroupGoal[];
    const decorated = await Promise.all(rows.map((g) => decorateGoal(g)));
    return c.json(decorated);
  })

  // Create a goal for the group. created_by is taken from the JWT; the
  // group is taken from the URL. The client cannot smuggle either.
  .post('/', zValidator('json', CreateGroupGoalInputSchema), async (c) => {
    const userId = c.get('userId');
    // `:id` from the mount path is typed as `string | undefined` by Hono — narrow here.
    const groupId = c.req.param('id')!;
    const check = await assertMember(groupId, userId);
    if (!check.ok) {
      return c.json(
        { error: check.reason === '404' ? 'Not found' : 'Forbidden' },
        check.reason === '404' ? 404 : 403,
      );
    }

    const input = c.req.valid('json');
    const svc = serviceClient();
    const { data: inserted, error } = await svc
      .from('group_goals')
      .insert({
        group_id: groupId,
        created_by: userId,
        title: input.title,
        metric: input.metric,
        target_value: input.target_value,
        start_date: input.start_date,
        end_date: input.end_date,
        status: 'active',
      })
      .select('*')
      .single();
    if (error || !inserted) {
      return c.json({ error: error?.message ?? 'Insert failed' }, 400);
    }
    const decorated = await decorateGoal(inserted as GroupGoal);
    return c.json(decorated, 201);
  })

  // Detail for a single goal.
  .get('/:goalId', async (c) => {
    const userId = c.get('userId');
    // Both params are guaranteed present by the matched route — Hono types
    // `:id` from the mount path as `string | undefined`, so we narrow here.
    const groupId = c.req.param('id')!;
    const goalId = c.req.param('goalId')!;
    const check = await assertMember(groupId, userId);
    if (!check.ok) {
      return c.json(
        { error: check.reason === '404' ? 'Not found' : 'Forbidden' },
        check.reason === '404' ? 404 : 403,
      );
    }
    const goal = await fetchGoal(goalId, groupId);
    if (!goal) return c.json({ error: 'Not found' }, 404);
    const decorated = await decorateGoal(goal);
    return c.json(decorated);
  })

  // Update editable fields (title / target_value / start_date / end_date).
  // Editable by creator OR group owner. Immutable: id, group_id, created_by,
  // metric, status (status changes via /archive). created_at is preserved;
  // updated_at is touched by the DB trigger.
  .patch('/:goalId', zValidator('json', UpdateGroupGoalInputSchema), async (c) => {
    const userId = c.get('userId');
    // Both params are guaranteed present by the matched route — Hono types
    // `:id` from the mount path as `string | undefined`, so we narrow here.
    const groupId = c.req.param('id')!;
    const goalId = c.req.param('goalId')!;
    const check = await assertMember(groupId, userId);
    if (!check.ok) {
      return c.json(
        { error: check.reason === '404' ? 'Not found' : 'Forbidden' },
        check.reason === '404' ? 404 : 403,
      );
    }
    const goal = await fetchGoal(goalId, groupId);
    if (!goal) return c.json({ error: 'Not found' }, 404);

    const ownerId = await getGroupOwner(groupId);
    if (goal.created_by !== userId && ownerId !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const patch = c.req.valid('json');

    // Cross-field consistency: if only one date is provided, validate
    // against the existing other side too.
    const nextStart = patch.start_date ?? goal.start_date;
    const nextEnd = patch.end_date ?? goal.end_date;
    if (nextEnd < nextStart) {
      return c.json({ error: 'end_date must be on or after start_date' }, 422);
    }

    const svc = serviceClient();
    const { data: updated, error } = await svc
      .from('group_goals')
      .update(patch)
      .eq('id', goalId)
      .eq('group_id', groupId)
      .select('*')
      .single();
    if (error || !updated) {
      return c.json({ error: error?.message ?? 'Update failed' }, 400);
    }
    const decorated = await decorateGoal(updated as GroupGoal);
    return c.json(decorated);
  })

  // Archive (soft-delete) a goal. v1 has NO hard DELETE endpoint. Idempotent:
  // archiving an already-archived goal returns its current state.
  .post('/:goalId/archive', async (c) => {
    const userId = c.get('userId');
    // Both params are guaranteed present by the matched route — Hono types
    // `:id` from the mount path as `string | undefined`, so we narrow here.
    const groupId = c.req.param('id')!;
    const goalId = c.req.param('goalId')!;
    const check = await assertMember(groupId, userId);
    if (!check.ok) {
      return c.json(
        { error: check.reason === '404' ? 'Not found' : 'Forbidden' },
        check.reason === '404' ? 404 : 403,
      );
    }
    const goal = await fetchGoal(goalId, groupId);
    if (!goal) return c.json({ error: 'Not found' }, 404);

    const ownerId = await getGroupOwner(groupId);
    if (goal.created_by !== userId && ownerId !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    if (goal.status === 'archived') {
      const decorated = await decorateGoal(goal);
      return c.json(decorated);
    }

    const svc = serviceClient();
    const { data: updated, error } = await svc
      .from('group_goals')
      .update({ status: 'archived' })
      .eq('id', goalId)
      .eq('group_id', groupId)
      .select('*')
      .single();
    if (error || !updated) {
      return c.json({ error: error?.message ?? 'Archive failed' }, 400);
    }
    const decorated = await decorateGoal(updated as GroupGoal);
    return c.json(decorated);
  });

// Silence "imported but never used" for the type re-export — keeping the
// metric type available for adjacent slices to reference if they need to
// gate on goal metric kinds in the future.
export type { GroupGoalMetric };
