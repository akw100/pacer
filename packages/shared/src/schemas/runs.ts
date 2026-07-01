import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const RunCreateSchema = z.object({
  run_date:         z.string().regex(dateRegex, 'Expected yyyy-mm-dd'),
  distance_meters:  z.number().positive(),
  duration_seconds: z.number().int().positive(),
  exertion_rating:  z.number().int().min(1).max(10).nullish(),
  warm_up:          z.boolean().default(false),
  stretched:        z.boolean().default(false),
  post_run_food:    z.boolean().default(false),
  sleep_hours:      z.number().min(0).max(24).nullish(),
  notes:            z.string().max(2000).nullish(),
  source:           z.enum(['web', 'telegram', 'race']).default('web'),
  // Optional group share — the run is ALWAYS personal; this only flags it for
  // a single group's feed/leaderboard. Server validates membership. Null /
  // omitted = personal only. See migration 0003_groups_and_share.sql.
  shared_group_id:  z.string().uuid().nullish(),
});
export type RunCreate = z.infer<typeof RunCreateSchema>;

export const RunUpdateSchema = RunCreateSchema.partial();
export type RunUpdate = z.infer<typeof RunUpdateSchema>;

export const RunSchema = RunCreateSchema.extend({
  id:         z.string().uuid(),
  user_id:    z.string().uuid(),
  created_at: z.string(),
});
export type Run = z.infer<typeof RunSchema>;
