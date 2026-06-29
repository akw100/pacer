import { useState } from 'react';
import { Check, Plus, Search, UserMinus, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '../../lib/api';
import {
  useFriendAccept,
  useFriendDecline,
  useFriendLookup,
  useFriendRemove,
  useFriendRequest,
  useFriendsList,
  type FriendshipWithProfile,
} from './useFriends';

// "Profile & Friends" management section. Rendered inside Profile.tsx.
// Surfaces accepted friends + pending requests in both directions, plus
// handle-search to add new ones.
//
// v1 surfaces: search · accept incoming · decline incoming · cancel
// outgoing · remove accepted. Additional moderation flows will arrive with
// their own management screens in a follow-up.

const HANDLE_REGEX = /^[a-z0-9_]{3,20}$/;

export function FriendsSection() {
  const list = useFriendsList();
  const accept = useFriendAccept();
  const decline = useFriendDecline();
  const remove = useFriendRemove();

  // Inline confirm state for remove/cancel; only one open at a time.
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const accepted = list.data?.accepted ?? [];
  const incoming = list.data?.incoming ?? [];
  const outgoing = list.data?.outgoing ?? [];

  async function doAccept(userId: string, name: string) {
    try {
      await accept.mutateAsync(userId);
      toast.success(`You're now friends with ${name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not accept');
    }
  }

  async function doDecline(userId: string) {
    try {
      await decline.mutateAsync(userId);
      toast.success('Request declined');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not decline');
    }
  }

  async function doRemove(userId: string, kind: 'cancel' | 'remove') {
    try {
      await remove.mutateAsync(userId);
      toast.success(kind === 'cancel' ? 'Request cancelled' : 'Friend removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove');
    } finally {
      setConfirmRemoveId(null);
    }
  }

  return (
    <section
      aria-labelledby="friends-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-5"
    >
      <header>
        <h2 id="friends-heading" className="font-display text-lg font-semibold text-ink">
          Friends
        </h2>
        <p className="text-xs text-ink-muted mt-1">
          Add people by their @handle to compare your week with theirs.
        </p>
      </header>

      <AddFriend />

      {list.isLoading ? (
        <div className="space-y-2">
          <div className="h-12 rounded-card bg-ink/5 animate-pulse" />
          <div className="h-12 rounded-card bg-ink/5 animate-pulse" />
          <div className="h-12 rounded-card bg-ink/5 animate-pulse" />
        </div>
      ) : list.isError ? (
        <div className="rounded-card border border-accent/30 bg-accent/5 p-3 text-sm text-ink-muted flex items-center justify-between">
          <span>Couldn't load your friends.</span>
          <button
            type="button"
            onClick={() => list.refetch()}
            className="rounded-pill border border-border bg-surface px-3 py-1 text-xs font-medium text-ink hover:bg-ink/5"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {incoming.length > 0 && (
            <Group title="Incoming requests">
              {incoming.map((r) => (
                <RequestRow
                  key={r.other.id}
                  row={r}
                  primary={{
                    label: 'Accept',
                    onClick: () => doAccept(r.other.id, r.other.display_name),
                    icon: <Check size={12} strokeWidth={2.2} />,
                  }}
                  secondary={{
                    label: 'Decline',
                    onClick: () => doDecline(r.other.id),
                  }}
                  busy={accept.isPending || decline.isPending}
                />
              ))}
            </Group>
          )}

          {outgoing.length > 0 && (
            <Group title="Outgoing requests">
              {outgoing.map((r) => {
                const isConfirming = confirmRemoveId === r.other.id;
                return (
                  <RequestRow
                    key={r.other.id}
                    row={r}
                    primary={
                      isConfirming
                        ? {
                            label: 'Cancel request',
                            onClick: () => doRemove(r.other.id, 'cancel'),
                            danger: true,
                          }
                        : {
                            label: 'Cancel',
                            onClick: () => setConfirmRemoveId(r.other.id),
                          }
                    }
                    secondary={
                      isConfirming
                        ? { label: 'Keep', onClick: () => setConfirmRemoveId(null) }
                        : undefined
                    }
                    busy={remove.isPending && confirmRemoveId === r.other.id}
                  />
                );
              })}
            </Group>
          )}

          <Group title="Your friends">
            {accepted.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No friends yet — search for someone above.
              </p>
            ) : (
              accepted.map((r) => {
                const isConfirming = confirmRemoveId === r.other.id;
                return (
                  <FriendRow
                    key={r.other.id}
                    row={r}
                    isConfirming={isConfirming}
                    busy={remove.isPending && confirmRemoveId === r.other.id}
                    onAskRemove={() => setConfirmRemoveId(r.other.id)}
                    onCancelRemove={() => setConfirmRemoveId(null)}
                    onConfirmRemove={() => doRemove(r.other.id, 'remove')}
                  />
                );
              })
            )}
          </Group>
        </>
      )}
    </section>
  );
}

// ── Add Friend (handle lookup + send request) ────────────────────────────

function AddFriend() {
  const lookup = useFriendLookup();
  const request = useFriendRequest();
  const [handle, setHandle] = useState('');
  const [result, setResult] = useState<
    | { kind: 'idle' }
    | { kind: 'not-found' }
    | { kind: 'found'; id: string; handle: string; display_name: string; avatar_emoji: string | null }
  >({ kind: 'idle' });

  const cleanHandle = handle.trim().toLowerCase();
  const isValid = HANDLE_REGEX.test(cleanHandle);

  async function doLookup() {
    if (!isValid) {
      toast.error('Handles are 3–20 lowercase letters, digits, or underscores');
      return;
    }
    try {
      const profile = await lookup.mutateAsync(cleanHandle);
      if (!profile) {
        setResult({ kind: 'not-found' });
      } else {
        setResult({
          kind: 'found',
          id: profile.id,
          handle: profile.handle,
          display_name: profile.display_name,
          avatar_emoji: profile.avatar_emoji,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lookup failed');
    }
  }

  async function sendRequest(targetId: string, name: string) {
    try {
      await request.mutateAsync({ user_id: targetId });
      toast.success(`Friend request sent to ${name}`);
      setHandle('');
      setResult({ kind: 'idle' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('Already friends or request already exists');
      } else {
        toast.error(err instanceof Error ? err.message : 'Could not send request');
      }
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={14}
            strokeWidth={1.8}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
          />
          <input
            type="text"
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value);
              if (result.kind !== 'idle') setResult({ kind: 'idle' });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void doLookup();
            }}
            placeholder="@handle"
            className="w-full rounded-card border border-border bg-surface pl-9 pr-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
          />
        </div>
        <button
          type="button"
          onClick={doLookup}
          disabled={lookup.isPending || !handle}
          className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-accent/20 disabled:opacity-50"
        >
          {lookup.isPending ? 'Searching…' : 'Find'}
        </button>
      </div>

      {result.kind === 'not-found' && (
        <p className="text-xs text-ink-muted">No one with that handle.</p>
      )}

      {result.kind === 'found' && (
        <div className="rounded-card border border-accent/30 bg-accent/5 p-3 flex items-center gap-3">
          <Avatar emoji={result.avatar_emoji} fallback={result.handle} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-ink truncate">{result.display_name}</div>
            <div className="text-xs text-ink-muted truncate">@{result.handle}</div>
          </div>
          <button
            type="button"
            onClick={() => sendRequest(result.id, result.display_name)}
            disabled={request.isPending}
            className="inline-flex items-center gap-1 rounded-pill bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            <UserPlus size={12} strokeWidth={2.2} />
            {request.isPending ? 'Sending…' : 'Send request'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Row components ────────────────────────────────────────────────────────

interface ActionConfig {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
}

interface RequestRowProps {
  row: FriendshipWithProfile;
  primary: ActionConfig;
  secondary?: ActionConfig;
  busy?: boolean;
}

function RequestRow({ row, primary, secondary, busy }: RequestRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-3">
      <Avatar emoji={row.other.avatar_emoji} fallback={row.other.handle} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink truncate">{row.other.display_name}</div>
        <div className="text-xs text-ink-muted truncate">@{row.other.handle}</div>
      </div>
      <div className="flex items-center gap-1">
        {secondary && (
          <button
            type="button"
            onClick={secondary.onClick}
            disabled={busy}
            className="rounded-pill border border-border bg-surface px-3 py-1 text-xs font-medium text-ink hover:bg-ink/5 disabled:opacity-50"
          >
            {secondary.label}
          </button>
        )}
        <button
          type="button"
          onClick={primary.onClick}
          disabled={busy}
          className={`inline-flex items-center gap-1 rounded-pill px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
            primary.danger
              ? 'bg-accent text-white'
              : 'bg-accent text-white shadow-sm shadow-accent/20'
          }`}
        >
          {primary.icon}
          {primary.label}
        </button>
      </div>
    </div>
  );
}

interface FriendRowProps {
  row: FriendshipWithProfile;
  isConfirming: boolean;
  busy: boolean;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
}

function FriendRow({
  row,
  isConfirming,
  busy,
  onAskRemove,
  onCancelRemove,
  onConfirmRemove,
}: FriendRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-3">
      <Avatar emoji={row.other.avatar_emoji} fallback={row.other.handle} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink truncate">{row.other.display_name}</div>
        <div className="text-xs text-ink-muted truncate">@{row.other.handle}</div>
      </div>
      {isConfirming ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCancelRemove}
            className="rounded-pill text-xs text-ink-muted hover:bg-ink/5 px-2 py-1 inline-flex items-center gap-1"
          >
            <X size={11} strokeWidth={2} />
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirmRemove}
            disabled={busy}
            className="rounded-pill bg-accent text-white px-3 py-1 text-xs font-semibold disabled:opacity-60"
          >
            {busy ? 'Removing…' : 'Remove'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onAskRemove}
          aria-label={`Remove ${row.other.display_name}`}
          className="p-1.5 rounded-pill text-ink-muted hover:text-accent hover:bg-accent/10"
        >
          <UserMinus size={14} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
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

// Hint suppression: keep the Plus icon import for downstream use; lucide-react
// tree-shakes unused imports during build.
export type { ActionConfig };
void Plus;
