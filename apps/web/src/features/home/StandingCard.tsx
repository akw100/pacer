import { Link } from 'react-router';
import { useQueries } from '@tanstack/react-query';
import { ChevronRight, Trophy } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { groupKeys } from '../groups/groups.queries';
import { useMyGroups, type GroupListItem, type GroupStats } from '../groups/useGroups';

// "Your standing" — a small Home summary across all groups the user belongs
// to. This is a per-user summary scoped to the user's own groups only —
// nothing platform-wide. Computed entirely from the existing real endpoints:
//
//   - GET /groups               → list of my groups (member_count, name)
//   - GET /groups/:id/stats     → leaderboard, my rank, gap to first
//
// We fan out one stats request per group via TanStack's `useQueries` (same
// cache key as GroupCard, so GroupsHub navigation re-uses the data). For a
// family-scale user (1–3 groups) this is well under N+1 concerns.
//
// What we surface (only when computable from the real data):
//   - Active groups count
//   - Best rank across groups + group name
//   - Closest race: lowest positive score_gap_to_first + leader's display_name
//
// Scope guard:
//   - Numbers only render when present in the real /stats response
//   - No platform-wide ranking is computed or displayed
//   - No client-only state is treated as the source of truth

interface BestRank {
  groupId: string;
  groupName: string;
  rank: number;
}

interface ClosestRace {
  groupId: string;
  groupName: string;
  gap: number;
  leaderName: string;
}

export function StandingCard() {
  const groupsQuery = useMyGroups();
  const groups: GroupListItem[] = groupsQuery.data ?? [];
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const userId = session?.user.id ?? null;

  // Parallel stats fetches — one per group, cache-keyed identically to
  // GroupCard so a user navigating between Home and Groups Hub never re-pays.
  const statsResults = useQueries({
    queries: groups.map((g) => ({
      queryKey: groupKeys.stats(g.id),
      queryFn: () => apiFetch<GroupStats>(`/groups/${g.id}/stats`, { token: token! }),
      enabled: !!token,
      staleTime: 30 * 1000,
    })),
  });

  // While we have no groups at all, render nothing — HomeDashboard's
  // NoGroupCard already covers the "go create one" path. Putting an empty
  // "Your standing" row above it would just add noise.
  if (groupsQuery.isLoading) {
    return (
      <section
        aria-label="Loading your standing"
        className="rounded-card border border-border bg-surface p-4 shadow-sm"
      >
        <div className="h-4 w-32 rounded bg-ink/5 animate-pulse" />
        <div className="mt-3 h-4 w-2/3 rounded bg-ink/5 animate-pulse" />
      </section>
    );
  }
  if (groups.length === 0) return null;

  const anyStatsLoading = statsResults.some((r) => r.isLoading);
  const anyStatsLoaded = statsResults.some((r) => r.data);

  // Derive best rank + closest race from whatever real stats have loaded.
  let bestRank: BestRank | null = null;
  let closestRace: ClosestRace | null = null;

  statsResults.forEach((r, i) => {
    const stats = r.data;
    const group = groups[i];
    if (!stats || !group) return;

    const rank = stats.you_vs_group.rank;
    if (rank != null && (bestRank === null || rank < bestRank.rank)) {
      bestRank = { groupId: group.id, groupName: group.name, rank };
    }

    const gap = stats.you_vs_group.score_gap_to_first;
    const leader = stats.leaderboard[0];
    // Only count this group as a "race" if there's a real positive gap AND
    // a real leader who isn't us. score_gap_to_first is server-clamped at 0
    // when you're first or when `you` is null, so >0 already implies behind.
    if (gap > 0 && leader && leader.user_id !== userId) {
      if (closestRace === null || gap < closestRace.gap) {
        closestRace = {
          groupId: group.id,
          groupName: group.name,
          gap,
          leaderName: leader.display_name,
        };
      }
    }
  });

  return (
    <section
      aria-labelledby="standing-heading"
      className="rounded-card border border-border bg-surface p-4 md:p-5 shadow-sm flex flex-col gap-3"
    >
      <header className="flex items-center justify-between gap-3">
        <h2
          id="standing-heading"
          className="font-display text-base md:text-lg font-semibold text-ink inline-flex items-center gap-2"
        >
          <Trophy size={16} strokeWidth={1.8} className="text-accent" />
          Your standing
        </h2>
        <Link
          to="/group"
          className="text-xs text-ink-muted inline-flex items-center gap-0.5 hover:text-ink shrink-0"
        >
          View all
          <ChevronRight size={12} strokeWidth={2} />
        </Link>
      </header>

      <p className="text-xs text-ink-muted">
        Active in{' '}
        <span className="font-semibold text-ink">{groups.length}</span>{' '}
        {groups.length === 1 ? 'group' : 'groups'}
      </p>

      {anyStatsLoading && !anyStatsLoaded ? (
        <div className="space-y-2">
          <div className="h-4 w-3/4 rounded bg-ink/5 animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-ink/5 animate-pulse" />
        </div>
      ) : bestRank === null && closestRace === null ? (
        <p className="text-sm text-ink-muted leading-snug">
          Tag a run or workout to one of your groups to start the leaderboard.
        </p>
      ) : (
        <ul role="list" className="flex flex-col gap-1.5">
          {bestRank && <BestRankRow entry={bestRank} />}
          {closestRace && <ClosestRaceRow entry={closestRace} />}
        </ul>
      )}
    </section>
  );
}

function BestRankRow({ entry }: { entry: BestRank }) {
  return (
    <li className="text-sm text-ink leading-snug">
      {entry.rank === 1 ? (
        <>
          🏆 <span className="font-semibold">#1</span> in{' '}
          <span className="font-semibold">{entry.groupName}</span>
        </>
      ) : (
        <>
          Best rank:{' '}
          <span className="font-semibold">#{entry.rank}</span> in{' '}
          <span className="font-semibold">{entry.groupName}</span>
        </>
      )}
    </li>
  );
}

function ClosestRaceRow({ entry }: { entry: ClosestRace }) {
  return (
    <li className="text-sm text-ink leading-snug">
      <span className="font-semibold">
        {entry.gap} pt{entry.gap === 1 ? '' : 's'}
      </span>{' '}
      behind <span className="font-semibold">{entry.leaderName}</span> in{' '}
      <span className="font-semibold">{entry.groupName}</span>
    </li>
  );
}
