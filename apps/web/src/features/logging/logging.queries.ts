import type { QueryClient } from '@tanstack/react-query';

// One place to spell out cache keys and the invalidation map. Every mutation
// in `useLogging` calls `invalidateLogging(qc)` so History and Trends both
// refetch in lockstep — the realtime layer also calls this on its
// `broadcast('user:<id>', { type: 'run' | 'workout' })` events.

export const loggingKeys = {
  runs: ['runs'] as const,
  runsRange: (from?: string, to?: string) => ['runs', { from, to }] as const,
  workouts: ['workouts'] as const,
  workoutsRange: (from?: string, to?: string) => ['workouts', { from, to }] as const,
};

export function invalidateLogging(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: loggingKeys.runs });
  qc.invalidateQueries({ queryKey: loggingKeys.workouts });
}
