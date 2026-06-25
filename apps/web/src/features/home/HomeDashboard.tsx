import { HomeHeader } from './HomeHeader';
import { TodayCard } from './TodayCard';
import { ThisWeekCard } from './ThisWeekCard';
import { GroupPulseCard } from './GroupPulseCard';
import { RecentActivityList } from './RecentActivityList';
import { greetingFor, homeSnapshot, type HomeSnapshot } from './home.mock';

interface HomeDashboardProps {
  /** Future swap: `useHomeSnapshot()` from a queries module. */
  snapshot?: HomeSnapshot;
}

export function HomeDashboard({ snapshot = homeSnapshot }: HomeDashboardProps) {
  const greeting = greetingFor();

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
          <GroupPulseCard pulse={snapshot.group} />
          <RecentActivityList items={snapshot.recent} />
        </div>
      </div>
    </div>
  );
}
