import { metersToDisplayDistance, formatDuration, formatPace, paceSecondsPerUnit, scoreFor } from '@pacer/shared';
import type { RunDraft } from './draft';
import type { WorkoutDraft } from './workoutDraft';

/** The confirm-card text for a run draft, in the user's km/mi units (default km). */
export function runSummary(draft: RunDraft, units: 'km' | 'mi' = 'km'): string {
  const { value, unit } = metersToDisplayDistance(draft.distance_meters, units);
  const dist = value.toFixed(2);
  const dur = formatDuration(draft.duration_seconds);
  const pace = formatPace(paceSecondsPerUnit(draft.distance_meters, draft.duration_seconds, units));
  const pts = scoreFor({ reason: 'run', distanceMeters: draft.distance_meters });
  return `Got: ${dist} ${unit} in ${dur} · ${pace}/${units} · ≈ +${pts} pts${draft.run_date ? ` on ${draft.run_date}` : ''}. Save it?`;
}

/** The confirm-card text for a workout draft. */
export function workoutSummary(draft: WorkoutDraft): string {
  const setSummary = draft.sets
    .map((s) => `${s.sets}x${s.reps} ${s.exercise_name}${s.weight ? ` @${s.weight}kg` : ''}`)
    .join(', ');
  return `Workout: ${draft.name} (${draft.kind})${setSummary ? ` — ${setSummary}` : ''}. Save it?`;
}
