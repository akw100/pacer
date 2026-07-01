import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChallengeWithProgress,
  CreateChallengeInput,
  UpdateChallengeInput,
  RespondChallengeInput,
  CheckInInput,
} from '@pacer/shared';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';
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
    // Drop the returned (fully enriched) challenge straight into the cached list
    // so the creator sees it instantly — like every other mutation here patches
    // the cache. The invalidate then reconciles with server truth.
    onSuccess: (created) => {
      qc.setQueryData<ChallengeWithProgress[]>(challengeKeys.list, (prev) =>
        prev ? [created, ...prev.filter((c) => c.id !== created.id)] : [created],
      );
      invalidateChallenges(qc);
    },
  });
}

// Optimistically patch one challenge in the cached list; returns the snapshot
// so onError can roll back. Shared by respond/join so the UI reacts instantly.
async function optimisticPatch(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
  patch: (c: ChallengeWithProgress) => ChallengeWithProgress,
): Promise<{ previous?: ChallengeWithProgress[] }> {
  await qc.cancelQueries({ queryKey: challengeKeys.list });
  const previous = qc.getQueryData<ChallengeWithProgress[]>(challengeKeys.list);
  if (previous) {
    qc.setQueryData<ChallengeWithProgress[]>(
      challengeKeys.list,
      previous.map((c) => (c.id === id ? patch(c) : c)),
    );
  }
  return { previous };
}

function rollback(qc: ReturnType<typeof useQueryClient>, ctx?: { previous?: ChallengeWithProgress[] }) {
  if (ctx?.previous) qc.setQueryData(challengeKeys.list, ctx.previous);
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
    onMutate: ({ id, status }) => optimisticPatch(qc, id, (c) => ({ ...c, my_status: status })),
    onError: (_e, _v, ctx) => rollback(qc, ctx),
    onSettled: () => invalidateChallenges(qc),
  });
}

export function useJoinChallenge() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ChallengeWithProgress>(`/challenges/${id}/join`, { token: token!, method: 'POST' }),
    onMutate: (id) =>
      optimisticPatch(qc, id, (c) => ({
        ...c,
        my_status: 'accepted',
        accepted_count: c.accepted_count + 1,
        participant_count: c.participant_count + 1,
      })),
    onError: (_e, _v, ctx) => rollback(qc, ctx),
    onSettled: () => invalidateChallenges(qc),
  });
}

export function useCheckIn() {
  const token = useToken();
  const qc = useQueryClient();
  const userId = useAuth().session?.user.id ?? null;
  return useMutation({
    mutationFn: ({ id, date }: { id: string } & CheckInInput) =>
      apiFetch<ChallengeWithProgress>(`/challenges/${id}/check-in`, {
        token: token!,
        method: 'POST',
        body: { date },
      }),
    // Optimistic: a check-in adds exactly 1 to my progress — bump it instantly
    // so the bar + odometer move before the round-trip, then reconcile on settle.
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: challengeKeys.list });
      const previous = qc.getQueryData<ChallengeWithProgress[]>(challengeKeys.list);
      if (previous && userId) {
        qc.setQueryData<ChallengeWithProgress[]>(
          challengeKeys.list,
          previous.map((c) =>
            c.id === id
              ? {
                  ...c,
                  my_progress: c.my_progress + 1,
                  leaderboard: c.leaderboard.map((r) =>
                    r.user_id === userId ? { ...r, progress: r.progress + 1 } : r,
                  ),
                }
              : c,
          ),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(challengeKeys.list, ctx.previous);
    },
    onSettled: () => invalidateChallenges(qc),
  });
}

export function useUpdateChallenge() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & UpdateChallengeInput) =>
      apiFetch<ChallengeWithProgress>(`/challenges/${id}`, { token: token!, method: 'PATCH', body: patch }),
    onSuccess: () => invalidateChallenges(qc),
  });
}

export function useDeleteChallenge() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/challenges/${id}`, { token: token!, method: 'DELETE' }),
    // Remove the cancelled challenge from the list immediately so it vanishes
    // from the hub the instant you confirm; restore it if the request fails.
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: challengeKeys.list });
      const previous = qc.getQueryData<ChallengeWithProgress[]>(challengeKeys.list);
      if (previous) {
        qc.setQueryData<ChallengeWithProgress[]>(challengeKeys.list, previous.filter((c) => c.id !== id));
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx),
    onSettled: () => invalidateChallenges(qc),
  });
}
