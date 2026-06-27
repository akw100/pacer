import { useState } from 'react';
import { Check, MailQuestion, X } from 'lucide-react';
import { toast } from 'sonner';
import type { GroupInviteWithProfiles } from '@pacer/shared';
import {
  useAcceptGroupInvite,
  useDeclineGroupInvite,
  useMyGroupInvites,
} from './useGroupInvites';

// Pending group invites the caller has received. Rendered at the top of
// GroupsHub so the user lands on `/group` and immediately sees them.
//
// Empty case: returns `null` (no card on the hub) so users without invites
// see the regular groups list cleanly. Loading and error states are
// minimal — this is a secondary surface, not the page's primary content.

export function PendingGroupInvitesCard() {
  const list = useMyGroupInvites();
  const accept = useAcceptGroupInvite();
  const decline = useDeclineGroupInvite();
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (list.isLoading) {
    return (
      <section
        aria-label="Loading pending group invites"
        className="rounded-card border border-border bg-surface p-4 shadow-sm"
      >
        <div className="h-4 w-40 rounded bg-ink/5 animate-pulse" />
        <div className="mt-3 h-12 rounded-card bg-ink/5 animate-pulse" />
      </section>
    );
  }

  if (list.isError) {
    return (
      <section className="rounded-card border border-border bg-surface p-4 shadow-sm flex items-center justify-between gap-3 text-sm">
        <span className="text-ink-muted">Couldn't load group invites.</span>
        <button
          type="button"
          onClick={() => list.refetch()}
          className="rounded-pill border border-border bg-surface px-3 py-1 text-xs font-medium text-ink hover:bg-ink/5"
        >
          Retry
        </button>
      </section>
    );
  }

  const invites = list.data ?? [];
  if (invites.length === 0) return null;

  async function doAccept(invite: GroupInviteWithProfiles) {
    setPendingId(invite.id);
    try {
      await accept.mutateAsync(invite.id);
      toast.success(`Joined ${invite.group_name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not accept');
    } finally {
      setPendingId(null);
    }
  }

  async function doDecline(invite: GroupInviteWithProfiles) {
    setPendingId(invite.id);
    try {
      await decline.mutateAsync(invite.id);
      toast.success('Invite declined');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not decline');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section
      aria-labelledby="pending-invites-heading"
      className="rounded-card border border-accent/30 bg-accent/5 p-4 shadow-sm flex flex-col gap-3"
    >
      <header className="inline-flex items-center gap-2">
        <MailQuestion size={16} strokeWidth={1.8} className="text-accent" />
        <h2 id="pending-invites-heading" className="font-display text-base font-semibold text-ink">
          Group invites
        </h2>
      </header>
      <ul role="list" className="flex flex-col gap-2">
        {invites.map((inv) => {
          const busy = pendingId === inv.id;
          return (
            <li
              key={inv.id}
              className="flex items-center gap-3 rounded-card border border-border bg-surface p-3"
            >
              <span
                aria-hidden="true"
                className="grid place-items-center w-9 h-9 rounded-pill bg-accent/10 text-accent font-display text-xs font-bold shrink-0"
              >
                {inv.group_name.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink">
                  <span className="font-semibold">{inv.inviter.display_name}</span>{' '}
                  invited you to{' '}
                  <span className="font-semibold">{inv.group_name}</span>
                </div>
                <div className="text-xs text-ink-muted truncate">@{inv.inviter.handle}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => void doDecline(inv)}
                  disabled={busy}
                  className="rounded-pill border border-border bg-surface px-3 py-1 text-xs font-medium text-ink hover:bg-ink/5 disabled:opacity-50 inline-flex items-center gap-1"
                >
                  <X size={11} strokeWidth={2} />
                  Decline
                </button>
                <button
                  type="button"
                  onClick={() => void doAccept(inv)}
                  disabled={busy}
                  className="rounded-pill bg-accent text-white px-3 py-1 text-xs font-semibold shadow-sm shadow-accent/20 disabled:opacity-60 inline-flex items-center gap-1"
                >
                  <Check size={11} strokeWidth={2.2} />
                  {busy ? 'Joining…' : 'Accept'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
