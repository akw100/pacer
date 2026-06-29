// In-memory per-user photo-parse cap, reset each calendar day. In-process only;
// a restart resets counts, which is acceptable for an abuse guard.
export const DAILY_PHOTO_CAP = 10;
// Text parses are cheaper than vision calls, so they get a higher daily ceiling.
export const DAILY_TEXT_CAP = 50;

const photoCounts = new Map<string, { day: string; n: number }>();
const textCounts = new Map<string, { day: string; n: number }>();

/** Shared per-user/per-day counter: true (and counts one) if under `cap` for `today`. */
function tryConsume(
  counts: Map<string, { day: string; n: number }>,
  cap: number,
  userId: string,
  today: string,
): boolean {
  const cur = counts.get(userId);
  if (!cur || cur.day !== today) {
    counts.set(userId, { day: today, n: 1 });
    return true;
  }
  if (cur.n >= cap) return false;
  cur.n += 1;
  return true;
}

/** Returns true and counts one parse if under the photo cap for `today` (yyyy-mm-dd). */
export function tryConsumePhoto(userId: string, today: string): boolean {
  return tryConsume(photoCounts, DAILY_PHOTO_CAP, userId, today);
}

/** Returns true and counts one parse if under the text cap for `today` (yyyy-mm-dd). */
export function tryConsumeText(userId: string, today: string): boolean {
  return tryConsume(textCounts, DAILY_TEXT_CAP, userId, today);
}

/** Test helper — clears all counts (both photo and text). */
export function _resetCaps(): void {
  photoCounts.clear();
  textCounts.clear();
}
