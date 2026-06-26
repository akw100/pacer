import { z } from 'zod';

// Reactions live on group feeds: a co-member taps 👏 / 🔥 / 💪 on someone's
// run, workout, or habit day. Insert/select are RLS-gated by
// shares_group_with(); see 0003_groups_and_share.sql.

export const ReactionTargetTypeSchema = z.enum(['run', 'workout', 'habit_day']);
export type ReactionTargetType = z.infer<typeof ReactionTargetTypeSchema>;

export const ReactionEmojiSchema = z.enum(['👏', '🔥', '💪']);
export type ReactionEmoji = z.infer<typeof ReactionEmojiSchema>;

export const ReactionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  target_type: ReactionTargetTypeSchema,
  target_id: z.string().uuid(),
  emoji: ReactionEmojiSchema,
  created_at: z.string(),
});
export type Reaction = z.infer<typeof ReactionSchema>;

export const AddReactionInputSchema = ReactionSchema.pick({
  target_type: true,
  target_id: true,
  emoji: true,
});
export type AddReactionInput = z.infer<typeof AddReactionInputSchema>;
