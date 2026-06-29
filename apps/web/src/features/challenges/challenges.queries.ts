import type { QueryClient } from '@tanstack/react-query';

// Query keys for the challenges slice. The list endpoint returns each challenge
// fully enriched (state + leaderboard), so the detail panel reads from this one
// cached list rather than a second round-trip. Realtime `challenge.updated`
// events on the user channel invalidate `challenges.list`.

export const challengeKeys = {
  list: ['challenges', 'list'] as const,
};

export function invalidateChallenges(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: challengeKeys.list });
}
