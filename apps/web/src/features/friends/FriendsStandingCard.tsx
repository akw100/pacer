import { Link } from 'react-router';
import { ChevronRight, Trophy, UserPlus } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useFriendsLeaderboard } from './useFriends';

// Home summary of "where I stand among accepted friends." Reads the real
// /friends/leaderboard endpoint and renders only what the API returns —
// never invents numbers, never lists people the caller isn't actually
// friends with.
//
// Empty state copy is positive and CTA-led; all user-facing strings stay
// honest and product-positive.

export function FriendsStandingCard() {
  const { session } = useAuth();
  const callerId = session?.user.id ?? null;
  const lb = useFriendsLeaderboard();

  if (lb.isLoading) {
    return (
      <section
        aria-label="Loading friends standing"
        className="rounded-card border border-border bg-surface p-4 shadow-sm"
      >
        <div className="h-4 w-40 rounded bg-ink/5 animate-pulse" />
        <div className="mt-3 h-4 w-2/3 rounded bg-ink/5 animate-pulse" />
      </section>
    );
  }

  if (lb.isError) {
    return (
      <section className="rounded-card border border-border bg-surface p-4 shadow-sm flex items-center justify-between gap-3 text-sm">
        <span className="text-ink-muted">Couldn't load friends standing.</span>
        <button
          type="button"
          onClick={() => lb.refetch()}
          className="rounded-pill border border-border bg-surface px-3 py-1 text-xs font-medium text-ink hover:bg-ink/5"
        >
          Retry
        </button>
      </section>
    );
  }

  const data = lb.data;
  if (!data) return null;

  // The API always includes the caller in the leaderboard. We count
  // "friends" as everyone else on the board.
  const friendCount = data.leaderboard.filter((r) => r.user_id !== callerId).length;

  if (friendCount === 0) {
    return <EmptyState />;
  }

  const totalParticipants = data.leaderboard.length; // friends + you
  const rank = data.you_vs_friends.rank;
  const gap = data.you_vs_friends.score_gap_to_first;
  const leader = data.leaderboard[0];
  const leaderName = leader && leader.user_id !== callerId ? leader.display_name : null;

  // No personal activity yet this week → caller isn't ranked.
  if (rank == null) {
    return (
      <Shell>
        <BodyMuted>
          Log a run to start the friends leaderboard.
        </BodyMuted>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-xs text-ink-muted">
        Active with <span className="font-semibold text-ink">{friendCount}</span>{' '}
        {friendCount === 1 ? 'friend' : 'friends'}
      </p>
      <ul role="list" className="flex flex-col gap-1.5">
        {rank === 1 ? (
          <li className="text-sm text-ink leading-snug">
            🏆 <span className="font-semibold">You're leading</span> {friendCount === 1 ? 'your friend' : 'your friends'} this week.
          </li>
        ) : (
          <li className="text-sm text-ink leading-snug">
            <span className="font-semibold">#{rank}</span> of{' '}
            <span className="font-semibold">{totalParticipants}</span>
          </li>
        )}
        {leaderName && gap > 0 && (
          <li className="text-sm text-ink leading-snug">
            <span className="font-semibold">{leaderName}</span> leads by{' '}
            <span className="font-semibold">{gap} pt{gap === 1 ? '' : 's'}</span>.
          </li>
        )}
      </ul>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-labelledby="friends-standing-heading"
      className="rounded-card border border-border bg-surface p-4 md:p-5 shadow-sm flex flex-col gap-3"
    >
      <header className="flex items-center justify-between gap-3">
        <h2
          id="friends-standing-heading"
          className="font-display text-base md:text-lg font-semibold text-ink inline-flex items-center gap-2"
        >
          <Trophy size={16} strokeWidth={1.8} className="text-accent" />
          Friends standing
        </h2>
        <Link
          to="/profile"
          className="text-xs text-ink-muted inline-flex items-center gap-0.5 hover:text-ink shrink-0"
        >
          Manage friends
          <ChevronRight size={12} strokeWidth={2} />
        </Link>
      </header>
      {children}
    </section>
  );
}

function BodyMuted({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink-muted leading-snug">{children}</p>;
}

function EmptyState() {
  return (
    <section
      aria-labelledby="friends-empty-heading"
      className="rounded-card border border-dashed border-border bg-surface p-5 shadow-sm flex flex-col gap-3"
    >
      <span className="grid place-items-center w-10 h-10 rounded-pill bg-accent/10 text-accent">
        <UserPlus size={18} strokeWidth={1.8} />
      </span>
      <h2 id="friends-empty-heading" className="font-display text-lg font-semibold text-ink">
        Add friends to see where you stand
      </h2>
      <p className="text-sm text-ink-muted leading-relaxed">
        Search someone by their @handle and send a request. Their weekly
        activity will show here when they accept.
      </p>
      <Link
        to="/profile"
        className="self-start inline-flex items-center gap-1.5 rounded-pill bg-accent text-white px-4 py-2 text-sm font-semibold shadow-sm shadow-accent/20"
      >
        <UserPlus size={14} strokeWidth={2.2} />
        Add friends
      </Link>
    </section>
  );
}
