import { Crown, Trophy } from 'lucide-react';
import type { GroupStats } from './useGroups';
import { colorFor } from './memberColors';

// "Who's leading" callout — sits above the LeaderboardCard on Group Detail.
// v2 companion to the visual leaderboard: one glance at the top of the page
// tells you who's ahead and how far you are.
//
// Data source: existing GroupStats (leaderboard[0] + you_vs_group). No
// invented numbers, no fabrications. Value 0 across an empty group hides
// the card entirely.

interface LeaderCalloutProps {
  stats: GroupStats | undefined;
  youUserId: string | null;
}

export function LeaderCallout({ stats, youUserId }: LeaderCalloutProps) {
  if (!stats) return null;
  const leader = stats.leaderboard[0] ?? null;
  if (!leader || leader.score <= 0) return null;

  const you = stats.you_vs_group.you;
  const youIsLeader = you && leader.user_id === you.user_id;
  const rank = stats.you_vs_group.rank;
  const gap = stats.you_vs_group.score_gap_to_first;

  const leaderColor = youIsLeader ? 'var(--color-accent)' : colorFor(leader.user_id);
  const leaderName = youIsLeader ? 'You' : leader.display_name;

  return (
    <section
      aria-labelledby="leader-callout-heading"
      className="rounded-card border border-border bg-surface p-4 shadow-sm flex items-center gap-3"
    >
      <div
        aria-hidden="true"
        className="grid place-items-center w-11 h-11 rounded-pill shrink-0 text-2xl leading-none"
        style={{ backgroundColor: `${leaderColor}25` }}
      >
        {leader.avatar_emoji ?? '🏃'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-muted">
          <Crown size={12} strokeWidth={1.8} className="text-streak" />
          <span id="leader-callout-heading">Leading this week</span>
        </div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span
            className={`font-display text-lg font-bold truncate ${
              youIsLeader ? 'text-accent' : 'text-ink'
            }`}
          >
            {leaderName}
          </span>
          <span className="text-xs text-ink-muted truncate">@{leader.handle}</span>
        </div>
        <YourStandingLine
          youIsLeader={!!youIsLeader}
          hasYou={!!you}
          rank={rank}
          gap={gap}
          memberCount={stats.leaderboard.length}
        />
      </div>

      <div className="shrink-0 text-right">
        <div className="font-display text-2xl font-bold text-ink tabular-nums leading-none">
          {leader.score}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-ink-muted mt-1">pts</div>
      </div>
    </section>
  );
}

function YourStandingLine({
  youIsLeader,
  hasYou,
  rank,
  gap,
  memberCount,
}: {
  youIsLeader: boolean;
  hasYou: boolean;
  rank: number | null;
  gap: number;
  memberCount: number;
}) {
  if (youIsLeader) {
    return (
      <p className="mt-0.5 text-xs text-ink-muted inline-flex items-center gap-1">
        <Trophy size={11} strokeWidth={1.8} className="text-accent" />
        You're setting the pace.
      </p>
    );
  }
  if (!hasYou) {
    return (
      <p className="mt-0.5 text-xs text-ink-muted">Tag a run to this group to join the board.</p>
    );
  }
  if (rank == null) {
    return null;
  }
  if (gap <= 0) {
    return (
      <p className="mt-0.5 text-xs text-ink-muted tabular-nums">
        You're #{rank} of {memberCount} — right at the top.
      </p>
    );
  }
  return (
    <p className="mt-0.5 text-xs text-ink-muted tabular-nums">
      You're #{rank} of {memberCount} — {gap} pt{gap === 1 ? '' : 's'} behind.
    </p>
  );
}
