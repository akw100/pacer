import { Link } from 'react-router';
import { LogIn, Plus } from 'lucide-react';
import { HomeHeader } from './HomeHeader';
import { TodayCard } from './TodayCard';
import { ThisWeekCard } from './ThisWeekCard';
import { GroupPulseCard } from './GroupPulseCard';
import { RecentActivityList } from './RecentActivityList';
import { greetingFor, useHomeData } from './useHomeData';

// Live-data Home. Renders real personal numbers (greeting from profile,
// streak + weekly points from /score/summary, this-week from /runs +
// /workouts) and a real group pulse when the user belongs to a group.
//
// No mock fallback anywhere: when there's no data, the cards show honest
// empty states (zeros + teaching copy) — never invented names or values.

export function HomeDashboard() {
  const { snapshot, isLoading, isError, hasAnyGroup } = useHomeData();
  const greeting = greetingFor();

  if (isError) {
    return (
      <div className="px-4 pt-5 pb-6 mx-auto w-full max-w-5xl">
        <div className="rounded-card border border-accent/30 bg-accent/5 p-5 text-sm text-ink">
          We couldn't load your dashboard. Refresh to retry.
        </div>
      </div>
    );
  }

  if (isLoading || !snapshot) {
    return <Skeleton />;
  }

  return (
    <div className="px-4 pt-5 pb-6 mx-auto w-full max-w-5xl flex flex-col gap-5">
      <HomeHeader
        greeting={greeting}
        firstName={snapshot.user.firstName}
        streakDays={snapshot.user.streakDays}
        weeklyPoints={snapshot.user.weeklyPoints}
      />

      <div className="grid gap-4 md:grid-cols-2 md:gap-5 items-start">
        <div className="flex flex-col gap-4 md:gap-5">
          <TodayCard planned={snapshot.today.planned} habits={snapshot.today.habits} />
          <ThisWeekCard week={snapshot.week} />
        </div>
        <div className="flex flex-col gap-4 md:gap-5">
          {hasAnyGroup ? (
            <GroupPulseCard pulse={snapshot.group} />
          ) : (
            <NoGroupCard />
          )}
          <RecentActivityList items={snapshot.recent} />
        </div>
      </div>
    </div>
  );
}

function NoGroupCard() {
  return (
    <section
      aria-labelledby="no-group-heading"
      className="rounded-card border border-dashed border-border bg-surface p-5 shadow-sm flex flex-col gap-3"
    >
      <h2 id="no-group-heading" className="font-display text-lg font-semibold text-ink">
        Pacer is more fun together
      </h2>
      <p className="text-sm text-ink-muted leading-relaxed">
        Create a group with family or friends, or join one with a code — your runs and workouts
        stay personal, you choose which count for the leaderboard.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/group"
          className="inline-flex items-center gap-1.5 rounded-pill bg-accent text-white px-4 py-2 text-sm font-semibold shadow-sm shadow-accent/20"
        >
          <Plus size={14} strokeWidth={2.2} />
          Create or join
        </Link>
        <Link
          to="/group"
          className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-ink/5"
        >
          <LogIn size={14} strokeWidth={2} />
          Enter a code
        </Link>
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <div
      role="status"
      aria-label="Loading your dashboard"
      className="px-4 pt-5 pb-6 mx-auto w-full max-w-5xl flex flex-col gap-5"
    >
      <div className="flex flex-col gap-3">
        <div className="h-8 w-56 rounded bg-ink/10 animate-pulse" />
        <div className="flex gap-2">
          <div className="h-6 w-24 rounded-pill bg-ink/5 animate-pulse" />
          <div className="h-6 w-32 rounded-pill bg-ink/5 animate-pulse" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 md:gap-5 items-start">
        <div className="flex flex-col gap-4 md:gap-5">
          <div className="h-48 rounded-card bg-ink/5 animate-pulse" />
          <div className="h-40 rounded-card bg-ink/5 animate-pulse" />
        </div>
        <div className="flex flex-col gap-4 md:gap-5">
          <div className="h-48 rounded-card bg-ink/5 animate-pulse" />
          <div className="h-40 rounded-card bg-ink/5 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
