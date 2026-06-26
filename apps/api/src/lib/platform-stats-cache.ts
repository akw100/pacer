import type { PlatformCommunity } from '@pacer/shared';

// Tiny in-process cache for the anonymous community block. Per card 08:
// stale-by-up-to-5-minutes is acceptable and intended, so we don't bother
// with Redis/Edge. Process-local is fine for a small Node API; multiple
// instances each warm independently. Re-keyed by the current week start so
// a week rollover busts the cache automatically even if TTL is long.

const TTL_MS = 5 * 60 * 1000;

interface Entry {
  key: string; // weekStartIso — re-key bust on week rollover
  value: PlatformCommunity;
  expiresAt: number; // epoch ms
}

let entry: Entry | null = null;

/** Read the cached community block if fresh AND the week hasn't rolled. */
export function readCachedCommunity(weekStartIso: string, now = Date.now()): PlatformCommunity | null {
  if (!entry) return null;
  if (entry.key !== weekStartIso) return null;
  if (entry.expiresAt <= now) return null;
  return entry.value;
}

/** Replace the cache entry. */
export function writeCachedCommunity(
  weekStartIso: string,
  value: PlatformCommunity,
  now = Date.now(),
): void {
  entry = { key: weekStartIso, value, expiresAt: now + TTL_MS };
}

/** Clear (used by tests; never called in prod). */
export function _clearCommunityCacheForTest(): void {
  entry = null;
}
