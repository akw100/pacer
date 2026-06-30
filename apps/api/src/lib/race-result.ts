import { scoreFor } from '@pacer/shared';
import { emit } from './events';
import { serviceClient } from './supabase';

// Server-side side-effects when a Live Race finisher is recorded. A finisher's
// run is logged exactly like a normal run (source 'race') so the existing
// scoring + group fan-out apply unchanged; the first finisher (the winner) also
// gets a RACE_WIN bonus written to the score ledger.

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Log a finisher's run (source 'race') and return its id. Fires run.logged so
 * the existing scoring + group fan-out apply. Mirrors routes/runs.ts.
 */
export async function logRaceRun(
  userId: string,
  targetMeters: number,
  elapsedSeconds: number,
): Promise<string | null> {
  const db = serviceClient();
  const runDate = todayKey();
  const { data, error } = await db
    .from('runs')
    .insert({
      user_id: userId,
      run_date: runDate,
      distance_meters: targetMeters,
      duration_seconds: elapsedSeconds,
      source: 'race',
    })
    .select('id')
    .single();
  if (error || !data) return null;
  const runId = data.id as string;
  emit('run.logged', { userId, runId, runDate, distanceMeters: targetMeters });
  return runId;
}

/**
 * Award the winner a RACE_WIN bonus by writing the score ledger directly.
 *
 * score_events requires source_type + source_id (NOT NULL) and is idempotent on
 * (reason, source_type, source_id) — see migration 0002_logging.sql — so the
 * race id is used as the source, making a repeated award a no-op.
 */
export async function awardRaceWin(userId: string, raceId: string): Promise<void> {
  const points = scoreFor({ reason: 'race_win' });
  const eventDate = todayKey();
  await serviceClient()
    .from('score_events')
    .upsert(
      { user_id: userId, points, reason: 'race_win', source_type: 'race', source_id: raceId, event_date: eventDate },
      { onConflict: 'reason,source_type,source_id', ignoreDuplicates: true },
    );
  emit('score.awarded', { userId, points, reason: 'race_win', eventDate });
}
