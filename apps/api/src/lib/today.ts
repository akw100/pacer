// Today as yyyy-MM-dd in the app's timezone. The server runs in UTC, but the
// web buckets activity by the user's LOCAL day — so any day-boundary comparison
// (challenge/goal state, a default check-in date, "this week") must use the
// configured zone or it flips a day early/late for several hours each evening.
// Set APP_TIMEZONE to an IANA zone (e.g. 'Asia/Jerusalem'); defaults to UTC, and
// an invalid zone falls back to UTC rather than breaking reads.
export function todayKey(): string {
  const tz = process.env['APP_TIMEZONE'];
  if (!tz || tz === 'UTC') return new Date().toISOString().slice(0, 10);
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
