export interface LatLon { lat: number; lon: number }
export const MAX_ACCURACY_M = 35;
export const MAX_SPEED_MPS = 7;
export const MIN_STEP_M = 5;
export const MIN_STEP_S = 1;
const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;
export function haversineMeters(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat); const dLon = rad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
export function isUsableFix(fix: { accuracy: number }): boolean { return fix.accuracy <= MAX_ACCURACY_M; }
export function isPlausibleStep(meters: number, seconds: number): boolean {
  if (seconds <= 0) return false; return meters / seconds <= MAX_SPEED_MPS;
}
