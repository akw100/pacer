import { metersToDisplayDistance, type Units } from '@pacer/shared';
import type { GroupStats } from './useGroups';

interface YouVsGroupCardProps {
  stats: GroupStats | undefined;
  units: Units;
}

// v1 visual pass — adds two simple horizontal bar comparisons (You vs
// Group avg for distance + score) above the existing numeric tiles. Bar
// lengths are proportional to max(you, avg) within each pair, so both
// bars stay legible regardless of scale. When the group has no
// leaderboard rows yet, or the viewer hasn't logged into it, the bars
// don't render — the honest empty state is the existing motivation copy.
export function YouVsGroupCard({ stats, units }: YouVsGroupCardProps) {
  if (!stats) return null;
  const { totals, you_vs_group, leaderboard } = stats;
  const totalKm = metersToDisplayDistance(totals.week_distance_meters, units);
  const motivation = motivationCopy(stats);

  const you = you_vs_group.you;
  const youDistance = metersToDisplayDistance(you?.distance_meters ?? 0, units);
  const avgDistance = metersToDisplayDistance(you_vs_group.avg_distance_meters, units);
  // Only render the visual comparison when there's real data on either
  // side of it. Otherwise the empty motivation copy carries the message.
  const hasComparison =
    !!you &&
    leaderboard.length > 0 &&
    (you.score > 0 ||
      you.distance_meters > 0 ||
      you_vs_group.avg_score > 0 ||
      you_vs_group.avg_distance_meters > 0);

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

      {hasComparison && (
        <div className="flex flex-col gap-3">
          <ComparisonBar
            label={`Distance this week (${units})`}
            youValue={youDistance.value}
            avgValue={avgDistance.value}
            youText={`${youDistance.value.toFixed(1)} ${units}`}
            avgText={`${avgDistance.value.toFixed(1)} ${units}`}
          />
          <ComparisonBar
            label="Score this week"
            youValue={you!.score}
            avgValue={you_vs_group.avg_score}
            youText={`${you!.score} pts`}
            avgText={`${Math.round(you_vs_group.avg_score)} pts`}
          />
        </div>
      )}

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

function ComparisonBar({
  label,
  youValue,
  avgValue,
  youText,
  avgText,
}: {
  label: string;
  youValue: number;
  avgValue: number;
  youText: string;
  avgText: string;
}) {
  const max = Math.max(youValue, avgValue, 0);
  const youPct = max > 0 ? Math.min(100, (youValue / max) * 100) : 0;
  const avgPct = max > 0 ? Math.min(100, (avgValue / max) * 100) : 0;
  return (
    <div aria-label={label}>
      <div className="text-[11px] uppercase tracking-wide text-ink-muted mb-1.5">{label}</div>
      <div className="flex flex-col gap-1.5">
        <BarRow
          who="You"
          text={youText}
          pct={youPct}
          fillClass="bg-accent"
        />
        <BarRow
          who="Group avg"
          text={avgText}
          pct={avgPct}
          fillClass="bg-ink/25"
        />
      </div>
    </div>
  );
}

function BarRow({
  who,
  text,
  pct,
  fillClass,
}: {
  who: string;
  text: string;
  pct: number;
  fillClass: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ink-muted w-16 shrink-0">{who}</span>
      <div className="flex-1 h-2 rounded-pill bg-ink/5 overflow-hidden">
        <div
          className={`h-full rounded-pill transition-[width] duration-500 ${fillClass}`}
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
      </div>
      <span className="text-xs font-medium text-ink tabular-nums w-20 text-right">{text}</span>
    </div>
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
