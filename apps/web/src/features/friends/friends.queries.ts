import type { QueryClient } from '@tanstack/react-query';

// Query keys for the friends slice. Mirrors `groups.queries.ts`: one place to
// spell them, one invalidation map. Mutations in `useFriends.ts` import these.

export const friendKeys = {
  all: ['friends'] as const,
  list: ['friends', 'list'] as const,
  leaderboard: ['friends', 'leaderboard'] as const,
};

/** Invalidate every friends-derived cache (list + leaderboard). Use after
 *  any mutation that could change the social graph or the leaderboard
 *  participant set. */
export function invalidateAllFriends(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: friendKeys.all });
}
