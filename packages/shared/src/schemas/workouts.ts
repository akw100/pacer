import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

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
