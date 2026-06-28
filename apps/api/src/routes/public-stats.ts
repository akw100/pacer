import { Hono } from 'hono';
import { metersToKm } from '@pacer/shared';
import { serviceClient } from '../lib/supabase';

// GET /public/stats
//
// Anonymous, all-time community totals for the marketing landing page, which
// is served to logged-OUT visitors and so cannot call the authed
// /stats/platform route. Numbers only — no auth, no identity, no per-user
// rows ever leave this handler (same privacy posture as platform-stats).
//
// Mounted under the /public prefix (added to PUBLIC_PATH_PREFIXES in app.ts)
// so the global auth guard skips it.

// Tiny module-level cache: the number barely moves and the landing page can be
// hit by anyone, so we don't want a full table read per visit.
const TTL_MS = 5 * 60 * 1000;
let cache: { totalKm: number; at: number } | null = null;

export const publicStats = new Hono().get('/', async (c) => {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return c.json({ totalKm: cache.totalKm });
  }

  // ponytail: full scan of runs.distance_meters summed in JS (PostgREST has no
  // reliable SUM here). Fine at this scale; swap for a Postgres RPC or a
  // maintained counter if `runs` ever gets large.
  const db = serviceClient();
  const { data } = await db.from('runs').select('distance_meters');

  let meters = 0;
  for (const r of (data ?? []) as { distance_meters: number | string }[]) {
    const m = Number(r.distance_meters);
    if (Number.isFinite(m) && m > 0) meters += m;
  }

  const totalKm = Math.round(metersToKm(meters));
  cache = { totalKm, at: Date.now() };
  return c.json({ totalKm });
});
