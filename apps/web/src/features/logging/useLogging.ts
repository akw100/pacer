import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Run, RunInput, Workout, WorkoutInput } from '@pacer/shared';
import { invalidateLogging, loggingKeys } from './logging.queries';

// Slice-local fetch wrapper. The shell-owned `lib/api.ts` does not exist yet,
// so we resolve the API base from VITE_API_URL and ship a tiny `apiFetch` here.
// When the shell adds its typed client, swap this for that import in a single
// edit — no caller changes.

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    // Body may be a zod-shaped 422 or a plain error; surface text either way.
    const text = await res.text().catch(() => '');
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

// ── Runs ───────────────────────────────────────────────────────────────────

export function useRuns(range?: { from?: string; to?: string }) {
  return useQuery<Run[]>({
    queryKey: loggingKeys.runsRange(range?.from, range?.to),
    queryFn: () => {
      const params = new URLSearchParams();
      if (range?.from) params.set('from', range.from);
      if (range?.to) params.set('to', range.to);
      const qs = params.toString();
      return apiFetch<Run[]>(`/runs${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useCreateRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RunInput) =>
      apiFetch<Run>(`/runs`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidateLogging(qc),
  });
}

export function useUpdateRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<RunInput> }) =>
      apiFetch<Run>(`/runs/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => invalidateLogging(qc),
  });
}

export function useDeleteRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/runs/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateLogging(qc),
  });
}

// ── Workouts ───────────────────────────────────────────────────────────────

export function useWorkouts(range?: { from?: string; to?: string }) {
  return useQuery<Workout[]>({
    queryKey: loggingKeys.workoutsRange(range?.from, range?.to),
    queryFn: () => {
      const params = new URLSearchParams();
      if (range?.from) params.set('from', range.from);
      if (range?.to) params.set('to', range.to);
      const qs = params.toString();
      return apiFetch<Workout[]>(`/workouts${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useCreateWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkoutInput) =>
      apiFetch<Workout>(`/workouts`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidateLogging(qc),
  });
}

export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/workouts/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateLogging(qc),
  });
}
