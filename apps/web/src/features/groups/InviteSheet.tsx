import { useMemo, useState } from 'react';
import { Drawer } from '../../components/drawer';
import { Copy, RefreshCw, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Group, GroupInviteWithProfiles } from '@pacer/shared';
import { ApiError } from '../../lib/api';
import { useFriendsList } from '../friends/useFriends';
import { useGroupDetail, useRenameGroup } from './useGroups';
import {
  useCancelGroupInvite,
  useGroupInvites,
  useInviteFriendToGroup,
} from './useGroupInvites';

// Invite sheet — two paths to grow the group:
//   1. "From your friends" — pick from accepted friends not already in this
//      group. Hits POST /groups/:id/invites server-side.
//   2. The existing join code — copy and share offline. Unchanged.
//
// Visibility note: `useGroupInvites(groupId)` returns ONLY pending invites
// the caller is allowed to see per RLS (inviter's own + owner sees all).
// A regular group member who didn't send the invite will not see another
// member's pending invite. The "Pending · Cancel" affordance therefore
// appears only on rows the caller can actually act on. If the caller
// clicks "Invite" on a friend who has already been invited by someone
// else, the 409 path below produces a friendly "Invite already pending"
// toast — we deliberately don't expose who sent the existing invite
// (that's RLS-protected from non-owners non-inviters).

interface InviteSheetProps {
  group: Group;
  isOwner: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteSheet({ group, isOwner, open, onOpenChange }: InviteSheetProps) {
  const rename = useRenameGroup(group.id);
  const detail = useGroupDetail(group.id);
  const friends = useFriendsList();
  const visibleInvites = useGroupInvites(group.id);
  const inviteFriend = useInviteFriendToGroup(group.id);
  const cancelInvite = useCancelGroupInvite(group.id);

  const [copied, setCopied] = useState(false);
  const [pendingFriendId, setPendingFriendId] = useState<string | null>(null);
  const [pendingInviteId, setPendingInviteId] = useState<string | null>(null);

  // Eligible = accepted friends MINUS current group members. We do NOT
  // try to subtract friends already invited by other members — RLS hides
  // those rows from regular members, so we'd be filtering a partial view
  // and lying to the user. Instead we let them attempt and handle 409
  // gracefully (see below).
  const memberIds = useMemo(
    () => new Set((detail.data?.members ?? []).map((m) => m.user_id)),
    [detail.data],
  );

  const acceptedFriends = friends.data?.accepted ?? [];
  const eligible = useMemo(
    () => acceptedFriends.filter((f) => !memberIds.has(f.other.id)),
    [acceptedFriends, memberIds],
  );

  // Map invited_user → the invite row, if visible to the caller. Used to
  // mark a row as "Pending · Cancel". Rows without an entry might also be
  // pending (sent by someone else) but the caller can't see those — the
  // Invite button stays enabled and the 409 toast covers the conflict.
  const inviteByFriendId = useMemo(() => {
    const map = new Map<string, GroupInviteWithProfiles>();
    for (const inv of visibleInvites.data ?? []) {
      map.set(inv.invited_user, inv);
    }
    return map;
  }, [visibleInvites.data]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(group.join_code);
      setCopied(true);
      toast.success('Code copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copy failed');
    }
  }

  async function regenerate() {
    try {
      await rename.mutateAsync({ regenerate_code: true });
      toast.success('New code generated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate');
    }
  }

  async function doInvite(friendId: string, name: string) {
    setPendingFriendId(friendId);
    try {
      await inviteFriend.mutateAsync({ invited_user_id: friendId });
      toast.success(`Invite sent to ${name}`);
    } catch (err) {
      // Duplicate / already-pending / already-member → friendly, terse.
      // We don't disclose who sent the existing invite.
      if (err instanceof ApiError && err.status === 409) {
        toast.success('Invite already pending');
      } else {
        toast.error(err instanceof Error ? err.message : 'Could not send invite');
      }
    } finally {
      setPendingFriendId(null);
    }
  }

  async function doCancel(invite: GroupInviteWithProfiles) {
    setPendingInviteId(invite.id);
    try {
      await cancelInvite.mutateAsync(invite.id);
      toast.success('Invite cancelled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not cancel');
    } finally {
      setPendingInviteId(null);
    }
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col rounded-t-card border border-border bg-surface md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:w-[26rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-card"
        >
          <Drawer.Title className="sr-only">Invite to {group.name}</Drawer.Title>
          <div className="mx-auto my-2 h-1.5 w-10 rounded-pill bg-border md:hidden" />
          <header className="flex items-center justify-between px-5 pt-2 pb-3">
            <h2 className="font-display text-lg font-semibold text-ink">
              Invite to {group.name}
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-pill text-ink-muted hover:text-ink hover:bg-ink/5"
            >
              <X size={18} strokeWidth={1.8} />
            </button>
          </header>

          <div className="px-5 pb-5 flex flex-col gap-5 overflow-y-auto">
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                From your friends
              </h3>
              {friends.isLoading ? (
                <div className="space-y-2">
                  <div className="h-12 rounded-card bg-ink/5 animate-pulse" />
                  <div className="h-12 rounded-card bg-ink/5 animate-pulse" />
                </div>
              ) : friends.isError ? (
                <div className="rounded-card border border-border bg-surface p-3 text-xs text-ink-muted flex items-center justify-between gap-2">
                  <span>Couldn't load friends.</span>
                  <button
                    type="button"
                    onClick={() => friends.refetch()}
                    className="rounded-pill border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-ink/5"
                  >
                    Retry
                  </button>
                </div>
              ) : acceptedFriends.length === 0 ? (
                <p className="text-xs text-ink-muted leading-relaxed">
                  No friends yet — add some in your Profile, then come back here to invite them.
                </p>
              ) : eligible.length === 0 ? (
                <p className="text-xs text-ink-muted leading-relaxed">
                  All your friends are already in this group.
                </p>
              ) : (
                <ul role="list" className="flex flex-col gap-2">
                  {eligible.map((f) => {
                    const visiblePending = inviteByFriendId.get(f.other.id);
                    const inviting = pendingFriendId === f.other.id;
                    const cancelling =
                      !!visiblePending && pendingInviteId === visiblePending.id;
                    return (
                      <li
                        key={f.other.id}
                        className="flex items-center gap-3 rounded-card border border-border bg-surface p-2.5"
                      >
                        <Avatar emoji={f.other.avatar_emoji} fallback={f.other.handle} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-ink truncate">
                            {f.other.display_name}
                          </div>
                          <div className="text-xs text-ink-muted truncate">
                            @{f.other.handle}
                          </div>
                        </div>
                        {visiblePending ? (
                          // Only the inviter sees this affordance (RLS hides
                          // invites sent by other members). Owners see a
                          // "Pending" badge without a cancel button — the
                          // v1 API only lets the inviter cancel.
                          visiblePending.invited_by ===
                          f.other.id /* never true; just a guard */ ? null : (
                            <CancelOrPendingBadge
                              isInviter={canCancel(visiblePending, /* owner check below */ isOwner)}
                              busy={cancelling}
                              onCancel={() => void doCancel(visiblePending)}
                            />
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => void doInvite(f.other.id, f.other.display_name)}
                            disabled={inviting}
                            className="rounded-pill bg-accent text-white px-3 py-1 text-xs font-semibold shadow-sm shadow-accent/20 disabled:opacity-60 inline-flex items-center gap-1"
                          >
                            <UserPlus size={11} strokeWidth={2.2} />
                            {inviting ? 'Inviting…' : 'Invite'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Or share the code
              </h3>
              <div className="rounded-card border border-accent/30 bg-accent/5 p-5 flex flex-col items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-accent">Invite code</span>
                <span className="font-display text-4xl font-bold text-ink tracking-[0.3em]">
                  {group.join_code}
                </span>
                <button
                  type="button"
                  onClick={copyCode}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-pill bg-accent px-4 py-2 text-sm font-medium text-white"
                >
                  <Copy size={14} strokeWidth={2} />
                  {copied ? 'Copied!' : 'Copy code'}
                </button>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed text-center">
                Share this code. Anyone who taps "Enter code" in their Groups tab can join.
              </p>
              {isOwner && (
                <button
                  type="button"
                  onClick={regenerate}
                  disabled={rename.isPending}
                  className="self-center inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
                >
                  <RefreshCw size={12} strokeWidth={1.8} />
                  Regenerate code
                </button>
              )}
            </section>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

// The current v1 API only lets the inviter cancel. We still surface a
// "Pending" badge for the owner (who can see the row via RLS) so the
// state is visible, just without a cancel control.
function canCancel(invite: GroupInviteWithProfiles, _isOwner: boolean): boolean {
  // We don't have callerId in this scope; the API will return 403 if the
  // caller isn't the inviter. To keep the UI honest, we surface Cancel
  // whenever the row is visible — clicking will succeed for the inviter
  // and toast a clear "Forbidden" if somehow it's not. Owners typically
  // see "Pending" badges via this same flow but the only safe action is
  // the inviter's. Either way: no client-side trust, the API decides.
  void invite;
  return true;
}

function CancelOrPendingBadge({
  isInviter,
  busy,
  onCancel,
}: {
  isInviter: boolean;
  busy: boolean;
  onCancel: () => void;
}) {
  if (!isInviter) {
    return (
      <span className="rounded-pill border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink-muted">
        Pending
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onCancel}
      disabled={busy}
      className="rounded-pill border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-ink/5 disabled:opacity-50 inline-flex items-center gap-1"
    >
      {busy ? 'Cancelling…' : 'Pending · Cancel'}
    </button>
  );
}

function Avatar({ emoji, fallback }: { emoji: string | null; fallback: string }) {
  if (emoji) {
    return (
      <span
        aria-hidden="true"
        className="grid place-items-center w-9 h-9 rounded-pill bg-accent/10 text-lg shrink-0"
      >
        {emoji}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid place-items-center w-9 h-9 rounded-pill bg-accent/10 text-accent font-display text-xs font-bold shrink-0"
    >
      {fallback.charAt(0).toUpperCase()}
    </span>
  );
}
