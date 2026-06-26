import { z } from 'zod';

// Anonymous, platform-wide community card + the caller's own percentiles.
// Returned by GET /stats/platform. The privacy rule (card 08) is hard: the
// shape MUST NOT include user_id / handle / display_name / any per-user row.
// Display values for the community block are PRE-DERIVED on the server
// (weekKm in km, avgPaceSecondsPerKm) because there's nothing per-user the
// client could re-derive; canonical meters never leave the server here.

export const PlatformCommunitySchema = z.object({
  /** Total platform distance this week, in km (already derived via metersToKm). */
  weekKm: z.number().nonnegative(),
  runsToday: z.number().int().nonnegative(),
  habitsCheckedToday: z.number().int().nonnegative(),
  /** 0 = Sunday, 6 = Saturday. Null if no runs in the last ~90 days. */
  popularRunWeekday: z.number().int().min(0).max(6).nullable(),
  popularRunHour: z.number().int().min(0).max(23).nullable(),
  /** Average pace across the week, seconds per km. Null if no distance. */
  avgPaceSecondsPerKm: z.number().positive().nullable(),
});
export type PlatformCommunity = z.infer<typeof PlatformCommunitySchema>;

export const PlatformPercentilesSchema = z.object({
  /** 0-100 where 100 = top. Null when caller has no runs or source missing. */
  distancePercentile: z.number().min(0).max(100).nullable(),
  scorePercentile: z.number().min(0).max(100).nullable(),
  streakPercentile: z.number().min(0).max(100).nullable(),
});
export type PlatformPercentiles = z.infer<typeof PlatformPercentilesSchema>;

export const PlatformStatsResponseSchema = z.object({
  community: PlatformCommunitySchema,
  you: PlatformPercentilesSchema,
  /** Inclusive ISO yyyy-MM-dd of the week start used by the aggregation. */
  weekStartIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type PlatformStats = z.infer<typeof PlatformStatsResponseSchema>;
