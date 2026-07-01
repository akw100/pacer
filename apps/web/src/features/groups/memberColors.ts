// Deterministic per-member color palette. Same userId → same color across
// every render, refresh, and screen. Used by v2 Group Detail (leaderboard
// bar fills, LeaderCallout chips) to give each member a stable visual
// identity in charts.
//
// "You" is NOT resolved via this palette — callers should always paint the
// viewer's row with the app accent (`--color-accent`) so their eye lands
// on it first. `colorFor()` is only for OTHER members.

// 8 accent-safe hues chosen to read at low opacity against `--color-surface`
// (light) and `--color-panel` (dark). Groups with >8 members will have
// deterministic collisions; avatar_emoji + display_name still distinguish.
const PALETTE = [
  '#4F86F6', // blue
  '#7C4DFF', // violet
  '#00B8A9', // teal
  '#F5A623', // streak-amber
  '#F26D6D', // coral
  '#52A869', // green
  '#B36BFF', // magenta
  '#6C7A89', // slate
] as const;

/**
 * FNV-1a hash (32-bit) → palette index. Pure, no allocation, no crypto
 * needed — we only care that the same userId maps to the same slot every
 * render. Collisions across the palette are acceptable.
 */
export function colorFor(userId: string): string {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    // FNV prime 16777619, expressed as shifts to stay in 32-bit range
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return PALETTE[h % PALETTE.length]!;
}

/** For call sites that want to render the palette itself (e.g. a legend). */
export const MEMBER_COLOR_PALETTE = PALETTE;
