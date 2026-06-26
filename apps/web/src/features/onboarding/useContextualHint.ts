import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  shouldShowBotPhotoHint,
  shouldShowFirstChallengeHint,
  type HintId,
} from '@pacer/shared';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { useOnboardingState } from './useOnboardingState';

// Detects which contextual hint should fire RIGHT NOW. Pure decision logic is
// in @pacer/shared; this hook just feeds the inputs (run count, group count,
// dismissed hint ids). Detection is client-side per card 13 — no API
// subscriber for hint state.

interface HintsSnapshot {
  runCount: number;
  groupCount: number;
}

export function useContextualHint(): HintId | null {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const onboarding = useOnboardingState();
  const dismissed = (onboarding.data?.dismissed_hints ?? []) as HintId[];

  // Lightweight snapshot — one query for run count + group count via
  // existing endpoints. We tolerate either failing.
  const snapshot = useQuery<HintsSnapshot>({
    queryKey: ['hints', 'snapshot'],
    queryFn: async () => {
      const [runs, groups] = await Promise.allSettled([
        apiFetch<unknown[]>('/runs', { token: token! }),
        apiFetch<unknown[]>('/groups', { token: token! }),
      ]);
      return {
        runCount: runs.status === 'fulfilled' ? runs.value.length : 0,
        groupCount: groups.status === 'fulfilled' ? groups.value.length : 0,
      };
    },
    enabled: !!token,
    staleTime: 30 * 1000,
    retry: 0,
  });

  return useMemo<HintId | null>(() => {
    if (!snapshot.data) return null;
    if (shouldShowBotPhotoHint(snapshot.data.runCount, dismissed)) return 'bot-photo';
    if (
      shouldShowFirstChallengeHint(snapshot.data.groupCount > 0, dismissed)
    )
      return 'first-challenge';
    return null;
  }, [snapshot.data, dismissed]);
}
