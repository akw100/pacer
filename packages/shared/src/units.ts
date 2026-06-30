import type { Units } from './types';

// Canonical storage is ALWAYS meters & seconds. These helpers DERIVE every
// display value; callers pass canonical inputs and never round-trip through
// display values.

const METERS_PER_MILE = 1609.344;

export function metersToKm(m: number): number {
  return m / 1000;
}

export function metersToDisplayDistance(
  m: number,
  units: Units,
): { value: number; unit: Units } {
  const value = units === 'km' ? m / 1000 : m / METERS_PER_MILE;
  return { value, unit: units };
}

/** Inverse of metersToDisplayDistance: a value typed in the user's unit → meters
 *  for canonical storage. Forms convert on submit; we never store the display value. */
export function displayDistanceToMeters(value: number, units: Units): number {
  return units === 'km' ? value * 1000 : value * METERS_PER_MILE;
}

/** Seconds per km|mi. Returns 0 for non-positive distance (callers guard display). */
export function paceSecondsPerUnit(
  distanceMeters: number,
  durationSeconds: number,
  units: Units,
): number {
  if (distanceMeters <= 0) return 0;
  const distance = units === 'km' ? distanceMeters / 1000 : distanceMeters / METERS_PER_MILE;
  return durationSeconds / distance;
}

/** "5:30" mm:ss. Guards 0/Infinity/NaN → "—" (no meaningful pace). */
export function formatPace(secondsPerUnit: number): string {
  if (!Number.isFinite(secondsPerUnit) || secondsPerUnit <= 0) return '—';
  const total = Math.round(secondsPerUnit);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** "28:00" (m:ss) or "1:05:00" (h:mm:ss) past an hour. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
