import { z } from 'zod';

// Per-user onboarding + contextual-hint state. Mirrors the
// `onboarding_state` table (migration 0004). RLS scope: own-rows only.
//
// `dismissed_hints` is an append-only string array — the UI dismisses by id;
// the server unions it into the existing array. New hints are added by
// appending to the HintId union; never remove an id (forwards-compat for
// users with old client builds).

export type HintId = 'bot-photo' | 'first-challenge';

const HintIdSchema = z.enum(['bot-photo', 'first-challenge']);

export const OnboardingStateSchema = z.object({
  user_id: z.string().uuid(),
  completed_at: z.string().nullable().optional(),
  skipped_at: z.string().nullable().optional(),
  coachmarks_done_at: z.string().nullable().optional(),
  dismissed_hints: z.array(HintIdSchema),
  created_at: z.string(),
});
export type OnboardingState = z.infer<typeof OnboardingStateSchema>;

// PATCH body — any subset of these is allowed. `dismissed_hints` here is a
// SINGLE id to append; the server unions it into the column array.
export const OnboardingPatchSchema = z
  .object({
    completed_at: z.string().datetime().nullable().optional(),
    skipped_at: z.string().datetime().nullable().optional(),
    coachmarks_done_at: z.string().datetime().nullable().optional(),
    dismiss_hint: HintIdSchema.optional(),
  })
  .refine(
    (v) =>
      v.completed_at !== undefined ||
      v.skipped_at !== undefined ||
      v.coachmarks_done_at !== undefined ||
      v.dismiss_hint !== undefined,
    { message: 'PATCH body must include at least one field' },
  );
export type OnboardingPatch = z.infer<typeof OnboardingPatchSchema>;

/**
 * The bot-photo contextual hint appears after the user has logged at least 3
 * runs manually AND hasn't dismissed the hint yet. Pure — caller fetches
 * the count + dismissed list.
 */
export function shouldShowBotPhotoHint(
  runCount: number,
  dismissed: readonly HintId[],
): boolean {
  return runCount >= 3 && !dismissed.includes('bot-photo');
}

/**
 * The "first challenge" hint appears after the user has joined a group and
 * hasn't dismissed it yet. Pure.
 */
export function shouldShowFirstChallengeHint(
  isInAnyGroup: boolean,
  dismissed: readonly HintId[],
): boolean {
  return isInAnyGroup && !dismissed.includes('first-challenge');
}
