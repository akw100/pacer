import { format } from 'date-fns';
import { CHALLENGE_METRICS, metersToDisplayDistance, type ChallengeMetric, type ChallengeState, type Units } from '@pacer/shared';

// Display formatting for challenge metric values. Distance is the only metric
// stored in canonical units (meters) — we convert to the user's km/mi here at
// display time (never stored). Everything else is a plain count/points/days.

export function formatMetricValue(value: number, metric: ChallengeMetric, units: Units): string {
  const meta = CHALLENGE_METRICS[metric];
  if (meta.unit === 'meters') {
    const { value: v, unit } = metersToDisplayDistance(value, units);
    return `${v.toFixed(1)} ${unit}`;
  }
  if (meta.unit === 'points') return `${Math.round(value)} pts`;
  if (meta.unit === 'days') return `${Math.round(value)} ${Math.round(value) === 1 ? 'day' : 'days'}`;
  return `${Math.round(value)}`;
}

/** Numeric display value + decimals + suffix, split so an odometer (NumberFlow)
 *  can animate the number while the unit stays put. Distance converts to the
 *  user's unit; others are whole counts/points/days. */
export function metricParts(
  value: number,
  metric: ChallengeMetric,
  units: Units,
): { value: number; decimals: number; suffix: string } {
  const meta = CHALLENGE_METRICS[metric];
  if (meta.unit === 'meters') {
    const { value: v } = metersToDisplayDistance(value, units);
    return { value: v, decimals: 1, suffix: units };
  }
  return { value: Math.round(value), decimals: 0, suffix: metricUnitSuffix(metric, units) };
}

/** Short unit suffix for compact "12 / 30 km" style targets. */
export function metricUnitSuffix(metric: ChallengeMetric, units: Units): string {
  const meta = CHALLENGE_METRICS[metric];
  if (meta.unit === 'meters') return units;
  if (meta.unit === 'points') return 'pts';
  if (meta.unit === 'days') return 'days';
  return CHALLENGE_METRICS[metric].label.toLowerCase();
}

/** Progress fraction toward target, clamped to [0, 1]. The raw ratio (not the
 *  rounded percent) so a hair under target reads <100% — the bar only fills and
 *  turns green when isChallengeComplete is true. Unit-agnostic: progress + target
 *  are always in the same unit (distance in meters, everything else a raw count). */
export function progressFraction(progress: number, target: number): number {
  return target > 0 ? Math.max(0, Math.min(1, progress / target)) : 0;
}

/** Whole days remaining until end (inclusive), 0 once finished. */
export function daysLeft(endDate: string, todayKey: string): number {
  if (todayKey > endDate) return 0;
  const end = new Date(`${endDate}T00:00:00`);
  const today = new Date(`${todayKey}T00:00:00`);
  const ms = end.getTime() - today.getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

function daysUntil(dateKey: string, today: string): number {
  const a = new Date(`${dateKey}T00:00:00`).getTime();
  const b = new Date(`${today}T00:00:00`).getTime();
  return Math.round((a - b) / 86_400_000);
}

function relDay(n: number, verb: string): string {
  if (n <= 0) return `${verb} today`;
  if (n === 1) return `${verb} tomorrow`;
  return `${verb} in ${n} days`;
}

/** Human window label: "starts in 2 days" / "ends tomorrow" / "ended Jul 7". */
export function windowLabel(state: ChallengeState, start: string, end: string, today: string): string {
  if (state === 'upcoming') return relDay(daysUntil(start, today), 'starts');
  if (state === 'active') return relDay(daysUntil(end, today), 'ends');
  return `ended ${format(new Date(`${end}T00:00:00`), 'MMM d')}`;
}

export function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
