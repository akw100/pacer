import { toast } from 'sonner';
import { CHALLENGE_METRICS, type ChallengeWithProgress, type Units } from '@pacer/shared';
import { useRespondChallenge } from './useChallenges';
import { formatMetricValue } from './format';

// The invitation banner at the top of the Challenges tab: "Mom challenged you…"
// with Accept / Decline. Only shown for challenges where my_status === 'invited'.

interface InvitationCardProps {
  challenge: ChallengeWithProgress;
  units: Units;
}

export function InvitationCard({ challenge, units }: InvitationCardProps) {
  const respond = useRespondChallenge();
  const meta = CHALLENGE_METRICS[challenge.metric];

  async function act(status: 'accepted' | 'declined') {
    try {
      await respond.mutateAsync({ id: challenge.id, status });
      toast.success(status === 'accepted' ? "You're in! 🔥" : 'Invitation declined');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not respond');
    }
  }

  return (
    <div className="rounded-card border border-accent/30 bg-accent/5 p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm text-ink">
          <span className="font-semibold">@{challenge.creator_handle}</span> challenged you
        </p>
        <p className="font-display text-base font-semibold text-ink">
          {meta.label} · {formatMetricValue(challenge.target, challenge.metric, units)}
        </p>
        {challenge.description && <p className="mt-1 text-sm text-ink-muted">{challenge.description}</p>}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={respond.isPending}
          onClick={() => act('declined')}
          className="flex-1 rounded-pill border border-border bg-surface py-2.5 text-sm font-semibold text-ink hover:bg-ink/5 disabled:opacity-50"
        >
          Decline
        </button>
        <button
          type="button"
          disabled={respond.isPending}
          onClick={() => act('accepted')}
          className="flex-1 rounded-pill bg-accent py-2.5 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50 transition-transform"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
