import { z } from 'zod';
import type { ScoreReason } from '../scoring';

export const ScoreEventSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  points: z.number().int(),
  reason: z.enum(['run', 'workout', 'habit', 'habit_day_bonus', 'plan_run', 'streak']),
  sourceType: z.string(),
  sourceId: z.string(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdAt: z.string().datetime(),
});

export type ScoreEvent = z.infer<typeof ScoreEventSchema>;

export const ScoreEventCreateSchema = ScoreEventSchema.omit({
  id: true,
  createdAt: true,
});

export type ScoreEventCreate = z.infer<typeof ScoreEventCreateSchema>;
