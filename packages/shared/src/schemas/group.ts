import { z } from 'zod';

// Private groups: a small invite-by-code circle for family/friends.
// Each group has one owner and many members. A user can belong to many groups.
// Activity sharing into a group is handled by the optional `shared_group_id`
// on runs/workouts — see runs.ts / workouts.ts. A group itself doesn't OWN
// the activity; the user does. The group is just an audience tag.

const JOIN_CODE_REGEX = /^[A-HJ-KMN-PR-TV-Z2-9]{6}$/;

export const JoinCodeSchema = z.string().regex(JOIN_CODE_REGEX, 'Invalid join code');

export const GroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(60),
  join_code: JoinCodeSchema,
  owner_id: z.string().uuid(),
  created_at: z.string(),
});
export type Group = z.infer<typeof GroupSchema>;

export const GroupMemberSchema = z.object({
  group_id: z.string().uuid(),
  user_id: z.string().uuid(),
  joined_at: z.string(),
});
export type GroupMember = z.infer<typeof GroupMemberSchema>;

// Membership row joined with the member's display profile fields — what the
// member list and avatar stack actually render.
export const GroupMemberWithProfileSchema = GroupMemberSchema.extend({
  handle: z.string(),
  display_name: z.string(),
  avatar_emoji: z.string().nullish(),
});
export type GroupMemberWithProfile = z.infer<typeof GroupMemberWithProfileSchema>;

// Inputs

export const CreateGroupInputSchema = z.object({
  name: z.string().min(1).max(60),
});
export type CreateGroupInput = z.infer<typeof CreateGroupInputSchema>;

export const JoinGroupInputSchema = z.object({
  join_code: JoinCodeSchema,
});
export type JoinGroupInput = z.infer<typeof JoinGroupInputSchema>;

export const RenameGroupInputSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  regenerate_code: z.boolean().optional(),
});
export type RenameGroupInput = z.infer<typeof RenameGroupInputSchema>;
