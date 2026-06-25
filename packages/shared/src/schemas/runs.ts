import { z } from 'zod'

export const RunCreateSchema = z.object({
  distance_meters: z.number().int().nonnegative(),
  duration_seconds: z.number().int().nonnegative(),
  run_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export type RunCreate = z.infer<typeof RunCreateSchema>
