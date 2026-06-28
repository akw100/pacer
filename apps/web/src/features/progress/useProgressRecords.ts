import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import {
  formatPace,
  metersToDisplayDistance,
  paceSecondsPerUnit,
  type Run,
  type Units,
} from '@pacer/shared';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { useRuns, useWorkouts } from '../logging/useLogging';

// Personal records for the Progress page. Lifetime scope (per the approved
// Stats-1 plan). Records are derived client-side from /runs, /workouts and
// /score/summary — no new backend. When a record can't be set yet (e.g.
// no runs logged), we show "—" with a teaching detail line instead of
// inventing a number.

interface ScoreSummary {
  weeklyScore: number;
  lifetimeScore: number;
  streak: number;
}

export interface PersonalRecord {
  label: 'Fastest pace' | 'Longest run' | 'Biggest week' | 'Current streak';
  value: string;
  detail: string;
}

interface UseProgressRecordsResult {
  records: PersonalRecord[] | null;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Compute the 4 personal records visible in Progress → Records. Returns
 * `records: null` while loading so the UI can render its skeleton; once
 * data is in, `records` is always a 4-item array (with "—" placeholders
 * for records the user hasn't set yet).
 */
export function useProgressRecords(units: Units = 'km'): UseProgressRecordsResult {
  const runs = useRuns();
  const workouts = useWorkouts();
  const score = useScoreSummary();

  const records = useMemo<PersonalRecord[] | null>(() => {
    if (!runs.data || !workouts.data || !score.data) return null;
    return computeRecords(runs.data, score.data, units);
  }, [runs.data, workouts.data, score.data, units]);

  return {
    records,
    isLoading: runs.isLoading || workouts.isLoading || score.isLoading,
    isError: runs.isError || workouts.isError || score.isError,
  };
}

function useScoreSummary() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  return useQuery<ScoreSummary>({
    queryKey: ['score', 'summary'],
    queryFn: () => apiFetch<ScoreSummary>('/score/summary', { token: token! }),
    enabled: !!token,
    staleTime: 30 * 1000,
  });
}

function computeRecords(runs: Run[], score: ScoreSummary, units: Units): PersonalRecord[] {
  // 1) Fastest pace — smallest seconds-per-unit across runs with positive
  //    distance and duration. `paceSecondsPerUnit` already guards 0.
  let fastest: { paceSec: number; run: Run } | null = null;
  for (const r of runs) {
    const m = Number(r.distance_meters);
    const s = Number(r.duration_seconds);
    if (!(m > 0) || !(s > 0)) continue;
    const pace = paceSecondsPerUnit(m, s, units);
    if (pace <= 0) continue;
    if (!fastest || pace < fastest.paceSec) fastest = { paceSec: pace, run: r };
  }

  // 2) Longest run — largest distance over the full history.
  let longest: Run | null = null;
  for (const r of runs) {
    const m = Number(r.distance_meters);
    if (!(m > 0)) continue;
    if (!longest || m > Number(longest.distance_meters)) longest = r;
  }

  // 3) Biggest week — Monday-start week sum (matches the rest of the app's
  //    week boundary convention).
  const byWeek = new Map<string, number>();
  for (const r of runs) {
    const m = Number(r.distance_meters);
    if (!(m > 0)) continue;
    const wkStart = format(
      startOfWeek(parseISO(r.run_date), { weekStartsOn: 1 }),
      'yyyy-MM-dd',
    );
    byWeek.set(wkStart, (byWeek.get(wkStart) ?? 0) + m);
  }
  let biggest: { sum: number; weekKey: string } | null = null;
  for (const [weekKey, sum] of byWeek) {
    if (!biggest || sum > biggest.sum) biggest = { sum, weekKey };
  }

  // Build the result list — 4 cards, always in this fixed order so the UI
  // keeps a stable 2×2 grid even when some records aren't set yet.
  const list: PersonalRecord[] = [];

  if (fastest) {
    const dist = metersToDisplayDistance(Number(fastest.run.distance_meters), units);
    list.push({
      label: 'Fastest pace',
      value: `${formatPace(fastest.paceSec)} /${units}`,
      detail: `${dist.value.toFixed(1)} ${units} run · ${format(parseISO(fastest.run.run_date), 'MMM d, yyyy')}`,
    });
  } else {
    list.push({
      label: 'Fastest pace',
      value: '—',
      detail: 'Log a run to set this record',
    });
  }

  if (longest) {
    const dist = metersToDisplayDistance(Number(longest.distance_meters), units);
    list.push({
      label: 'Longest run',
      value: `${dist.value.toFixed(1)} ${units}`,
      detail: format(parseISO(longest.run_date), 'MMM d, yyyy'),
    });
  } else {
    list.push({
      label: 'Longest run',
      value: '—',
      detail: 'Log a run to set this record',
    });
  }

  if (biggest) {
    const start = parseISO(biggest.weekKey);
    const end = addDays(start, 6);
    const dist = metersToDisplayDistance(biggest.sum, units);
    list.push({
      label: 'Biggest week',
      value: `${dist.value.toFixed(1)} ${units}`,
      detail: `${format(start, 'MMM d')}–${format(end, 'MMM d, yyyy')}`,
    });
  } else {
    list.push({
      label: 'Biggest week',
      value: '—',
      detail: 'Log some runs to track this',
    });
  }

  // 4) Current streak — comes from /score/summary so it stays in sync with
  //    the streak shown on Home. Lifetime "longest streak" would require
  //    fetching habit_checks across all time; that's a follow-up if the
  //    product wants it (we'd add /stats/me/records server-side then).
  list.push({
    label: 'Current streak',
    value: `${score.streak} ${score.streak === 1 ? 'day' : 'days'}`,
    detail:
      score.streak === 0
        ? 'Log today to start a streak'
        : 'Consecutive days with any activity',
  });

  return list;
}
