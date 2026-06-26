import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Run, RunCreate, RunUpdate, Workout, WorkoutCreate } from '@pacer/shared';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { invalidateLogging, loggingKeys } from './logging.queries';

// Uses the shell-owned typed API client which attaches the Supabase JWT as a
// bearer token. Every hook reads the live session via useAuth() so a token
// refresh during a session never strands a mutation with a stale jwt.
//
// Previously this file shipped a tiny inline `apiFetch` that DID NOT attach
// any Authorization header — so /runs and /workouts requests hit the API
// without a bearer and were 401'd by the auth middleware. This is the fix.

function useToken(): string | null {
  return useAuth().session?.access_token ?? null;
}

// ── Runs ───────────────────────────────────────────────────────────────────

export function useRuns(range?: { from?: string; to?: string }) {
  const token = useToken();
  return useQuery<Run[]>({
    queryKey: loggingKeys.runsRange(range?.from, range?.to),
    queryFn: () => {
      const params = new URLSearchParams();
      if (range?.from) params.set('from', range.from);
      if (range?.to) params.set('to', range.to);
      const qs = params.toString();
      return apiFetch<Run[]>(`/runs${qs ? `?${qs}` : ''}`, { token: token! });
    },
    enabled: !!token,
  });
}

export function useCreateRun() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RunCreate) =>
      apiFetch<Run>('/runs', { token: token!, method: 'POST', body: input }),
    onSuccess: () => invalidateLogging(qc),
  });
}

export function useUpdateRun() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: RunUpdate }) =>
      apiFetch<Run>(`/runs/${id}`, { token: token!, method: 'PATCH', body: patch }),
    onSuccess: () => invalidateLogging(qc),
  });
}

export function useDeleteRun() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/runs/${id}`, { token: token!, method: 'DELETE' }),
    onSuccess: () => invalidateLogging(qc),
  });
}

// ── Workouts ───────────────────────────────────────────────────────────────

export function useWorkouts(range?: { from?: string; to?: string }) {
  const token = useToken();
  return useQuery<Workout[]>({
    queryKey: loggingKeys.workoutsRange(range?.from, range?.to),
    queryFn: () => {
      const params = new URLSearchParams();
      if (range?.from) params.set('from', range.from);
      if (range?.to) params.set('to', range.to);
      const qs = params.toString();
      return apiFetch<Workout[]>(`/workouts${qs ? `?${qs}` : ''}`, { token: token! });
    },
    enabled: !!token,
  });
}

export function useCreateWorkout() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkoutCreate) =>
      apiFetch<Workout>('/workouts', { token: token!, method: 'POST', body: input }),
    onSuccess: () => invalidateLogging(qc),
  });
}

export function useDeleteWorkout() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/workouts/${id}`, { token: token!, method: 'DELETE' }),
    onSuccess: () => invalidateLogging(qc),
  });
}
