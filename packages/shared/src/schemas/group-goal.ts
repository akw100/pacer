import { z } from 'zod';

// Group goals — challenges scoped to a single group with progress derived
// live from group-tagged activity (runs/workouts where
// `shared_group_id = goal.group_id`).
//
// Stored status is intentionally minimal: 'active' | 'archived'. The
// 'completed' and 'expired' states the UI cares about are DERIVED at read
// time by the API and exposed as `effective_status` — see
// GroupGoalWithProgressSchema below.

export const GroupGoalMetricSchema = z.enum(['distance', 'runs', 'workouts', 'score']);
export type GroupGoalMetric = z.infer<typeof GroupGoalMetricSchema>;

export const GroupGoalStoredStatusSchema = z.enum(['active', 'archived']);
export type GroupGoalStoredStatus = z.infer<typeof GroupGoalStoredStatusSchema>;

// What the UI renders. Computed from stored status + dates + progress.
export const GroupGoalEffectiveStatusSchema = z.enum([
  'active',
  'completed',
  'expired',
  'archived',
]);
export type GroupGoalEffectiveStatus = z.infer<typeof GroupGoalEffectiveStatusSchema>;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Raw row as stored in the `group_goals` table.
export const GroupGoalSchema = z.object({
  id: z.string().uuid(),
  group_id: z.string().uuid(),
  created_by: z.string().uuid(),
  title: z.string().min(1).max(80),
  metric: GroupGoalMetricSchema,
  // Canonical units, matching the activity tables:
  //   • distance  → meters
  //   • runs      → integer count
  //   • workouts  → integer count
  //   • score     → integer points (per shared `scoreFor()`)
  target_value: z.number().positive(),
  start_date: z.string().regex(DATE_REGEX),
  end_date: z.string().regex(DATE_REGEX),
  status: GroupGoalStoredStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type GroupGoal = z.infer<typeof GroupGoalSchema>;

// Augmented row — progress + effective status — as returned by the GET
// endpoints. Progress is computed server-side from real group-tagged
// activity; the row is NOT mutated to reflect it.
export const GroupGoalWithProgressSchema = GroupGoalSchema.extend({
  /** Current sum/count for the goal's metric in the window. Same units as target_value. */
  current_value: z.number().nonnegative(),
  /** 0–100 clamped, rounded. Reaches 100 when current >= target. */
  progress_pct: z.number().min(0).max(100),
  /** UI-facing status. Derived; never stored. */
  effective_status: GroupGoalEffectiveStatusSchema,
  /** end_date − today in whole days. Negative when past end_date. */
  days_left: z.number().int(),
});
export type GroupGoalWithProgress = z.infer<typeof GroupGoalWithProgressSchema>;

// POST /groups/:id/goals body. group_id comes from the URL; created_by is
// taken from the JWT — never accepted from the client.
export const CreateGroupGoalInputSchema = z
  .object({
    title: z.string().min(1).max(80),
    metric: GroupGoalMetricSchema,
    target_value: z.number().positive(),
    start_date: z.string().regex(DATE_REGEX),
    end_date: z.string().regex(DATE_REGEX),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: 'end_date must be on or after start_date',
    path: ['end_date'],
  });
export type CreateGroupGoalInput = z.infer<typeof CreateGroupGoalInputSchema>;

// PATCH /groups/:id/goals/:goalId body. Partial — at least one field
// required. Immutable fields are not present in this schema:
//   • id, group_id, created_by, metric — never settable after creation
//   • status — change via the dedicated /archive endpoint, not via PATCH
export const UpdateGroupGoalInputSchema = z
  .object({
    title: z.string().min(1).max(80).optional(),
    target_value: z.number().positive().optional(),
    start_date: z.string().regex(DATE_REGEX).optional(),
    end_date: z.string().regex(DATE_REGEX).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'No fields to update',
  })
  .refine(
    (v) => !v.start_date || !v.end_date || v.end_date >= v.start_date,
    {
      message: 'end_date must be on or after start_date',
      path: ['end_date'],
    },
  );
export type UpdateGroupGoalInput = z.infer<typeof UpdateGroupGoalInputSchema>;
