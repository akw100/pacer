import { useMemo } from 'react';
import type { Units } from '@pacer/shared';
import { formatDuration } from '@pacer/shared';

// Live standings during a race. Rows are built from the realtime `positions`
// map (browser→browser broadcasts) with the caller's own GPS meters merged in,
// then sorted by distance covered. Gap-to-leader and a rough ETA (remaining ÷
// current pace) are derived per row. Pure presentation — all inputs come from
// the run screen.

export interface LeaderRow {
  userId: string;
  meters: number;
}

interface RaceLeaderboardProps {
  /** Latest broadcast meters per runner id. */
  positions: Record<string, number>;
  /** The caller's own authoritative live meters (merged over any stale broadcast). */
  youId: string | null;
  youMeters: number;
  targetMeters: number;
  /** Seconds since the race started — drives the ETA estimate. */
  elapsedSeconds: number;
  nameFor: (id: string) => string;
  units: Units;
}

export function RaceLeaderboard({
  positions,
  youId,
  youMeters,
  targetMeters,
  elapsedSeconds,
  nameFor,
  units,
}: RaceLeaderboardProps) {
  const rows = useMemo(() => {
    const merged: Record<string, number> = { ...positions };
    if (youId) merged[youId] = Math.max(merged[youId] ?? 0, youMeters);
    return Object.entries(merged)
      .map(([userId, meters]) => ({ userId, meters }))
      .sort((a, b) => b.meters - a.meters);
  }, [positions, youId, youMeters]);

  const leaderMeters = rows[0]?.meters ?? 0;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs uppercase tracking-wide text-ink-muted">Standings</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-ink-muted">Waiting for the first positions…</p>
      ) : (
        <ul role="list" className="flex flex-col gap-2">
          {rows.map((r, i) => {
            const pct = targetMeters > 0 ? Math.min(100, (r.meters / targetMeters) * 100) : 0;
            const gap = Math.max(0, leaderMeters - r.meters);
            const isYou = r.userId === youId;
            return (
              <li
                key={r.userId}
                className={`flex items-center gap-3 rounded-card border p-3 ${
                  isYou ? 'border-accent/40 bg-accent/5' : 'border-border bg-panel'
                }`}
              >
                <span className="w-5 shrink-0 text-center font-display text-sm font-bold text-ink-muted tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">
                      {nameFor(r.userId)}
                    </span>
                    <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                      {Math.round(pct)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-pill bg-ink/5">
                    <div
                      className="h-full rounded-pill bg-accent transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-ink-muted tabular-nums">
                    <span>{i === 0 ? 'Leader' : `−${gapLabel(gap, units)}`}</span>
                    <span>ETA {etaLabel(r.meters, targetMeters, elapsedSeconds)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const METERS_PER_MILE = 1609.344;

/** Short distance gap, e.g. "120 m" or "1.3 km". */
function gapLabel(meters: number, units: Units): string {
  if (units === 'mi') {
    if (meters < METERS_PER_MILE / 4) return `${Math.round(meters)} m`;
    return `${(meters / METERS_PER_MILE).toFixed(1)} mi`;
  }
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Rough ETA to the finish: remaining distance ÷ current average pace. With no
 * progress yet (meters or elapsed = 0) there's no rate to extrapolate, so we
 * show a placeholder rather than Infinity.
 */
function etaLabel(meters: number, targetMeters: number, elapsedSeconds: number): string {
  const remaining = targetMeters - meters;
  if (remaining <= 0) return '—';
  if (meters <= 0 || elapsedSeconds <= 0) return '—';
  const speed = meters / elapsedSeconds; // m/s
  if (speed <= 0) return '—';
  return formatDuration(remaining / speed);
}
