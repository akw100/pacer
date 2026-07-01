import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toDateKey } from '@pacer/shared';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';

// Real Habits data layer. Reads habits via the API; reads today's checks
// directly from Supabase JS (`habit_checks` has own-rows RLS) because the
// API does not expose a GET endpoint for checks. Both reads share TanStack
// Query keys so invalidation is uniform.

// Server shape: snake_case rows from `select *`. We keep types local rather
// than refactor the shared zod schema (camelCase) — out of scope.
export interface HabitRow {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  sort: number;
  archived_at: string | null;
  created_at: string;
}

export interface HabitCheckRow {
  id: string;
  user_id: string;
  habit_id: string;
  check_date: string;
  created_at: string;
}

const habitKeys = {
  list: ['habits', 'list'] as const,
  checksToday: (dateKey: string) => ['habits', 'checks', dateKey] as const,
  /** Same key shape as `checksToday` — reused for arbitrary-date reads so
   *  today and past-date invalidation share cache lanes. */
  checksForDate: (dateKey: string) => ['habits', 'checks', dateKey] as const,
};

function useToken(): string | null {
  return useAuth().session?.access_token ?? null;
}

export function useHabits() {
  const token = useToken();
  return useQuery<HabitRow[]>({
    queryKey: habitKeys.list,
    queryFn: () => apiFetch<HabitRow[]>('/habits', { token: token! }),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

/**
 * Read today's habit_checks for the signed-in user directly from Supabase.
 * RLS restricts to own rows; the anon key is enough — no service-role
 * surface lives in the browser.
 */
export function useTodayChecks() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const todayKey = toDateKey(new Date());
  return useQuery<HabitCheckRow[]>({
    queryKey: habitKeys.checksToday(todayKey),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('habit_checks')
        .select('id, user_id, habit_id, check_date, created_at')
        .eq('user_id', userId!)
        .eq('check_date', todayKey);
      if (error) throw new Error(error.message);
      return (data ?? []) as HabitCheckRow[];
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}

export function useCreateHabit() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; emoji: string; sort?: number }) =>
      apiFetch<HabitRow>('/habits', { token: token!, method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: habitKeys.list }),
  });
}

export function useDeleteHabit() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/habits/${id}`, { token: token!, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: habitKeys.list });
      qc.invalidateQueries({ queryKey: ['habits', 'checks'] });
    },
  });
}

// The shell apiFetch supports GET/POST/PATCH/DELETE; the habit-check endpoint
// is PUT. Rather than expand that shared client just for one method, fire a
// thin PUT with the same Authorization header here.
const API_URL =
  ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_URL) ??
  'http://localhost:8787';

async function putBare(path: string, token: string): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.text().then((t) => (t ? JSON.parse(t) : null));
}

export function useCheckHabitToday() {
  const token = useToken();
  const qc = useQueryClient();
  const todayKey = toDateKey(new Date());
  return useMutation({
    mutationFn: (habitId: string) =>
      putBare(`/habits/${habitId}/check?date=${todayKey}`, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: habitKeys.checksToday(todayKey) });
      // Score summary changes via the scoring subscriber.
      qc.invalidateQueries({ queryKey: ['score', 'summary'] });
    },
  });
}

export function useUncheckHabitToday() {
  const token = useToken();
  const qc = useQueryClient();
  const todayKey = toDateKey(new Date());
  return useMutation({
    mutationFn: (habitId: string) =>
      apiFetch<void>(`/habits/${habitId}/check?date=${todayKey}`, {
        token: token!,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: habitKeys.checksToday(todayKey) });
      qc.invalidateQueries({ queryKey: ['score', 'summary'] });
    },
  });
}

// ── Arbitrary-date variants ────────────────────────────────────────────────
// The backend accepts any date via ?date=YYYY-MM-DD on PUT/DELETE
// /habits/:id/check — we just needed a client that respects the caller's
// picked date instead of hard-coding today. Existing today-only hooks stay
// (Home reads today's snapshot via useTodayChecks / useHomeData), so this
// is additive.

/**
 * Read the caller's habit_checks for a specific date. Same cache key as
 * `useTodayChecks(today)`, so invalidations line up naturally.
 */
export function useHabitChecksForDate(dateKey: string) {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery<HabitCheckRow[]>({
    queryKey: habitKeys.checksForDate(dateKey),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('habit_checks')
        .select('id, user_id, habit_id, check_date, created_at')
        .eq('user_id', userId!)
        .eq('check_date', dateKey);
      if (error) throw new Error(error.message);
      return (data ?? []) as HabitCheckRow[];
    },
    enabled: !!userId && !!dateKey,
    staleTime: 30 * 1000,
  });
}

/**
 * Check a habit for the given date. Server upserts on unique
 * (habit_id, check_date) so retries are safe.
 */
export function useCheckHabit(dateKey: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (habitId: string) =>
      putBare(`/habits/${habitId}/check?date=${dateKey}`, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: habitKeys.checksForDate(dateKey) });
      qc.invalidateQueries({ queryKey: ['score', 'summary'] });
    },
  });
}

/** Uncheck a habit for the given date. */
export function useUncheckHabit(dateKey: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (habitId: string) =>
      apiFetch<void>(`/habits/${habitId}/check?date=${dateKey}`, {
        token: token!,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: habitKeys.checksForDate(dateKey) });
      qc.invalidateQueries({ queryKey: ['score', 'summary'] });
    },
  });
}
