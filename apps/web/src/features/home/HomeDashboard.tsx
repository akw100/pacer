import { Link } from 'react-router';
import { AlertCircle, LogIn, Plus, Sparkles } from 'lucide-react';
import { HomeHeader } from './HomeHeader';
import { LogHero } from './LogHero';
import { StandingCard } from './StandingCard';
import { TodayCard } from './TodayCard';
import { ThisWeekCard } from './ThisWeekCard';
import { GroupPulseCard } from './GroupPulseCard';
import { RecentActivityList } from './RecentActivityList';
import { greetingFor, useHomeData } from './useHomeData';

// Live-data Home. Renders real personal numbers (greeting from profile,
// streak + weekly points from /score/summary, this-week from /runs +
// /workouts) and a real group pulse when the user belongs to a group.
//
// Render policy: the dashboard SHELL renders unconditionally — every card
// has its own honest empty state baked in. We never gate the whole page
// behind a single global Skeleton, because a stuck query (refetch on focus,
// 401 retry, slow group endpoint) would otherwise blank out the entire UI.
// A small banner is shown on top if a critical source errors; that's it.

export function HomeDashboard() {
  const { snapshot, isLoadingInitial, isError } = useHomeData();
  const greeting = greetingFor();

  return (
    <div className="px-4 pt-5 pb-6 mx-auto w-full max-w-5xl flex flex-col gap-5">
      {isError && (
        <div
          role="alert"
          className="rounded-card border border-accent/30 bg-accent/5 p-3 text-sm text-ink flex items-center gap-2"
        >
          <AlertCircle size={16} strokeWidth={1.8} className="text-accent shrink-0" />
          <span>Some of your stats didn't load. They'll update on the next refresh.</span>
        </div>
      )}

      <HomeHeader
        greeting={greeting}
        firstName={snapshot.user.firstName}
        streakDays={snapshot.user.streakDays}
        weeklyPoints={snapshot.user.weeklyPoints}
      />

      <LogHero activeGroupName={snapshot.group.groupName || null} />

      <StandingCard />

      <div className="grid gap-4 md:grid-cols-2 md:gap-5 items-start">
        <div className="flex flex-col gap-4 md:gap-5">
          <TodayCard planned={snapshot.today.planned} habits={snapshot.today.habits} />
          <ThisWeekCard week={snapshot.week} />
        </div>
        <div className="flex flex-col gap-4 md:gap-5">
          {snapshot.group.groupName ? (
            <GroupPulseCard pulse={snapshot.group} />
          ) : (
            <NoGroupCard />
          )}
          <RecentActivityList items={snapshot.recent} />
        </div>
      </div>

      {isLoadingInitial && (
        <p className="sr-only" role="status" aria-live="polite">
          Loading your dashboard…
        </p>
      )}
    </div>
  );
}

function NoGroupCard() {
  return (
    <section
      aria-labelledby="no-group-heading"
      className="rounded-card border border-dashed border-border bg-surface p-5 shadow-sm flex flex-col gap-3"
    >
      <span className="grid place-items-center w-10 h-10 rounded-pill bg-accent/10 text-accent">
        <Sparkles size={18} strokeWidth={1.8} />
      </span>
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
