import {
  CHALLENGE_METRICS,
  challengeWinner,
  isChallengeComplete,
  youTubeThumbnailUrl,
  type ChallengeWithProgress,
  type Units,
} from '@pacer/shared';
import { Trophy, Calendar, Video } from 'lucide-react';
import { ProgressBar } from './ProgressBar';
import { AnimatedMetric } from './AnimatedMetric';
import { formatMetricValue, progressFraction, daysLeft, todayKey } from './format';

// One challenge as a card on the hub: title line (metric + target), a progress
// bar toward the target for the caller, a days-left chip, and a mini leaderboard
// of the top participants. Finished challenges show a winner banner.

interface ChallengeCardProps {
  challenge: ChallengeWithProgress;
  units: Units;
  youUserId: string | null;
  onOpen: (c: ChallengeWithProgress) => void;
}

export function ChallengeCard({ challenge, units, youUserId, onOpen }: ChallengeCardProps) {
  const meta = CHALLENGE_METRICS[challenge.metric];
  const fraction = progressFraction(challenge.my_progress, challenge.target);
  const complete = isChallengeComplete(challenge.my_progress, challenge.target);
  const left = daysLeft(challenge.end_date, todayKey());
  const winner = challenge.state === 'finished' ? challengeWinner(challenge.leaderboard) : null;
  const top = [...challenge.leaderboard].slice(0, 3);
  const thumb = challenge.youtube_url ? youTubeThumbnailUrl(challenge.youtube_url) : null;

  return (
    // A card holds a list + headings (flow content), so it can't be a <button>.
    // Use a focusable role="button" with keyboard activation instead.
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(challenge)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(challenge);
        }
      }}
      className="w-full text-left rounded-card border border-border bg-surface p-4 shadow-sm flex flex-col gap-3 cursor-pointer active:scale-[0.99] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-ink truncate">
            {meta.label} · {formatMetricValue(challenge.target, challenge.metric, units)}
          </h3>
          <p className="text-xs text-ink-muted truncate">
            by @{challenge.creator_handle}
            {challenge.audience === 'group' && ' · group'}
            {challenge.audience === 'everyone' && ' · open'}
            {challenge.accepted_count > 0 && ` · ${challenge.accepted_count} in`}
          </p>
        </div>
        {challenge.state === 'upcoming' ? (
          <Chip icon={<Calendar size={12} strokeWidth={2} />} tone="muted">
            soon
          </Chip>
        ) : challenge.state === 'active' ? (
          <Chip icon={<Calendar size={12} strokeWidth={2} />} tone="streak">
            {left <= 0 ? 'Last day' : `${left}d left`}
          </Chip>
        ) : (
          <Chip icon={<Trophy size={12} strokeWidth={2} />} tone="success">
            done
          </Chip>
        )}
      </header>

      {thumb && (
        <div className="relative overflow-hidden rounded-card border border-border" style={{ aspectRatio: '16 / 9' }}>
          <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
          <span className="absolute inset-0 grid place-items-center bg-ink/20">
            <span className="grid place-items-center w-9 h-9 rounded-pill bg-surface/90 text-ink">
              <Video size={16} strokeWidth={2} />
            </span>
          </span>
        </div>
      )}

      {winner ? (
        <div className="rounded-card bg-streak/10 px-3 py-2 text-sm text-ink">
          <span className="mr-1">🏆</span>
          <span className="font-semibold">
            {winner.user_id === youUserId ? 'You' : winner.display_name}
          </span>{' '}
          won · {formatMetricValue(winner.progress, challenge.metric, units)}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-ink-muted">Your progress</span>
            <span className="font-display text-sm font-bold text-ink tabular-nums">
              <AnimatedMetric value={challenge.my_progress} metric={challenge.metric} units={units} />
              <span className="text-ink-muted font-medium">
                {' / '}
                {formatMetricValue(challenge.target, challenge.metric, units)}
              </span>
            </span>
          </div>
          <ProgressBar fraction={fraction} complete={complete} />
        </div>
      )}

      {top.length > 1 && (
        <ol className="flex flex-col gap-1">
          {top.map((row, i) => (
            <li key={row.user_id} className="flex items-center gap-2 text-xs">
              <span className="w-4 text-ink-muted tabular-nums">{i + 1}</span>
              <span aria-hidden>{row.avatar_emoji ?? '🏃'}</span>
              <span className={`flex-1 truncate ${row.user_id === youUserId ? 'font-semibold text-ink' : 'text-ink'}`}>
                {row.user_id === youUserId ? 'You' : row.display_name}
              </span>
              <span className="tabular-nums text-ink-muted">
                {formatMetricValue(row.progress, challenge.metric, units)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Chip({
  children,
  icon,
  tone,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  tone: 'muted' | 'streak' | 'success';
}) {
  const toneClass =
    tone === 'streak'
      ? 'bg-streak/15 text-streak'
      : tone === 'success'
        ? 'bg-success/15 text-success'
        : 'bg-ink/5 text-ink-muted';
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-semibold ${toneClass}`}>
      {icon}
      {children}
    </span>
  );
}
