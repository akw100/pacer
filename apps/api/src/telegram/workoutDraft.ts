import { z } from 'zod';
import type { WorkoutCreate } from '@pacer/shared';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const WorkoutSetDraftSchema = z.object({
  exercise_name: z.string().min(1),
  sets:          z.number().int().positive(),
  reps:          z.number().int().positive(),
  weight:        z.number().nonnegative().nullish(),
});

export const WorkoutDraftSchema = z.object({
  name:             z.string().min(1),
  kind:             z.enum(['strength', 'mobility', 'swim', 'bike', 'other']),
  sets:             z.array(WorkoutSetDraftSchema),
  duration_seconds: z.number().int().positive().nullish(),
  workout_date:     z.string().regex(dateRegex).nullish(),
  confidence:       z.number().min(0).max(1),
});
export type WorkoutDraft = z.infer<typeof WorkoutDraftSchema>;

// In-memory pending workout drafts, keyed like the run drafts in draft.ts
// (`${chat_id}:${message_id}:${userId}`). Taken exactly once on ✓ / ✗.
const workoutDrafts = new Map<string, WorkoutDraft>();
export function putWorkoutDraft(key: string, d: WorkoutDraft): void {
  workoutDrafts.set(key, d);
}
export function takeWorkoutDraft(key: string): WorkoutDraft | undefined {
  const d = workoutDrafts.get(key);
  workoutDrafts.delete(key);
  return d;
}

/** Map a confirmed workout draft to the shared WorkoutCreate shape. `today` is yyyy-mm-dd. */
export function draftToWorkoutCreate(draft: WorkoutDraft, today: string): WorkoutCreate {
  return {
    name: draft.name,
    workout_date: draft.workout_date ?? today,
    kind: draft.kind,
    duration_seconds: draft.duration_seconds ?? null,
    sets: draft.sets,
    source: 'telegram',
  };
}
