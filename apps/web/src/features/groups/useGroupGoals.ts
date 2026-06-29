import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateGroupGoalInput,
  GroupGoalWithProgress,
  UpdateGroupGoalInput,
} from '@pacer/shared';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { groupKeys } from './groups.queries';

// React Query hooks for group goals. Mirrors the patterns in `useGroups.ts`
// (one source of truth, token-gated queries, invalidation by mutation).
//
// Auth: every call attaches the caller's Supabase JWT via `apiFetch`. The
// API verifies it, runs membership and creator/owner checks, and only then
// touches the DB. The hook itself never bypasses auth.
//
// `current_value` / `progress_pct` / `effective_status` / `days_left` are
// all server-derived — see /apps/api/src/routes/group-goals.ts. The UI
// renders them as-is and NEVER computes them from local activity.

function useToken(): string | null {
  return useAuth().session?.access_token ?? null;
}

export function useGroupGoals(groupId: string | null) {
  const token = useToken();
  return useQuery<GroupGoalWithProgress[]>({
    queryKey: groupKeys.goals(groupId ?? ''),
    queryFn: () =>
      apiFetch<GroupGoalWithProgress[]>(`/groups/${groupId}/goals`, { token: token! }),
    enabled: !!token && !!groupId,
    staleTime: 30 * 1000,
  });
}

export function useCreateGroupGoal(groupId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGroupGoalInput) =>
      apiFetch<GroupGoalWithProgress>(`/groups/${groupId}/goals`, {
        token: token!,
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: groupKeys.goals(groupId) });
    },
  });
}

export function useUpdateGroupGoal(groupId: string, goalId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateGroupGoalInput) =>
      apiFetch<GroupGoalWithProgress>(`/groups/${groupId}/goals/${goalId}`, {
        token: token!,
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: groupKeys.goals(groupId) });
    },
  });
}

export function useArchiveGroupGoal(groupId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (goalId: string) =>
      apiFetch<GroupGoalWithProgress>(`/groups/${groupId}/goals/${goalId}/archive`, {
        token: token!,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: groupKeys.goals(groupId) });
    },
  });
}
