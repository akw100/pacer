import type { QueryClient } from '@tanstack/react-query';

// One place to spell out group query keys + the invalidation map. Both the
// page and the LogSheet rely on `groups.mine` to know which groups to offer;
// realtime events on `group:<id>` map to feed/stats keys here.

export const groupKeys = {
  mine: ['groups', 'mine'] as const,
  detail: (id: string) => ['groups', 'detail', id] as const,
  stats: (id: string) => ['groups', 'stats', id] as const,
  feed: (id: string) => ['groups', 'feed', id] as const,
  goals: (id: string) => ['groups', 'goals', id] as const,
  invites: (id: string) => ['groups', 'invites', id] as const,
  myInvites: ['group-invites', 'me'] as const,
};

/** Invalidate every cache that surfaces group invites. Use after any
 *  mutation that changes the invite graph (create, accept, decline,
 *  cancel) so both the group's invite list and the caller's /me list
 *  refresh. */
export function invalidateGroupInvites(qc: QueryClient, groupId?: string): void {
  if (groupId) qc.invalidateQueries({ queryKey: groupKeys.invites(groupId) });
  qc.invalidateQueries({ queryKey: groupKeys.myInvites });
}

export function invalidateGroup(qc: QueryClient, groupId: string): void {
  qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
  qc.invalidateQueries({ queryKey: groupKeys.stats(groupId) });
  qc.invalidateQueries({ queryKey: groupKeys.feed(groupId) });
}

export function invalidateAllGroups(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: ['groups'] });
}
