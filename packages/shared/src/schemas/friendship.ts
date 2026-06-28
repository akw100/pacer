import { z } from 'zod';

// Friendships / accepted social graph.
// Shape mirrors the `friendships` table created in 0005_friendships.sql.
//
// Privacy rule: any payload that includes the OTHER participant exposes only
// the minimal public profile projection {id, handle, display_name,
// avatar_emoji}. Per-user preferences (units, theme, week_start, nudge_pref,
// created_at) never leave the API in friend-context responses.

// Handle format: lowercase, 3-20 chars, [a-z0-9_]. Matches profiles.handle.
const HANDLE_REGEX = /^[a-z0-9_]{3,20}$/;
export const HandleSchema = z
  .string()
  .regex(HANDLE_REGEX, 'Invalid handle')
  .transform((s) => s.toLowerCase());

export const FriendshipStatusSchema = z.enum([
  'pending',
  'accepted',
  'declined',
  'blocked',
]);
export type FriendshipStatus = z.infer<typeof FriendshipStatusSchema>;

// Raw friendship row as stored. Used by the /friends list response so the
// client can tell direction (am I requester or addressee?) and react to
// pending/blocked states.
export const FriendshipSchema = z.object({
  requester_id: z.string().uuid(),
  addressee_id: z.string().uuid(),
  status: FriendshipStatusSchema,
  blocked_by: z.string().uuid().nullable(),
  created_at: z.string(),
  responded_at: z.string().nullable(),
});
export type Friendship = z.infer<typeof FriendshipSchema>;

// Minimal public projection of a profile — the ONLY shape the API returns
// for "the other person" in any friend-related endpoint.
export const FriendProfileSchema = z.object({
  id: z.string().uuid(),
  handle: z.string(),
  display_name: z.string(),
  avatar_emoji: z.string().nullable(),
});
export type FriendProfile = z.infer<typeof FriendProfileSchema>;

// A friendship row joined with the OTHER participant's minimal profile.
// `direction` lets the UI label this row as outgoing/incoming/established.
export const FriendshipWithProfileSchema = z.object({
  status: FriendshipStatusSchema,
  direction: z.enum(['outgoing', 'incoming']),
  blocked_by: z.string().uuid().nullable(),
  created_at: z.string(),
  responded_at: z.string().nullable(),
  other: FriendProfileSchema,
});
export type FriendshipWithProfile = z.infer<typeof FriendshipWithProfileSchema>;

// GET /friends — grouped by current state for easy rendering.
export const FriendsListResponseSchema = z.object({
  accepted: z.array(FriendshipWithProfileSchema),
  incoming: z.array(FriendshipWithProfileSchema), // pending where I'm addressee
  outgoing: z.array(FriendshipWithProfileSchema), // pending where I'm requester
});
export type FriendsListResponse = z.infer<typeof FriendsListResponseSchema>;

// POST /friends/request — one of `handle` or `user_id` is required.
// The API resolves the target server-side and uses auth.uid() as requester.
export const FriendRequestInputSchema = z
  .object({
    handle: HandleSchema.optional(),
    user_id: z.string().uuid().optional(),
  })
  .refine((v) => !!v.handle !== !!v.user_id, {
    message: 'Provide exactly one of handle or user_id',
  });
export type FriendRequestInput = z.infer<typeof FriendRequestInputSchema>;

// GET /friends/lookup?handle=:handle — minimal profile, or null if not found
// OR if visibility is restricted (e.g. caller is blocked by target). The API
// never differentiates these to avoid leaking block status.
export const FriendLookupResponseSchema = FriendProfileSchema.nullable();
export type FriendLookupResponse = z.infer<typeof FriendLookupResponseSchema>;

// GET /friends/leaderboard
// Accepted friends + caller only. Same numeric schema as group-stats so the
// UI can reuse the same row component if desired. The leaderboard is
// computed server-side and never returns activity rows — only aggregates.
export const FriendLeaderboardRowSchema = z.object({
  user_id: z.string().uuid(),
  handle: z.string(),
  display_name: z.string(),
  avatar_emoji: z.string().nullable(),
  score: z.number().int().nonnegative(),
  distance_meters: z.number().nonnegative(),
  runs: z.number().int().nonnegative(),
  workouts: z.number().int().nonnegative(),
});
export type FriendLeaderboardRow = z.infer<typeof FriendLeaderboardRowSchema>;

export const FriendsLeaderboardResponseSchema = z.object({
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  week_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  leaderboard: z.array(FriendLeaderboardRowSchema),
  you_vs_friends: z.object({
    rank: z.number().int().positive().nullable(),
    score_gap_to_first: z.number().int().nonnegative(),
  }),
});
export type FriendsLeaderboardResponse = z.infer<typeof FriendsLeaderboardResponseSchema>;
