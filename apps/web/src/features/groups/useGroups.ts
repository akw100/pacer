import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddReactionInput,
  CreateGroupInput,
  Group,
  GroupMemberWithProfile,
  JoinGroupInput,
  RenameGroupInput,
  WorkoutKindCounts,
} from '@pacer/shared';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { groupKeys, invalidateAllGroups, invalidateGroup } from './groups.queries';

export interface GroupListItem extends Group {
  member_count: number;
}

export interface GroupDetail extends Group {
  members: GroupMemberWithProfile[];
}

export interface LeaderboardRow {
  user_id: string;
  display_name: string;
  handle: string;
  avatar_emoji: string | null;
  score: number;
  distance_meters: number;
  runs: number;
  workouts: number;
  /**
   * Optional per-kind breakdown of the group-tagged workouts that make
   * up `workouts` for this member. Optional so old backend responses
   * still parse; when the server rolls out `workout_kind_counts` the UI
   * can start reading it. When absent the client falls back to the
   * top-level `workouts` count.
   */
  workout_kind_counts?: WorkoutKindCounts;
}
export interface GroupStats {
  group_id: string;
  week_start: string;
  week_end: string;
  leaderboard: LeaderboardRow[];
  totals: {
    week_distance_meters: number;
    week_runs: number;
    week_workouts: number;
    week_score: number;
  };
  you_vs_group: {
    you: LeaderboardRow | null;
    avg_distance_meters: number;
    avg_score: number;
    avg_runs: number;
    score_gap_to_first: number;
    rank: number | null;
  };
}

export interface GroupFeedItem {
  id: string;
  kind: 'run' | 'workout';
  user_id: string;
  display_name: string;
  handle: string;
  avatar_emoji: string | null;
  occurred_on: string;
  created_at: string;
  distance_meters?: number;
  duration_seconds?: number;
  name?: string;
  workout_kind?: string;
  reactions: Array<{ emoji: string; count: number; reacted_by_me: boolean }>;
}

function useToken(): string | null {
  return useAuth().session?.access_token ?? null;
}

export function useMyGroups() {
  const token = useToken();
  return useQuery<GroupListItem[]>({
    queryKey: groupKeys.mine,
    queryFn: () => apiFetch<GroupListItem[]>('/groups', { token: token! }),
    enabled: !!token,
  });
}

export function useGroupDetail(id: string | null) {
  const token = useToken();
  return useQuery<GroupDetail>({
    queryKey: groupKeys.detail(id ?? ''),
    queryFn: () => apiFetch<GroupDetail>(`/groups/${id}`, { token: token! }),
    enabled: !!token && !!id,
  });
}

export function useGroupStats(id: string | null) {
  const token = useToken();
  return useQuery<GroupStats>({
    queryKey: groupKeys.stats(id ?? ''),
    queryFn: () => apiFetch<GroupStats>(`/groups/${id}/stats`, { token: token! }),
    enabled: !!token && !!id,
  });
}

export function useGroupFeed(id: string | null) {
  const token = useToken();
  return useQuery<GroupFeedItem[]>({
    queryKey: groupKeys.feed(id ?? ''),
    queryFn: () => apiFetch<GroupFeedItem[]>(`/groups/${id}/feed`, { token: token! }),
    enabled: !!token && !!id,
  });
}

export function useCreateGroup() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGroupInput) =>
      apiFetch<GroupListItem>('/groups', { token: token!, method: 'POST', body: input }),
    onSuccess: () => invalidateAllGroups(qc),
  });
}

export function useJoinGroup() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: JoinGroupInput) =>
      apiFetch<Group>('/groups/join', { token: token!, method: 'POST', body: input }),
    onSuccess: () => invalidateAllGroups(qc),
  });
}

export function useRenameGroup(groupId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RenameGroupInput) =>
      apiFetch<Group>(`/groups/${groupId}`, { token: token!, method: 'PATCH', body: input }),
    onSuccess: () => {
      invalidateGroup(qc, groupId);
      invalidateAllGroups(qc);
    },
  });
}

export function useRemoveMember(groupId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<void>(`/groups/${groupId}/members/${userId}`, { token: token!, method: 'DELETE' }),
    onSuccess: () => invalidateGroup(qc, groupId),
  });
}

export function useLeaveGroup() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) =>
      apiFetch<void>(`/groups/${groupId}/members/me`, { token: token!, method: 'DELETE' }),
    onSuccess: () => invalidateAllGroups(qc),
  });
}

// Owner-only soft archive. The API sets `archived_at = now()`; the group
// drops out of `useMyGroups()` on the next refetch. History (feed, stats,
// tagged runs/workouts, goals) is preserved. Restore via useRestoreGroup.
export function useArchiveGroup() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) =>
      apiFetch<Group>(`/groups/${groupId}/archive`, { token: token!, method: 'PATCH' }),
    onSuccess: (_data, groupId) => {
      invalidateGroup(qc, groupId);
      invalidateAllGroups(qc);
    },
  });
}

export function useRestoreGroup() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) =>
      apiFetch<Group>(`/groups/${groupId}/restore`, { token: token!, method: 'PATCH' }),
    onSuccess: (_data, groupId) => {
      invalidateGroup(qc, groupId);
      invalidateAllGroups(qc);
    },
  });
}

export function useReact(groupId: string | null) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, on }: { input: AddReactionInput; on: boolean }) =>
      apiFetch<unknown>('/reactions', {
        token: token!,
        method: on ? 'POST' : 'DELETE',
        body: input,
      }),
    onSuccess: () => {
      if (groupId) qc.invalidateQueries({ queryKey: groupKeys.feed(groupId) });
    },
  });
}

/**
 * Subscribe to a single group's realtime channel and invalidate its feed/stats
 * when something changes upstream. Compact events only — clients refetch through
 * the normal API path. The caller's own `user:<id>` channel is subscribed once
 * app-wide in the Shell (see `useUserRealtime`), so it isn't duplicated here.
 */
export function useGroupRealtime(groupId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!groupId) return;
    const groupChannel = supabase.channel(`group:${groupId}`);
    groupChannel.on('broadcast', { event: '*' }, () => invalidateGroup(qc, groupId));
    groupChannel.subscribe();
    return () => {
      void supabase.removeChannel(groupChannel);
    };
  }, [groupId, qc]);
}
