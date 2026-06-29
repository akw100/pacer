import { on } from '../lib/events';
import { broadcast } from '../lib/realtime';
import { serviceClient } from '../lib/supabase';

// Group subscriber: when a run/workout is logged, we already broadcast to
// every group the actor belongs to (runs.ts/workouts.ts do this fan-out via
// the user→groups join). Here we additionally narrow to the SHARED group —
// the only one whose leaderboard/feed should actually change — and emit a
// pacer-specific "leaderboard.refresh" hint so the web realtime hook can
// invalidate just the right query keys.
//
// Events stay compact: { type, ids } only. No row data.

on('run.logged', async ({ userId, runId }) => {
  const db = serviceClient();
  const { data } = await db.from('runs').select('shared_group_id').eq('id', runId).maybeSingle();
  const groupId = data?.shared_group_id as string | null | undefined;
  if (!groupId) return;
  void broadcast(`group:${groupId}`, { type: 'run.logged', ids: { runId, userId, groupId } });
});

on('workout.logged', async ({ userId, workoutId }) => {
  const db = serviceClient();
  const { data } = await db.from('workouts').select('shared_group_id').eq('id', workoutId).maybeSingle();
  const groupId = data?.shared_group_id as string | null | undefined;
  if (!groupId) return;
  void broadcast(`group:${groupId}`, { type: 'workout.logged', ids: { workoutId, userId, groupId } });
});
