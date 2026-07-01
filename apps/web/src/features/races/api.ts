// Typed client for the Live Race API. Like every other slice, this goes through
// the shared `apiFetch` wrapper (apps/web/src/lib/api.ts) which attaches the
// caller's Supabase access token as a bearer and normalises JSON + errors.
//
// The token comes from the app's own Supabase session (apps/web/src/lib/supabase.ts
// — the same client AuthProvider drives), resolved per-call so these helpers keep
// the simple signatures the UI/hooks expect and never hand-roll auth.

import type { Race, RaceParticipant } from '@pacer/shared';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';

// TanStack Query keys for the races slice. `all` is the participation list;
// `detail(id)` is one race + its participants (also the target the realtime
// channel invalidates on race.started / race.finished broadcasts).
export const raceKeys = {
  all: ['races'] as const,
  detail: (id: string) => ['races', id] as const,
};

async function token(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new Error('Not authenticated');
  return t;
}

export async function createRace(targetMeters: number): Promise<Race> {
  return apiFetch<Race>('/races', {
    token: await token(),
    method: 'POST',
    body: { target_meters: targetMeters },
  });
}

export async function getRace(
  id: string,
): Promise<{ race: Race; participants: RaceParticipant[] }> {
  return apiFetch<{ race: Race; participants: RaceParticipant[] }>(`/races/${id}`, {
    token: await token(),
  });
}

export async function listRaces(): Promise<Race[]> {
  return apiFetch<Race[]>('/races', { token: await token() });
}

export async function invite(id: string, userIds: string[]): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/races/${id}/invite`, {
    token: await token(),
    method: 'POST',
    body: { userIds },
  });
}

export async function joinRace(
  id: string,
  role: 'runner' | 'spectator' = 'runner',
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/races/${id}/join`, {
    token: await token(),
    method: 'POST',
    body: { role },
  });
}

export async function setReady(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/races/${id}/ready`, { token: await token(), method: 'POST' });
}

export async function startRace(id: string): Promise<{ start_at: string }> {
  return apiFetch<{ start_at: string }>(`/races/${id}/start`, {
    token: await token(),
    method: 'POST',
  });
}

export async function cancelRace(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/races/${id}/cancel`, { token: await token(), method: 'POST' });
}

export async function finishRace(
  id: string,
  finalMeters: number,
  manual: boolean,
): Promise<{ ok: boolean; won?: boolean; elapsed?: number }> {
  return apiFetch<{ ok: boolean; won?: boolean; elapsed?: number }>(`/races/${id}/finish`, {
    token: await token(),
    method: 'POST',
    body: { final_meters: finalMeters, manual },
  });
}

export async function abandon(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/races/${id}/abandon`, { token: await token(), method: 'POST' });
}

export async function rematch(id: string): Promise<Race> {
  return apiFetch<Race>(`/races/${id}/rematch`, { token: await token(), method: 'POST' });
}
