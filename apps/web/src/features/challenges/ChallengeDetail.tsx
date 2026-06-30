import { toast } from 'sonner';
import { Drawer } from '../../components/drawer';
import { X, Trophy, CheckCircle2, Trash2, RotateCcw, Pencil } from 'lucide-react';
import {
  CHALLENGE_METRICS,
  challengeWinner,
  isChallengeComplete,
  type ChallengeWithProgress,
  type Units,
} from '@pacer/shared';
import { ProgressBar } from './ProgressBar';
import { AnimatedMetric } from './AnimatedMetric';
import { DaysLeftRing } from './DaysLeftRing';
import { YouTubeEmbed } from './YouTubeEmbed';
import { useCheckIn, useJoinChallenge, useDeleteChallenge } from './useChallenges';
import { formatMetricValue, progressFraction, todayKey, windowLabel } from './format';

// Challenge detail — opens as a bottom sheet (mobile) / centered panel
// (desktop): description, embedded video, your progress, the full leaderboard,
// and the contextual action (join an open challenge, or log a check-in).

interface ChallengeDetailProps {
  challenge: ChallengeWithProgress | null;
  units: Units;
  youUserId: string | null;
  onOpenChange: (open: boolean) => void;
  onRematch?: (c: ChallengeWithProgress) => void;
  onEdit?: (c: ChallengeWithProgress) => void;
}

export function ChallengeDetail({ challenge, units, youUserId, onOpenChange, onRematch, onEdit }: ChallengeDetailProps) {
  const checkIn = useCheckIn();
  const join = useJoinChallenge();
  const del = useDeleteChallenge();

  if (!challenge) return null;
  const meta = CHALLENGE_METRICS[challenge.metric];
  const winner = challenge.state === 'finished' ? challengeWinner(challenge.leaderboard) : null;
  const isCreator = !!youUserId && challenge.creator_id === youUserId;
  const isParticipant = challenge.my_status === 'accepted' || challenge.my_status === 'invited';
  const canJoin =
    !isParticipant && challenge.audience !== 'user' && challenge.state !== 'finished';
  const canCheckIn =
    challenge.metric === 'check_in' && challenge.state === 'active';

  async function doCheckIn() {
    if (!challenge) return;
    try {
      await checkIn.mutateAsync({ id: challenge.id });
      toast.success('Checked in! ✅');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not check in');
    }
  }

  async function doJoin() {
    if (!challenge) return;
    try {
      await join.mutateAsync(challenge.id);
      toast.success("You're in! 🔥");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not join');
    }
  }

  async function doDelete() {
    if (!challenge) return;
    if (!confirm('Cancel this challenge for everyone? This cannot be undone.')) return;
    try {
      await del.mutateAsync(challenge.id);
      toast.success('Challenge cancelled');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not cancel');
    }
  }

  return (
    <Drawer.Root open={!!challenge} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col rounded-t-card border border-border bg-surface md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:w-[30rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-card"
        >
          <Drawer.Title className="sr-only">Challenge details</Drawer.Title>
          <div className="mx-auto my-2 h-1.5 w-10 rounded-pill bg-border md:hidden" />
          <header className="flex items-start justify-between gap-3 px-5 pt-2 pb-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">
                {meta.label} · {formatMetricValue(challenge.target, challenge.metric, units)}
              </h2>
              <p className="text-xs text-ink-muted">
                by @{challenge.creator_handle} ·{' '}
                {windowLabel(challenge.state, challenge.start_date, challenge.end_date, todayKey())}
              </p>
            </div>
            {challenge.state === 'active' && (
              <DaysLeftRing start={challenge.start_date} end={challenge.end_date} today={todayKey()} />
            )}
            <button
              aria-label="Close"
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-pill text-ink-muted hover:text-ink hover:bg-ink/5"
            >
              <X size={18} strokeWidth={1.8} />
            </button>
          </header>

          <div className="px-5 pb-5 flex flex-col gap-4 overflow-y-auto">
            {challenge.description && <p className="text-sm text-ink leading-relaxed">{challenge.description}</p>}

            <YouTubeEmbed url={challenge.youtube_url} title={`${meta.label} challenge`} />

            {winner && (
              <div className="flex items-center gap-2 rounded-card bg-streak/10 px-4 py-3">
                <Trophy size={18} className="text-streak" strokeWidth={1.8} />
                <span className="text-sm text-ink">
                  <span className="font-semibold">
                    {winner.user_id === youUserId ? 'You' : winner.display_name}
                  </span>{' '}
                  won · {formatMetricValue(winner.progress, challenge.metric, units)}
                </span>
              </div>
            )}

            {isParticipant && !winner && (
              <div className="flex flex-col gap-1.5">
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
                <ProgressBar
                  fraction={progressFraction(challenge.my_progress, challenge.target, challenge.metric)}
                  complete={isChallengeComplete(challenge.my_progress, challenge.target)}
                />
              </div>
            )}

            <section className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs uppercase tracking-wide text-ink-muted">Leaderboard</h3>
                <span className="text-xs text-ink-muted">
                  {challenge.accepted_count} in
                  {challenge.participant_count > challenge.accepted_count &&
                    ` · ${challenge.participant_count - challenge.accepted_count} pending`}
                </span>
              </div>
              {challenge.leaderboard.length === 0 ? (
                <p className="text-sm text-ink-muted">No participants yet.</p>
              ) : (
                <ol className="flex flex-col gap-1.5">
                  {challenge.leaderboard.map((row, i) => (
                    <li
                      key={row.user_id}
                      className={`flex items-center gap-3 rounded-card border px-3 py-2 ${
                        row.user_id === youUserId ? 'border-accent/40 bg-accent/5' : 'border-border bg-surface'
                      }`}
                    >
                      <span
                        aria-label={`Rank ${i + 1}`}
                        className={`grid place-items-center w-7 h-7 rounded-pill text-xs font-bold ${
                          i < 3 && row.progress > 0 ? 'bg-streak/15 text-streak' : 'bg-ink/5 text-ink-muted'
                        }`}
                      >
                        {i < 3 && row.progress > 0 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                      </span>
                      <span aria-hidden>{row.avatar_emoji ?? '🏃'}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm truncate ${row.user_id === youUserId ? 'font-semibold text-ink' : 'text-ink'}`}>
                          {row.user_id === youUserId ? 'You' : row.display_name}
                        </div>
                        <div className="text-xs text-ink-muted truncate">
                          @{row.handle}
                          {row.status === 'invited' && ' · invited'}
                        </div>
                      </div>
                      <span className="font-display text-sm font-bold text-ink tabular-nums">
                        {formatMetricValue(row.progress, challenge.metric, units)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {canJoin && (
              <button
                type="button"
                disabled={join.isPending}
                onClick={doJoin}
                className="rounded-pill bg-accent text-white py-3 text-sm font-semibold active:scale-[0.98] disabled:opacity-50 transition-transform"
              >
                {join.isPending ? 'Joining…' : 'Join challenge'}
              </button>
            )}

            {canCheckIn && (isParticipant || challenge.audience !== 'user') && (
              <button
                type="button"
                disabled={checkIn.isPending}
                onClick={doCheckIn}
                className="inline-flex items-center justify-center gap-2 rounded-pill bg-success text-white py-3 text-sm font-semibold active:scale-[0.98] disabled:opacity-50 transition-transform"
              >
                <CheckCircle2 size={16} strokeWidth={2} />
                {checkIn.isPending ? 'Saving…' : "Check in for today"}
              </button>
            )}

            {challenge.state === 'finished' && onRematch && (
              <button
                type="button"
                onClick={() => onRematch(challenge)}
                className="inline-flex items-center justify-center gap-2 rounded-pill bg-accent text-white py-3 text-sm font-semibold active:scale-[0.98] transition-transform"
              >
                <RotateCcw size={16} strokeWidth={2} />
                Rematch
              </button>
            )}

            {isCreator && challenge.state === 'upcoming' && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(challenge)}
                className="inline-flex items-center justify-center gap-2 rounded-pill border border-border bg-surface py-2.5 text-sm font-medium text-ink hover:bg-ink/5 transition-colors"
              >
                <Pencil size={15} strokeWidth={1.8} />
                Edit challenge
              </button>
            )}

            {isCreator && (
              <button
                type="button"
                disabled={del.isPending}
                onClick={doDelete}
                className="inline-flex items-center justify-center gap-2 rounded-pill border border-border bg-surface py-2.5 text-sm font-medium text-ink-muted hover:text-accent hover:border-accent/40 disabled:opacity-50 transition-colors"
              >
                <Trash2 size={15} strokeWidth={1.8} />
                {del.isPending ? 'Cancelling…' : 'Cancel challenge'}
              </button>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
