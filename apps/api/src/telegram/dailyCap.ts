// In-memory per-user photo-parse cap, reset each calendar day. In-process only;
// a restart resets counts, which is acceptable for an abuse guard.
export const DAILY_PHOTO_CAP = 10;

const counts = new Map<string, { day: string; n: number }>();

/** Returns true and counts one parse if under the cap for `today` (yyyy-mm-dd). */
export function tryConsumePhoto(userId: string, today: string): boolean {
  const cur = counts.get(userId);
  if (!cur || cur.day !== today) {
    counts.set(userId, { day: today, n: 1 });
    return true;
  }
  if (cur.n >= DAILY_PHOTO_CAP) return false;
  cur.n += 1;
  return true;
}

/** Test helper — clears all counts. */
export function _resetCaps(): void {
  counts.clear();
}
