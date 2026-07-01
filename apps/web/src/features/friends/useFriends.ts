import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  FriendLookupResponse,
  FriendRequestByEmailInput,
  FriendRequestByEmailResponse,
  FriendRequestInput,
  Friendship,
  FriendshipWithProfile,
  FriendsLeaderboardResponse,
  FriendsListResponse,
} from '@pacer/shared';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { friendKeys, invalidateAllFriends } from './friends.queries';

// React Query hooks for the Friends slice. Every call attaches the caller's
// Supabase JWT via `apiFetch`. The API verifies it, runs participant /
// transition checks, and only then touches the DB. The hook never bypasses
// auth.
//
// Friend-list mutations exposed: request / accept / decline / remove. The
// remove hook also covers cancelling an outgoing pending request (the API
// uses the same DELETE path for both). Any additional moderation actions
// will land in a follow-up once their management UI is designed.

function useToken(): string | null {
  return useAuth().session?.access_token ?? null;
}

/** GET /friends — grouped as accepted / incoming / outgoing. */
export function useFriendsList() {
  const token = useToken();
  return useQuery<FriendsListResponse>({
    queryKey: friendKeys.list,
    queryFn: () => apiFetch<FriendsListResponse>('/friends', { token: token! }),
    enabled: !!token,
    staleTime: 30 * 1000,
  });
}

/** GET /friends/leaderboard — accepted friends + the caller, this week. */
export function useFriendsLeaderboard() {
  const token = useToken();
  return useQuery<FriendsLeaderboardResponse>({
    queryKey: friendKeys.leaderboard,
    queryFn: () =>
      apiFetch<FriendsLeaderboardResponse>('/friends/leaderboard', { token: token! }),
    enabled: !!token,
    staleTime: 30 * 1000,
  });
}

/**
 * GET /friends/lookup?handle= — manual trigger (mutation) since the user
 * decides when to search and we don't want a key-storm of cached lookups.
 */
export function useFriendLookup() {
  const token = useToken();
  return useMutation({
    mutationFn: (handle: string) =>
      apiFetch<FriendLookupResponse>(
        `/friends/lookup?handle=${encodeURIComponent(handle)}`,
        { token: token! },
      ),
  });
}

/** POST /friends/request — body `{handle}` or `{user_id}`. Identity for the
 *  requester is taken from the JWT server-side; we never send it from here. */
export function useFriendRequest() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FriendRequestInput) =>
      apiFetch<Friendship>('/friends/request', {
        token: token!,
        method: 'POST',
        body: input,
      }),
    onSuccess: () => invalidateAllFriends(qc),
  });
}

/**
 * POST /friends/request-by-email — dedicated endpoint for the "add by email"
 * flow. Response is `{ status: 'queued' }` when the email doesn't belong to
 * a Pacer user (privacy-safe: caller cannot enumerate), otherwise the full
 * Friendship row. Invalidates the friends list either way so a newly-created
 * outgoing request appears immediately.
 */
export function useFriendRequestByEmail() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FriendRequestByEmailInput) =>
      apiFetch<FriendRequestByEmailResponse>('/friends/request-by-email', {
        token: token!,
        method: 'POST',
        body: input,
      }),
    onSuccess: () => invalidateAllFriends(qc),
  });
}

/** POST /friends/:userId/accept — addressee only (enforced by API). */
export function useFriendAccept() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<Friendship>(`/friends/${userId}/accept`, {
        token: token!,
        method: 'POST',
      }),
    onSuccess: () => invalidateAllFriends(qc),
  });
}

/** POST /friends/:userId/decline — addressee only (enforced by API). */
export function useFriendDecline() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<Friendship>(`/friends/${userId}/decline`, {
        token: token!,
        method: 'POST',
      }),
    onSuccess: () => invalidateAllFriends(qc),
  });
}

/**
 * DELETE /friends/:userId — used for BOTH "remove accepted friend" and
 * "cancel outgoing pending request". The backend permits either participant
 * to delete the row; UI surfaces the two flows with different copy.
 */
export function useFriendRemove() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<void>(`/friends/${userId}`, { token: token!, method: 'DELETE' }),
    onSuccess: () => invalidateAllFriends(qc),
  });
}

// Re-export the row type from shared so feature files don't have to import
// from two places.
export type { FriendshipWithProfile };
