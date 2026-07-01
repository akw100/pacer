import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import type { GeoSample } from './useGeoDistance';
import type { RaceParticipant } from '@pacer/shared';
import {
  formatDuration,
  formatPace,
  paceSecondsPerUnit,
  rankFinishers,
  splitsFromSamples,
} from '@pacer/shared';
import { Button } from '../../components/Button';
import { Loader } from '../../components/Loader';
import { useProfile } from '../auth/useProfile';
import { getRace, raceKeys, rematch } from './api';
import { useRaceNames } from './useRaceNames';

// The result screen (`/races/:id/result`). Builds the podium from rankFinishers
// over the participants (finishers first, by finish time; DNFs last), shows each
// runner's elapsed time + pace and a DNF/manual label, and fires a confetti
// burst for the winner on mount.
//
// Splits: the server does NOT persist GPS samples (positions are ephemeral
// browser broadcasts). The run screen hands the caller's retained samples here
// via router navigation state; if present we render the caller's per-km splits,
// otherwise we omit the section. Splits are therefore the CALLER's own only,
// and only on the same-session navigation from the run screen.

const MEDALS = ['🥇', '🥈', '🥉'] as const;

interface ResultNavState {
  samples?: GeoSample[];
}

export default function ResultScreen() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useProfile();
  const units = profile?.units ?? 'km';
  const { nameFor, youId } = useRaceNames();

  const navState = (location.state ?? null) as ResultNavState | null;
  const samples = navState?.samples;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: raceKeys.detail(id),
    queryFn: () => getRace(id),
    enabled: !!id,
  });
  const race = data?.race;
  const participants = useMemo(() => data?.participants ?? [], [data]);

  // Podium order via the shared ranker (finishers by time, DNFs last).
  const ranked = useMemo(
    () =>
      rankFinishers(
        participants
          .filter((p) => p.role === 'runner')
          .map((p) => ({
            userId: p.user_id,
            state: p.state === 'finished' ? ('finished' as const) : ('dnf' as const),
            finishedAt: p.finished_at,
          })),
      ),
    [participants],
  );

  const partById = useMemo(() => {
    const m = new Map<string, RaceParticipant>();
    for (const p of participants) m.set(p.user_id, p);
    return m;
  }, [participants]);

  const winnerId = race?.winner_id ?? null;
  const youWon = !!winnerId && winnerId === youId;

  // Winner confetti, once on mount when the winner is known. Celebration stays
  // rare (a race result) per the tech-stack guidance for confetti.
  const burst = useRef(false);
  useEffect(() => {
    if (burst.current || !winnerId) return;
    burst.current = true;
    confetti({ particleCount: 140, spread: 70, origin: { y: 0.6 } });
  }, [winnerId]);

  // Per-km splits for the caller, derived from the retained run samples.
  const splits = useMemo(() => {
    if (!samples || samples.length < 2 || !race) return [];
    return splitsFromSamples(samples, race.target_meters);
  }, [samples, race]);

  const rematchMut = useMutation({
    mutationFn: () => rematch(id),
    onSuccess: (newRace) => navigate(`/races/${newRace.id}/lobby`),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not start a rematch'),
  });

  async function share() {
    if (!race) return;
    const dist = race.target_meters / (units === 'mi' ? 1609.344 : 1000);
    const distLabel = `${dist % 1 === 0 ? dist : dist.toFixed(1)} ${units}`;
    const winnerName = winnerId ? nameFor(winnerId) : null;
    const text = winnerName
      ? `${winnerName} won our ${distLabel} Pacer race! 🏁`
      : `We just finished a ${distLabel} Pacer race! 🏁`;
    const url = `${window.location.origin}/races/${id}/result`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Pacer race', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast.success('Result copied — share it with your group');
    } catch {
      // User-cancelled share or denied clipboard — nothing to do.
    }
  }

  if (isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader label="Loading result" />
      </div>
    );
  }
  if (isError || !race) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-10 text-center flex flex-col items-center gap-3">
        <p className="text-sm text-ink-muted">Couldn't load this result.</p>
        <Button variant="secondary" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-4 flex flex-col gap-6">
      <header className="flex flex-col items-center gap-1 text-center">
        <span className="text-xs uppercase tracking-wide text-ink-muted">Race finished</span>
        <h1 className="font-display text-3xl font-bold text-ink">
          {youWon ? 'You won! 🎉' : winnerId ? `${nameFor(winnerId)} wins` : 'Results'}
        </h1>
      </header>

      <section className="flex flex-col gap-2">
        {ranked.map((row, i) => {
          const p = partById.get(row.userId);
          const isFinished = row.state === 'finished';
          const elapsed = p?.elapsed_seconds ?? null;
          const pace =
            isFinished && elapsed && elapsed > 0
              ? formatPace(paceSecondsPerUnit(race.target_meters, elapsed, units))
              : null;
          const isWinner = row.userId === winnerId;
          return (
            <div
              key={row.userId}
              className={`flex items-center gap-3 rounded-card border p-3 ${
                isWinner ? 'border-accent/40 bg-accent/5' : 'border-border bg-panel'
              }`}
            >
              <span className="w-7 shrink-0 text-center text-xl">
                {isFinished && i < MEDALS.length ? MEDALS[i] : ''}
                {!isFinished && '🚫'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-ink">
                    {nameFor(row.userId)}
                  </span>
                  {p?.manual_finish && isFinished && (
                    <span className="rounded-pill bg-ink/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      Manual
                    </span>
                  )}
                  {!isFinished && (
                    <span className="rounded-pill bg-ink/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      DNF
                    </span>
                  )}
                </div>
                <span className="text-xs text-ink-muted tabular-nums">
                  {isFinished && elapsed != null
                    ? `${formatDuration(elapsed)}${pace ? ` · ${pace}/${units}` : ''}`
                    : 'Did not finish'}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {splits.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs uppercase tracking-wide text-ink-muted">Your splits</h2>
          <div className="flex flex-col gap-1.5 rounded-card border border-border bg-panel p-3">
            {splits.map((sec, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm tabular-nums"
              >
                <span className="text-ink-muted">km {i + 1}</span>
                <span className="font-semibold text-ink">{formatDuration(sec)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-3 sticky bottom-20 md:bottom-4">
        <div className="flex gap-3">
          <Button variant="secondary" onClick={share} className="flex-1">
            <Share2 size={16} strokeWidth={2} />
            Share
          </Button>
          <Button
            onClick={() => rematchMut.mutate()}
            disabled={rematchMut.isPending}
            className="flex-1"
          >
            {rematchMut.isPending ? 'Setting up…' : 'Rematch'}
          </Button>
        </div>
      </div>
    </div>
  );
}
