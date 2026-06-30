/**
 * Count the current habit streak: consecutive yyyy-mm-dd days ending at `today`
 * with no gap. `dates` is the set of check dates (any order, may contain dups).
 * Returns 0 if `today` itself isn't present.
 */
export function streakLength(dates: string[], today: string): number {
  const present = new Set(dates);
  let count = 0;
  let cursor = today;
  while (present.has(cursor)) {
    count += 1;
    cursor = prevDay(cursor);
  }
  return count;
}

/** Step a yyyy-mm-dd string back one calendar day (UTC math, no tz drift). */
function prevDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}
