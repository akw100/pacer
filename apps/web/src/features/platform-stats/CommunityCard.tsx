import NumberFlow from '@number-flow/react';
import { motion } from 'motion/react';
import { Flame, TrendingUp, Trophy, Users } from 'lucide-react';
import { formatPace } from '@pacer/shared';
import { usePlatformStats } from './usePlatformStats';
import { CommunityCardEmpty } from './CommunityCard.empty';

// Anonymous, platform-wide community card. Sits below the personal Trends
// charts on phone and in the right rail on desktop (the parent layout
// decides which). No identity — never renders a name, handle, or avatar.

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function CommunityCard() {
  const { data, isLoading, isError, refetch } = usePlatformStats();

  if (isLoading) return <Skeleton />;
  if (isError) return <ErrorBox onRetry={() => refetch()} />;
  if (!data) return null;

  const { community, you } = data;
  const empty =
    community.weekKm === 0 &&
    you.distancePercentile == null &&
    you.scorePercentile == null &&
    you.streakPercentile == null;
  if (empty) return <CommunityCardEmpty />;

  const weekday =
    community.popularRunWeekday != null ? WEEKDAYS[community.popularRunWeekday] : null;
  const popularHour =
    community.popularRunHour != null ? formatHour(community.popularRunHour) : null;
  const avgPace =
    community.avgPaceSecondsPerKm != null ? formatPace(community.avgPaceSecondsPerKm) : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 26 }}
      aria-labelledby="community-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-4"
    >
      <header className="flex items-center gap-2 text-ink-muted">
        <Users size={14} strokeWidth={1.8} />
        <h2
          id="community-heading"
          className="text-xs uppercase tracking-[0.18em] font-semibold"
        >
          Community
        </h2>
      </header>

      <div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-base text-ink-muted">Pacer ran</span>
          <span className="font-display text-4xl font-bold text-ink tabular-nums leading-none">
            <NumberFlow value={community.weekKm} format={{ maximumFractionDigits: 1 }} />
          </span>
          <span className="font-display text-2xl font-bold text-ink leading-none">km</span>
          <span className="text-base text-ink-muted">this week</span>
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          <span className="tabular-nums font-semibold text-ink">{community.runsToday}</span>{' '}
          runs logged today
          {community.habitsCheckedToday > 0 && (
            <>
              {' · '}
              <span className="tabular-nums font-semibold text-ink">
                {community.habitsCheckedToday}
              </span>{' '}
              habits checked
            </>
          )}
        </p>
      </div>

      {(you.distancePercentile != null ||
        you.scorePercentile != null ||
        you.streakPercentile != null) && (
        <div className="flex flex-wrap gap-2">
          {you.distancePercentile != null && (
            <StandingPill
              icon={<TrendingUp size={12} strokeWidth={2.2} />}
              label="distance"
              percentile={you.distancePercentile}
            />
          )}
          {you.scorePercentile != null && (
            <StandingPill
              icon={<Trophy size={12} strokeWidth={2.2} />}
              label="score"
              percentile={you.scorePercentile}
            />
          )}
          {you.streakPercentile != null && (
            <StandingPill
              icon={<Flame size={12} strokeWidth={2.2} />}
              label="streak"
              percentile={you.streakPercentile}
            />
          )}
        </div>
      )}

      {(weekday || popularHour || avgPace) && (
        <p className="text-sm text-ink-muted leading-relaxed">
          {weekday && popularHour && (
            <>
              Most popular run day:{' '}
              <span className="text-ink font-medium">{weekday}</span> around{' '}
              <span className="text-ink font-medium tabular-nums">{popularHour}</span>.{' '}
            </>
          )}
          {avgPace && (
            <>
              Platform avg pace{' '}
              <span className="text-ink font-medium tabular-nums">{avgPace} /km</span>.
            </>
          )}
        </p>
      )}
    </motion.section>
  );
}

function StandingPill({
  icon,
  label,
  percentile,
}: {
  icon: React.ReactNode;
  label: string;
  percentile: number;
}) {
  const fromTop = Math.max(1, 100 - percentile);
  return (
    <span
      aria-label={`You're in the top ${fromTop}% by ${label}`}
      className="inline-flex items-center gap-1.5 rounded-pill border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent"
    >
      {icon}
      <span>
        Top <span className="tabular-nums font-semibold">{fromTop}%</span> by {label}
      </span>
    </span>
  );
}

function formatHour(h: number): string {
  // 0–23 → "9:00" / "21:00" — keep it simple and locale-neutral.
  return `${h.toString().padStart(2, '0')}:00`;
}

function Skeleton() {
  return (
    <div
      role="status"
      aria-label="Loading community stats"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-4"
    >
      <div className="h-3 w-24 rounded bg-ink/10 animate-pulse" />
      <div className="h-9 w-3/4 rounded bg-ink/10 animate-pulse" />
      <div className="h-4 w-1/2 rounded bg-ink/5 animate-pulse" />
      <div className="flex gap-2">
        <div className="h-6 w-24 rounded-pill bg-ink/5 animate-pulse" />
        <div className="h-6 w-24 rounded-pill bg-ink/5 animate-pulse" />
      </div>
    </div>
  );
}

function ErrorBox({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-sm flex items-center justify-between gap-3 text-sm">
      <span className="text-ink-muted">Couldn't load community stats.</span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-pill border border-border bg-surface px-3 py-1 text-xs font-medium text-ink hover:bg-ink/5"
      >
        Retry
      </button>
    </div>
  );
}
