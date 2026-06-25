import { z } from 'zod';

// Workouts cover strength, mobility, swim, bike, and an "other" catch-all. A
// workout has zero or more exercise sets (workout_sets table). Duration is
// optional — not every workout is timed.

export const WorkoutKind = z.enum(['strength', 'mobility', 'swim', 'bike', 'other']);
export type WorkoutKindValue = z.infer<typeof WorkoutKind>;

export const WorkoutSetSchema = z.object({
  id: z.string().uuid(),
  workoutId: z.string().uuid(),
  exerciseName: z.string().min(1),
  sets: z.number().int().positive().nullable().optional(),
  reps: z.number().int().positive().nullable().optional(),
  weight: z.number().nonnegative().nullable().optional(),
});
export type WorkoutSet = z.infer<typeof WorkoutSetSchema>;

export const WorkoutSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  workoutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // yyyy-MM-dd
  kind: WorkoutKind,
  durationSeconds: z.number().int().positive().nullable().optional(),
  source: z.enum(['web', 'telegram']),
  createdAt: z.string().datetime(),
  sets: z.array(WorkoutSetSchema),
});
export type Workout = z.infer<typeof WorkoutSchema>;

// Create payload for a workout. Sets carry no id/workoutId yet — the API
// fills them in transactionally.
export const WorkoutSetInputSchema = WorkoutSetSchema.omit({ id: true, workoutId: true });
export type WorkoutSetInput = z.infer<typeof WorkoutSetInputSchema>;

export const WorkoutInputSchema = WorkoutSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  source: true,
  sets: true,
}).extend({
  source: z.enum(['web', 'telegram']).default('web').optional(),
  sets: z.array(WorkoutSetInputSchema),
});
export type WorkoutInput = z.infer<typeof WorkoutInputSchema>;
