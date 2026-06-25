import type { RealtimeChannel, RealtimeEvent } from '@pacer/shared';
import { serviceClient } from './supabase';

// Realtime fan-out to clients. After an API write, broadcast a COMPACT event
// (type + ids only, never row data); subscribed clients invalidate their
// TanStack Query keys and refetch through the normal API path, so RLS and
// derivations stay in one place.
//
// NO-OP-SAFE: if Supabase isn't configured (missing env, local dev without a
// project), broadcast logs and returns — it must never throw and break a write.

/**
 * Broadcast a realtime event on a group/user channel. Best-effort: failures are
 * swallowed (logged) so a realtime hiccup never fails the originating request.
 */
export async function broadcast(channel: RealtimeChannel, event: RealtimeEvent): Promise<void> {
  try {
    const ch = serviceClient().channel(channel);
    await ch.send({ type: 'broadcast', event: event.type, payload: event });
    await serviceClient().removeChannel(ch);
  } catch (err) {
    console.warn(`[realtime] broadcast to "${channel}" skipped:`, err);
  }
}
