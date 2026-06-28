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
  sharedGroupId: string | null = null,
): Promise<SaveResult> {
  const body = draftToRunCreate(draft, today);
  const { data, error } = await serviceClient()
    .from('runs')
    .insert({ ...body, user_id: userId, shared_group_id: sharedGroupId })
    .select('*')
    .single();
  if (error || !data) {
    console.error(`[telegram] save FAILED user=${userId}: ${error?.message ?? 'no data returned'}`);
    return { ok: false, error: error?.message ?? 'insert failed' };
  }
  // Observability for third-party ingestion: which Pacer account a Telegram
  // run lands on (the #1 thing to check when "the bot saved but I don't see it").
  console.log(`[telegram] run saved user=${userId} run=${data.id} date=${data.run_date}`);

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
