import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChallengeWithProgress,
  CreateChallengeInput,
  RespondChallengeInput,
  CheckInInput,
} from '@pacer/shared';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { challengeKeys, invalidateChallenges } from './challenges.queries';

function useToken(): string | null {
  return useAuth().session?.access_token ?? null;
}

export function useChallenges() {
  const token = useToken();
  return useQuery<ChallengeWithProgress[]>({
    queryKey: challengeKeys.list,
    queryFn: () => apiFetch<ChallengeWithProgress[]>('/challenges', { token: token! }),
    enabled: !!token,
  });
}

export function useCreateChallenge() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChallengeInput) =>
      apiFetch<ChallengeWithProgress>('/challenges', { token: token!, method: 'POST', body: input }),
    onSuccess: () => invalidateChallenges(qc),
  });
}

export function useRespondChallenge() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string } & RespondChallengeInput) =>
      apiFetch<ChallengeWithProgress>(`/challenges/${id}/respond`, {
        token: token!,
        method: 'POST',
        body: { status },
      }),
    onSuccess: () => invalidateChallenges(qc),
  });
}

export function useJoinChallenge() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ChallengeWithProgress>(`/challenges/${id}/join`, { token: token!, method: 'POST' }),
    onSuccess: () => invalidateChallenges(qc),
  });
}

export function useCheckIn() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date }: { id: string } & CheckInInput) =>
      apiFetch<ChallengeWithProgress>(`/challenges/${id}/check-in`, {
        token: token!,
        method: 'POST',
        body: { date },
      }),
    onSuccess: () => invalidateChallenges(qc),
  });
}

export function useDeleteChallenge() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/challenges/${id}`, { token: token!, method: 'DELETE' }),
    onSuccess: () => invalidateChallenges(qc),
  });
}

/**
 * Keep the challenge list live: a `challenge.updated` broadcast on the caller's
 * user channel (someone responded, joined, checked in, or the actor logged
 * activity that moves a metric) just invalidates the list — we refetch through
 * the normal API so RLS and progress derivation stay server-side.
 */
export function useChallengesRealtime() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    // Same topic the API broadcasts to (`user:<id>`); filter to challenge events.
    const channel = supabase.channel(`user:${userId}`, { config: { broadcast: { self: true } } });
    channel.on('broadcast', { event: 'challenge.updated' }, () => invalidateChallenges(qc));
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}
