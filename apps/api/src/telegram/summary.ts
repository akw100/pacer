import { metersToKm, formatDuration, formatPace, paceSecondsPerUnit, scoreFor } from '@pacer/shared';
import type { RunDraft } from './draft';
import type { WorkoutDraft } from './workoutDraft';

/** The confirm-card text for a run draft. */
export function runSummary(draft: RunDraft): string {
  const km = metersToKm(draft.distance_meters).toFixed(2);
  const dur = formatDuration(draft.duration_seconds);
  const pace = formatPace(paceSecondsPerUnit(draft.distance_meters, draft.duration_seconds, 'km'));
  const pts = scoreFor({ reason: 'run', distanceMeters: draft.distance_meters });
  return `Got: ${km} km in ${dur} · ${pace}/km · ≈ +${pts} pts${draft.run_date ? ` on ${draft.run_date}` : ''}. Save it?`;
}

/** The confirm-card text for a workout draft. */
export function workoutSummary(draft: WorkoutDraft): string {
  const setSummary = draft.sets
    .map((s) => `${s.sets}x${s.reps} ${s.exercise_name}${s.weight ? ` @${s.weight}kg` : ''}`)
    .join(', ');
  return `Workout: ${draft.name} (${draft.kind})${setSummary ? ` — ${setSummary}` : ''}. Save it?`;
}
