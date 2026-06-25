import type { RealtimeEvent } from '@pacer/shared';
import { emit } from '../lib/events';
import { broadcast } from '../lib/realtime';
import { serviceClient } from '../lib/supabase';
import { draftToRunCreate, type RunDraft } from './draft';

export type SaveResult =
  | { ok: true; runId: string }
  | { ok: false; error: string };

/**
 * SEAM: the bot's single save path. Today it mirrors POST /runs using the
 * service-role client (the bot has no per-user JWT; data-model sanctions
 * Telegram ingestion as service-role work). When the assistant tool layer
 * (card 10 / P3) lands, replace this body with:
 *   return executeTool('log_run', draftToRunCreate(draft, today), { userId });
 */
export async function logRunForUser(
  userId: string,
  draft: RunDraft,
  today: string,
): Promise<SaveResult> {
  const body = draftToRunCreate(draft, today);
  const { data, error } = await serviceClient()
    .from('runs')
    .insert({ ...body, user_id: userId })
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'insert failed' };

  emit('run.logged', {
    userId,
    runId: data.id as string,
    runDate: data.run_date as string,
    distanceMeters: Number(data.distance_meters),
  });
  await fanOut(userId, { type: 'run.logged', ids: { runId: data.id as string } });
  return { ok: true, runId: data.id as string };
}

// Same best-effort fan-out as routes/runs.ts: user channel + each group.
async function fanOut(userId: string, event: RealtimeEvent): Promise<void> {
  void broadcast(`user:${userId}`, event);
  const { data } = await serviceClient()
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);
  for (const row of data ?? []) {
    void broadcast(`group:${row.group_id as string}`, event);
  }
}
