import { z } from 'zod';
import { FriendProfileSchema } from './friendship';

// Group invites — a friend can be invited to join one of your groups. The
// invited user must explicitly accept to become a group member; the backend
// never auto-adds anyone. Mirrors the shape of friendships: minimal stored
// statuses (`pending`, `accepted`, `declined`) and a partial-unique
// constraint enforcing one pending row per (group, invited) pair.

export const GroupInviteStatusSchema = z.enum(['pending', 'accepted', 'declined']);
export type GroupInviteStatus = z.infer<typeof GroupInviteStatusSchema>;

// Raw row as stored in `group_invites`.
export const GroupInviteSchema = z.object({
  id: z.string().uuid(),
  group_id: z.string().uuid(),
  invited_by: z.string().uuid(),
  invited_user: z.string().uuid(),
  status: GroupInviteStatusSchema,
  created_at: z.string(),
  responded_at: z.string().nullable(),
});
export type GroupInvite = z.infer<typeof GroupInviteSchema>;

// API response: the row joined with minimal profile projections for the
// two participants AND the group name. Privacy rule (same as the friends
// endpoints): only `{id, handle, display_name, avatar_emoji}` per user.
// Per-user preferences (units, theme, week_start, nudge_pref, created_at)
// never leave the API in invite-context responses.
export const GroupInviteWithProfilesSchema = GroupInviteSchema.extend({
  /** Pulled from `groups.name` server-side; aliased so the response shape
   *  reads unambiguously next to `inviter.display_name` / `invited.display_name`. */
  group_name: z.string(),
  inviter: FriendProfileSchema,
  invited: FriendProfileSchema,
});
export type GroupInviteWithProfiles = z.infer<typeof GroupInviteWithProfilesSchema>;

// POST /groups/:id/invites body. `group_id` is taken from the URL;
// `invited_by` is taken from the JWT — never accepted from the client.
export const CreateGroupInviteInputSchema = z.object({
  invited_user_id: z.string().uuid(),
});
export type CreateGroupInviteInput = z.infer<typeof CreateGroupInviteInputSchema>;
