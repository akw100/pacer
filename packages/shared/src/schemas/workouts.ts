import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Single source of truth for the five workout kinds. Mirrors the DB
// CHECK constraint on public.workouts.kind (see 0002_logging.sql). The
// WorkoutCreateSchema.kind enum below and WorkoutKindCountsSchema both
// derive from this const array so any future kind (or removal) lands in
// exactly one place.
export const WORKOUT_KINDS = ['strength', 'mobility', 'swim', 'bike', 'other'] as const;
export type WorkoutKind = (typeof WORKOUT_KINDS)[number];

/**
 * Weekly workout counts bucketed by real `workouts.kind` values. Real
 * zeros are legal (every field is nonnegative-int), so an all-zero
 * object represents a member/friend with no workouts logged in the
 * window — never a placeholder. Consumers should not synthesise this
 * object; either the aggregation ran and returned real counts, or the
 * whole field is omitted upstream.
 */
export const WorkoutKindCountsSchema = z.object({
  strength: z.number().int().nonnegative(),
  mobility: z.number().int().nonnegative(),
  swim:     z.number().int().nonnegative(),
  bike:     z.number().int().nonnegative(),
  other:    z.number().int().nonnegative(),
});
export type WorkoutKindCounts = z.infer<typeof WorkoutKindCountsSchema>;

/** All-zeros starting point for per-user aggregation loops. */
export function emptyWorkoutKindCounts(): WorkoutKindCounts {
  return { strength: 0, mobility: 0, swim: 0, bike: 0, other: 0 };
}

export const WorkoutSetInputSchema = z.object({
  exercise_name: z.string().min(1),
  sets:          z.number().int().positive(),
  reps:          z.number().int().positive(),
  weight:        z.number().nonnegative().nullish(),
});
export type WorkoutSetInput = z.infer<typeof WorkoutSetInputSchema>;

export const WorkoutCreateSchema = z.object({
  name:             z.string().min(1),
  workout_date:     z.string().regex(dateRegex, 'Expected yyyy-mm-dd'),
  kind:             z.enum(['strength', 'mobility', 'swim', 'bike', 'other']),
  duration_seconds: z.number().int().positive().nullish(),
  sets:             z.array(WorkoutSetInputSchema).optional(),
  source:           z.enum(['web', 'telegram']).default('web'),
  // Optional group share — see runs.ts for the rationale.
  shared_group_id:  z.string().uuid().nullish(),
});
export type WorkoutCreate = z.infer<typeof WorkoutCreateSchema>;

export const WorkoutUpdateSchema = WorkoutCreateSchema.omit({ sets: true }).partial();
export type WorkoutUpdate = z.infer<typeof WorkoutUpdateSchema>;

export const WorkoutSetSchema = WorkoutSetInputSchema.extend({
  id:         z.string().uuid(),
  workout_id: z.string().uuid(),
});
export type WorkoutSet = z.infer<typeof WorkoutSetSchema>;

export const WorkoutSchema = WorkoutCreateSchema.omit({ sets: true }).extend({
  id:         z.string().uuid(),
  user_id:    z.string().uuid(),
  created_at: z.string(),
  sets:       z.array(WorkoutSetSchema).optional(),
});
export type Workout = z.infer<typeof WorkoutSchema>;
