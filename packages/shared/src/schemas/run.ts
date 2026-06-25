import { z } from 'zod';

// Canonical units: distance in METERS, duration in SECONDS. Display values
// (km/mi, pace, durations) are derived via shared helpers at render time.

export const RunSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  runDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // yyyy-MM-dd
  distanceMeters: z.number().int().positive(),
  durationSeconds: z.number().int().positive(),
  exertionRating: z.number().int().min(1).max(10).nullable().optional(),
  warmUp: z.boolean().nullable().optional(),
  stretched: z.boolean().nullable().optional(),
  postRunFood: z.boolean().nullable().optional(),
  sleepHours: z.number().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  source: z.enum(['web', 'telegram']),
  createdAt: z.string().datetime(),
});
export type Run = z.infer<typeof RunSchema>;

// Create payload — no server-managed fields. `source` defaults to 'web' on the
// API; the form may omit it.
export const RunInputSchema = RunSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  source: true,
}).extend({
  source: z.enum(['web', 'telegram']).default('web').optional(),
});
export type RunInput = z.infer<typeof RunInputSchema>;
