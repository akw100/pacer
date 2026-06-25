import { metersToDisplayDistance, type Units } from '@pacer/shared';
import type { GroupStats } from './useGroups';

interface YouVsGroupCardProps {
  stats: GroupStats | undefined;
  units: Units;
}

export function YouVsGroupCard({ stats, units }: YouVsGroupCardProps) {
  if (!stats) return null;
  const { totals, you_vs_group, leaderboard } = stats;
  const totalKm = metersToDisplayDistance(totals.week_distance_meters, units);
  const motivation = motivationCopy(stats);

  return (
    <section
      aria-labelledby="you-vs-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-4"
    >
      <header className="flex items-center justify-between">
        <h2 id="you-vs-heading" className="font-display text-lg font-semibold text-ink">
          You vs the group
        </h2>
        {you_vs_group.rank && (
          <span className="text-xs text-ink-muted">
            Rank {you_vs_group.rank} of {leaderboard.length}
          </span>
        )}
      </header>

      <p className="text-sm font-medium text-ink leading-snug">{motivation}</p>

      <div className="grid grid-cols-3 gap-3">
        <Stat
          label={`Group ${units} this week`}
          value={totalKm.value.toFixed(1)}
          unit={units}
        />
        <Stat label="Group score" value={String(totals.week_score)} unit="pts" />
        <Stat label="Group runs" value={String(totals.week_runs)} unit="runs" />
      </div>

      <YouRow stats={stats} units={units} />
    </section>
  );
}

function motivationCopy(stats: GroupStats): string {
  const { you_vs_group, leaderboard } = stats;
  const you = you_vs_group.you;
  const first = leaderboard[0];
  if (!you) return 'Tag a run to this group to join the leaderboard.';
  if (!first || first.user_id === you.user_id) {
    if (leaderboard.length <= 1) return "You're flying solo this week — invite the group!";
    return "You're leading the pack — set the pace 🏃";
  }
  const gap = you_vs_group.score_gap_to_first;
  if (gap <= 0) return "You're right at the top — keep it rolling.";
  if (gap <= 5) return `You're only ${gap} pt${gap === 1 ? '' : 's'} from first place. One quick run could do it.`;
  if (gap <= 15) return `${gap} pts from first — a workout this week would move you up.`;
  return `Plenty of week left — ${gap} pts away from first.`;
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-card border border-border bg-surface px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-display text-xl font-bold text-ink tabular-nums">{value}</span>
        <span className="text-xs text-ink-muted font-medium">{unit}</span>
      </div>
    </div>
  );
}

function YouRow({ stats, units }: { stats: GroupStats; units: Units }) {
  const { you_vs_group } = stats;
  const you = you_vs_group.you;
  if (!you) return null;
  const youKm = metersToDisplayDistance(you.distance_meters, units);
  const avgKm = metersToDisplayDistance(you_vs_group.avg_distance_meters, units);
  return (
    <div className="rounded-card border border-accent/30 bg-accent/5 p-3 grid grid-cols-3 gap-3">
      <Pair label="You" sub={`${you.score} pts`} value={`${youKm.value.toFixed(1)} ${units}`} />
      <Pair label="Group avg" sub={`${Math.round(you_vs_group.avg_score)} pts`} value={`${avgKm.value.toFixed(1)} ${units}`} />
      <Pair label="Diff" sub={`${signed(you.score - you_vs_group.avg_score)} pts`} value={`${signed(youKm.value - avgKm.value, 1)} ${units}`} />
    </div>
  );
}

function Pair({ label, sub, value }: { label: string; sub: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="font-display text-base font-bold text-ink">{value}</div>
      <div className="text-xs text-ink-muted">{sub}</div>
    </div>
  );
}

function signed(n: number, decimals = 0): string {
  const v = Number(n.toFixed(decimals));
  return v > 0 ? `+${v}` : `${v}`;
}
