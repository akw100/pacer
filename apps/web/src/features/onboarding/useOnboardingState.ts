import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HintId, OnboardingPatch, OnboardingState } from '@pacer/shared';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';

// TanStack Query hook for the onboarding/hints state. Fail-open: the rest of
// the app must keep working even if this endpoint dies — the carousel and
// hints just don't show in that case.

const KEY = ['onboarding', 'state'] as const;

export function useOnboardingState() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  return useQuery<OnboardingState>({
    queryKey: KEY,
    queryFn: () => apiFetch<OnboardingState>('/onboarding/state', { token: token! }),
    enabled: !!token,
    staleTime: 60 * 1000,
    // Quiet retry — failure here is non-blocking.
    retry: 1,
  });
}

export function usePatchOnboarding() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: OnboardingPatch) =>
      apiFetch<OnboardingState>('/onboarding/state', {
        token: token!,
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: (next) => qc.setQueryData(KEY, next),
  });
}

/** Convenience: dismiss a hint by id. */
export function useDismissHint() {
  const patch = usePatchOnboarding();
  return (id: HintId) => patch.mutateAsync({ dismiss_hint: id });
}
