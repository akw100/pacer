import { ChevronRight, Users } from 'lucide-react';
import { metersToDisplayDistance, type Units } from '@pacer/shared';
import type { GroupListItem } from './useGroups';
import { useGroupStats } from './useGroups';

// Single group card in the Groups Hub. Shows the group name + member count
// at minimum; if the stats endpoint has returned this group's data, also
// shows the user's rank and a small score/km/runs summary. We deliberately
// fetch stats per-card from React Query — the cache de-dupes calls and a
// family-scale user belongs to 1–3 groups, so N+1 is a non-issue.

interface GroupCardProps {
  group: GroupListItem;
  youUserId: string | null;
  units: Units;
  onOpen: (id: string) => void;
}

export function GroupCard({ group, youUserId, units, onOpen }: GroupCardProps) {
  const stats = useGroupStats(group.id);

  const you = stats.data?.leaderboard.find((r) => r.user_id === youUserId) ?? null;
  const rank = stats.data?.you_vs_group.rank ?? null;
  const totalMembers = stats.data?.leaderboard.length ?? group.member_count;

  // Distance shown in the user's units; the API returns canonical meters.
  const distance = you ? metersToDisplayDistance(you.distance_meters, units) : null;

  // `score_gap_to_first` is computed server-side in /groups/:id/stats. We
  // surface it as motivation copy ONLY when there's a real positive gap —
  // never invent a number, never frame it negatively ("you're losing").
  const motivation = pickMotivation(stats.data, you);

  return (
    <button
      type="button"
      onClick={() => onOpen(group.id)}
      className="text-left rounded-card border border-border bg-surface p-4 shadow-sm hover:bg-ink/5 transition-colors w-full focus:outline-none focus:ring-2 focus:ring-accent/40"
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid place-items-center w-10 h-10 rounded-pill bg-accent/10 text-accent shrink-0 font-display font-bold text-base"
        >
          {group.name.charAt(0).toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-display text-base font-semibold text-ink truncate">{group.name}</div>
          <div className="text-xs text-ink-muted inline-flex items-center gap-1 mt-0.5">
            <Users size={11} strokeWidth={1.8} />
            <span>
              {totalMembers} {totalMembers === 1 ? 'member' : 'members'}
            </span>
          </div>
        </div>
        <ChevronRight size={18} strokeWidth={1.8} className="text-ink-muted shrink-0 mt-1" />
      </header>

      {/* Stats strip — only shown when /stats has returned a non-empty board */}
      {you ? (
        <>
          <div className="mt-4 grid grid-cols-4 gap-2">
            <Stat label="Rank" value={rank ? `#${rank}` : '—'} />
            <Stat label="Score" value={`${you.score}`} />
            <Stat label={units} value={distance ? distance.value.toFixed(1) : '—'} />
            <Stat label="Runs" value={`${you.runs}`} />
          </div>
          {motivation && (
            <p className="mt-3 text-xs text-ink-muted leading-snug">{motivation}</p>
          )}
        </>
      ) : stats.isLoading ? (
        <div className="mt-4 h-12 rounded-card bg-ink/5 animate-pulse" />
      ) : (
        <div className="mt-3 text-xs text-ink-muted">
          {group.member_count <= 1
            ? "You're the first one in — invite the rest."
            : 'Tag a run to this group to start the leaderboard.'}
        </div>
      )}
    </button>
  );
}

// Pure copy chooser. Only returns a string when the underlying numbers
// support it. Never invents motivation from missing data.
function pickMotivation(
  stats: import('./useGroups').GroupStats | undefined,
  you: import('./useGroups').LeaderboardRow | null,
): string | null {
  if (!stats || !you) return null;
  const gap = stats.you_vs_group.score_gap_to_first;
  const rank = stats.you_vs_group.rank;
  const board = stats.leaderboard;
  if (rank === 1) return "You're leading the pack.";
  if (gap > 0 && gap <= 5) return `${gap} pt${gap === 1 ? '' : 's'} behind first place.`;
  if (gap > 0 && gap <= 20) return `One workout could move you up.`;
  if (gap > 0) return `${gap} pts behind first — plenty of week left.`;
  if (board.length === 1) return 'Invite teammates to compete together.';
  return null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card bg-ink/5 px-2 py-1.5 text-center">
      <div className="font-display text-sm font-bold text-ink tabular-nums leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-ink-muted mt-0.5">{label}</div>
    </div>
  );
}
