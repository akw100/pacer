import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateGroupInviteInput,
  GroupInviteWithProfiles,
} from '@pacer/shared';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { groupKeys, invalidateGroupInvites } from './groups.queries';

// React Query hooks for group invites. Mirrors the patterns in `useGroups.ts`
// and `useFriends.ts`: token-gated queries, invalidation by mutation, no
// client-side trust assumptions.
//
// Visibility note: `/groups/:id/invites` is filtered server-side by the RLS
// SELECT policy (invited_user OR invited_by OR group owner). A regular
// group member who is NOT the inviter and NOT the owner will see an empty
// list — that's intentional. The UI must NOT assume it can see every
// pending invite in the group. See `InviteSheet.tsx` for the 409 handler
// that covers the "someone else already invited this friend" case.

function useToken(): string | null {
  return useAuth().session?.access_token ?? null;
}

/** GET /groups/:id/invites — pending only. RLS scopes the result to what
 *  the caller is allowed to see. */
export function useGroupInvites(groupId: string | null) {
  const token = useToken();
  return useQuery<GroupInviteWithProfiles[]>({
    queryKey: groupKeys.invites(groupId ?? ''),
    queryFn: () =>
      apiFetch<GroupInviteWithProfiles[]>(`/groups/${groupId}/invites`, {
        token: token!,
      }),
    enabled: !!token && !!groupId,
    staleTime: 30 * 1000,
  });
}

/** GET /group-invites/me — pending invites the caller has received. */
export function useMyGroupInvites() {
  const token = useToken();
  return useQuery<GroupInviteWithProfiles[]>({
    queryKey: groupKeys.myInvites,
    queryFn: () =>
      apiFetch<GroupInviteWithProfiles[]>('/group-invites/me', { token: token! }),
    enabled: !!token,
    staleTime: 30 * 1000,
  });
}

/** POST /groups/:id/invites — body `{invited_user_id}`. The backend sets
 *  `invited_by` from the JWT; the UI never sends it. */
export function useInviteFriendToGroup(groupId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGroupInviteInput) =>
      apiFetch<GroupInviteWithProfiles>(`/groups/${groupId}/invites`, {
        token: token!,
        method: 'POST',
        body: input,
      }),
    onSuccess: () => invalidateGroupInvites(qc, groupId),
  });
}

/** POST /group-invites/:inviteId/accept — invited_user only. Race-safe:
 *  the backend UPSERTs into group_members so a stale invite still resolves
 *  cleanly. After success, refresh both the group list (new membership)
 *  and the caller's /me invite list. */
export function useAcceptGroupInvite() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch<GroupInviteWithProfiles>(`/group-invites/${inviteId}/accept`, {
        token: token!,
        method: 'POST',
      }),
    onSuccess: () => {
      invalidateGroupInvites(qc);
      qc.invalidateQueries({ queryKey: groupKeys.mine });
    },
  });
}

/** POST /group-invites/:inviteId/decline — invited_user only. */
export function useDeclineGroupInvite() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch<GroupInviteWithProfiles>(`/group-invites/${inviteId}/decline`, {
        token: token!,
        method: 'POST',
      }),
    onSuccess: () => invalidateGroupInvites(qc),
  });
}

/** DELETE /group-invites/:inviteId — invited_by only; pending only. Hard
 *  delete (mirrors the friends-cancel flow). `groupId` is provided here
 *  so we can scope the invalidation to that group's invite list too. */
export function useCancelGroupInvite(groupId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch<void>(`/group-invites/${inviteId}`, {
        token: token!,
        method: 'DELETE',
      }),
    onSuccess: () => invalidateGroupInvites(qc, groupId),
  });
}
