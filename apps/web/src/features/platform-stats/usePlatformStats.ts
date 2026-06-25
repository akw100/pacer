import { useQuery } from '@tanstack/react-query';
import type { PlatformStats } from '@pacer/shared';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';

// TanStack Query hook for the anonymous community stats + caller percentiles.
// staleTime matches the server-side cache window — refetching more often is
// just wasted work because the API would return its cached block anyway.

const FIVE_MIN = 5 * 60 * 1000;

export function usePlatformStats() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  return useQuery<PlatformStats>({
    queryKey: ['platform-stats'],
    queryFn: () => apiFetch<PlatformStats>('/stats/platform', { token: token! }),
    enabled: !!token,
    staleTime: FIVE_MIN,
    // Quiet retry on transient errors — the card is non-critical and we'd
    // rather show the empty/error state than spin on the wire.
    retry: 1,
  });
}
