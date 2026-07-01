import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { ParticipantState, RaceParticipant } from '@pacer/shared';
import { metersToDisplayDistance } from '@pacer/shared';
import { Button } from '../../components/Button';
import { Loader } from '../../components/Loader';
import { useProfile } from '../auth/useProfile';
import { useFriendsList } from '../friends/useFriends';
import {
  cancelRace,
  getRace,
  invite,
  joinRace,
  raceKeys,
  setReady,
  startRace,
} from './api';
import { useRaceChannel } from './useRaceChannel';
import { useRaceNames } from './useRaceNames';

// Lobby for an existing race (`/races/:id/lobby`). The list/create entry lives
// in RacesPage; here we manage one race: invite friends, toggle readiness, and
// (host only) start or cancel. `useRaceChannel` keeps the participant list live
// — a join/ready by anyone invalidates the detail query and re-renders the list.
// On a successful start we route to the run screen at `/races/:id`.

const READY_LABEL: Partial<Record<ParticipantState, string>> = {
  invited: 'Invited',
  joined: 'Joined',
  ready: 'Ready',
  racing: 'Racing',
  finished: 'Finished',
  dnf: 'Did not finish',
};

export default function LobbyScreen() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile } = useProfile();
  const units = profile?.units ?? 'km';
  const { nameFor, youId } = useRaceNames();

  // Live participant list: the channel invalidates the detail query on lobby
  // activity, so this query is the single source the list renders from.
  useRaceChannel(id);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: raceKeys.detail(id),
    queryFn: () => getRace(id),
    enabled: !!id,
  });

  const race = data?.race;
  const participants = useMemo(() => data?.participants ?? [], [data]);
  const me = participants.find((p) => p.user_id === youId);
  const isHost = !!race && race.creator_id === youId;
  const amReady = me?.state === 'ready';

  // Once the host starts, the race goes active → jump to the run screen.
  useEffect(() => {
    if (race?.status === 'active') navigate(`/races/${id}`, { replace: true });
    if (race?.status === 'cancelled') {
      toast('This race was cancelled');
      navigate('/races', { replace: true });
    }
  }, [race?.status, id, navigate]);

  const readyMut = useMutation({
    // An invited-but-not-yet-joined runner must join before they can be ready
    // — /ready only transitions rows already in `joined`.
    mutationFn: () => (me?.state === 'invited' ? joinRace(id).then(() => setReady(id)) : setReady(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: raceKeys.detail(id) }),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not set ready'),
  });
  const startMut = useMutation({
    mutationFn: () => startRace(id),
    onSuccess: () => navigate(`/races/${id}`, { replace: true }),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not start'),
  });
  const cancelMut = useMutation({
    mutationFn: () => cancelRace(id),
    onSuccess: () => navigate('/races', { replace: true }),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not cancel'),
  });

  if (isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader label="Loading race" />
      </div>
    );
  }

  if (isError || !race) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-10 text-center flex flex-col items-center gap-3">
        <p className="text-sm text-ink-muted">Couldn't load this race.</p>
        <Button variant="secondary" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const dist = metersToDisplayDistance(race.target_meters, units);
  const distLabel = `${dist.value % 1 === 0 ? dist.value : dist.value.toFixed(1)} ${dist.unit}`;
  const inLobby = race.status === 'lobby';

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-4 flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-ink-muted">Race lobby</span>
        <h1 className="font-display text-3xl font-bold text-ink">{distLabel} race</h1>
        <p className="text-sm text-ink-muted">
          {isHost ? 'You host this race.' : 'Waiting for the host to start.'} Get ready when you
          are.
        </p>
      </header>

      <ParticipantList
        participants={participants}
        nameFor={nameFor}
        youId={youId}
        creatorId={race.creator_id}
      />

      {inLobby && isHost && (
        <InvitePicker
          raceId={id}
          existing={participants}
          onInvited={() => qc.invalidateQueries({ queryKey: raceKeys.detail(id) })}
        />
      )}

      {inLobby && (
        <div className="flex flex-col gap-3 sticky bottom-20 md:bottom-4">
          {me && (
            <Button
              variant={amReady ? 'secondary' : 'primary'}
              disabled={readyMut.isPending || amReady}
              onClick={() => readyMut.mutate()}
              className="w-full"
            >
              <Check size={16} strokeWidth={2.5} />
              {amReady ? "You're ready" : readyMut.isPending ? 'Setting…' : "I'm ready"}
            </Button>
          )}
          {isHost && (
            <div className="flex gap-3">
              <Button
                variant="secondary"
                disabled={cancelMut.isPending}
                onClick={() => cancelMut.mutate()}
                className="flex-1"
              >
                {cancelMut.isPending ? 'Cancelling…' : 'Cancel race'}
              </Button>
              <Button
                disabled={startMut.isPending}
                onClick={() => startMut.mutate()}
                className="flex-1"
              >
                {startMut.isPending ? 'Starting…' : 'Start race'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ParticipantList({
  participants,
  nameFor,
  youId,
  creatorId,
}: {
  participants: RaceParticipant[];
  nameFor: (id: string) => string;
  youId: string | null;
  creatorId: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs uppercase tracking-wide text-ink-muted">
        Runners <span className="text-ink-muted/60">· {participants.length}</span>
      </h2>
      <ul role="list" className="flex flex-col gap-2">
        {participants.map((p) => {
          const ready = p.state === 'ready';
          return (
            <li
              key={p.user_id}
              className="flex items-center gap-3 rounded-card border border-border bg-panel p-3"
            >
              <span
                aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-accent/10 font-display text-xs font-bold text-accent"
              >
                {nameFor(p.user_id).charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-ink">
                    {nameFor(p.user_id)}
                  </span>
                  {p.user_id === creatorId && (
                    <span className="rounded-pill bg-ink/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      Host
                    </span>
                  )}
                  {p.user_id === youId && (
                    <span className="rounded-pill bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                      You
                    </span>
                  )}
                </div>
                <span className="text-xs text-ink-muted">
                  {p.role === 'spectator' ? 'Spectator' : (READY_LABEL[p.state] ?? p.state)}
                </span>
              </div>
              {ready && (
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-pill bg-success/15 text-success">
                  <Check size={14} strokeWidth={3} />
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function InvitePicker({
  raceId,
  existing,
  onInvited,
}: {
  raceId: string;
  existing: RaceParticipant[];
  onInvited: () => void;
}) {
  const friends = useFriendsList();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const existingIds = useMemo(
    () => new Set(existing.map((p) => p.user_id)),
    [existing],
  );
  const eligible = useMemo(
    () => (friends.data?.accepted ?? []).filter((f) => !existingIds.has(f.other.id)),
    [friends.data, existingIds],
  );

  const inviteMut = useMutation({
    mutationFn: (userId: string) => invite(raceId, [userId]),
    onSuccess: (_r, userId) => {
      onInvited();
      const name =
        eligible.find((f) => f.other.id === userId)?.other.display_name ?? 'friend';
      toast.success(`Invited ${name}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not invite'),
    onSettled: () => setPendingId(null),
  });

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs uppercase tracking-wide text-ink-muted">Invite friends</h2>
      {friends.isLoading ? (
        <div className="space-y-2">
          <div className="h-12 animate-pulse rounded-card bg-ink/5" />
          <div className="h-12 animate-pulse rounded-card bg-ink/5" />
        </div>
      ) : friends.isError ? (
        <div className="flex items-center justify-between gap-2 rounded-card border border-border bg-panel p-3 text-xs text-ink-muted">
          <span>Couldn't load friends.</span>
          <button
            type="button"
            onClick={() => friends.refetch()}
            className="rounded-pill border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-ink/5"
          >
            Retry
          </button>
        </div>
      ) : eligible.length === 0 ? (
        <p className="text-xs leading-relaxed text-ink-muted">
          {(friends.data?.accepted ?? []).length === 0
            ? 'No friends yet — add some in your Profile, then invite them here.'
            : 'Everyone you can invite is already in this race.'}
        </p>
      ) : (
        <ul role="list" className="flex flex-col gap-2">
          {eligible.map((f) => {
            const inviting = pendingId === f.other.id;
            return (
              <li
                key={f.other.id}
                className="flex items-center gap-3 rounded-card border border-border bg-panel p-2.5"
              >
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-accent/10 text-lg"
                >
                  {f.other.avatar_emoji ?? f.other.display_name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">
                    {f.other.display_name}
                  </div>
                  <div className="truncate text-xs text-ink-muted">@{f.other.handle}</div>
                </div>
                <button
                  type="button"
                  disabled={inviting}
                  onClick={() => {
                    setPendingId(f.other.id);
                    inviteMut.mutate(f.other.id);
                  }}
                  className="inline-flex items-center gap-1 rounded-pill bg-accent px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-accent/20 disabled:opacity-60"
                >
                  <UserPlus size={11} strokeWidth={2.2} />
                  {inviting ? 'Inviting…' : 'Invite'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
