import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { GeoSample } from './useGeoDistance';
import { metersToDisplayDistance } from '@pacer/shared';
import { Button } from '../../components/Button';
import { CircularProgress } from '../../components/CircularProgress';
import { Loader } from '../../components/Loader';
import { useProfile } from '../auth/useProfile';
import { abandon, finishRace, getRace, raceKeys } from './api';
import { useGeoDistance } from './useGeoDistance';
import { useRaceChannel } from './useRaceChannel';
import { useRaceNames } from './useRaceNames';
import { RaceLeaderboard } from './RaceLeaderboard';

// The live run screen (`/races/:id`). Flow:
//   1. Read the race; subscribe to its realtime channel for live positions.
//   2. Derive a 3-2-1 countdown from `start_at`; `running` flips true at zero.
//   3. While running, accumulate GPS distance (useGeoDistance) and broadcast it.
//   4. Drive the distance ring + leaderboard from the merged live meters.
//   5. Auto-finish once at/over target (guarded by a ref). If GPS is denied or
//      unsupported, show a manual "I finished" fallback.
//   6. When the race becomes finished (winner decided), route to the result,
//      handing the retained GPS samples through router state for splits.

const REACTIONS = ['👏', '🔥', '💪'] as const;

export default function RaceScreen() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile } = useProfile();
  const units = profile?.units ?? 'km';
  const { nameFor, youId } = useRaceNames();

  const { positions, lastReaction, broadcastPosition, broadcastReaction } = useRaceChannel(id);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: raceKeys.detail(id),
    queryFn: () => getRace(id),
    enabled: !!id,
  });
  const race = data?.race;
  const target = race?.target_meters ?? 0;

  // Countdown derived from start_at. `running` is true once we're past it.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const startMs = race?.start_at ? new Date(race.start_at).getTime() : null;
  const secondsLeft = startMs != null ? Math.ceil((startMs - now) / 1000) : null;
  const running = race?.status === 'active' && startMs != null && now >= startMs;

  const geo = useGeoDistance(running);
  const meters = geo.meters;
  const elapsedSeconds = running && startMs != null ? Math.max(0, (now - startMs) / 1000) : 0;

  // Broadcast my live position while running (the hook throttles internally).
  useEffect(() => {
    if (running) broadcastPosition(meters);
  }, [running, meters, broadcastPosition]);

  // Retain the GPS trail across the run so the result screen can compute splits.
  const samplesRef = useRef<GeoSample[]>([]);
  useEffect(() => {
    if (geo.samples.length) samplesRef.current = geo.samples;
  }, [geo.samples]);

  // Auto-finish once when GPS distance reaches the target.
  const finishedRef = useRef(false);
  const noGps = geo.denied || !geo.supported;
  useEffect(() => {
    if (!running || finishedRef.current || noGps) return;
    if (meters >= target && target > 0) {
      finishedRef.current = true;
      finishRace(id, meters, false).catch((e) =>
        toast.error(e instanceof Error ? e.message : 'Could not record finish'),
      );
    }
  }, [running, meters, target, id, noGps]);

  // When the server marks the race finished (winner decided), go to the result,
  // carrying the retained samples for per-km splits.
  useEffect(() => {
    if (race?.status === 'finished') {
      navigate(`/races/${id}/result`, {
        replace: true,
        state: { samples: samplesRef.current },
      });
    }
    if (race?.status === 'cancelled') {
      toast('This race was cancelled');
      navigate('/races', { replace: true });
    }
  }, [race?.status, id, navigate]);

  // Transient cheer when a reaction lands.
  const [cheer, setCheer] = useState<string | null>(null);
  useEffect(() => {
    if (!lastReaction) return;
    setCheer(lastReaction.emoji);
    const t = setTimeout(() => setCheer(null), 1500);
    return () => clearTimeout(t);
  }, [lastReaction]);

  function manualFinish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    finishRace(id, target, true).catch((e) => {
      finishedRef.current = false;
      toast.error(e instanceof Error ? e.message : 'Could not finish');
    });
  }

  function doAbandon() {
    abandon(id)
      .then(() => navigate('/races', { replace: true }))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not abandon'));
  }

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

  // Pre-start countdown overlay.
  if (race.status === 'active' && secondsLeft != null && secondsLeft > 0) {
    return (
      <div className="grid min-h-[70vh] place-items-center px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="text-sm uppercase tracking-wide text-ink-muted">Get ready</span>
          <span className="font-display text-8xl font-bold text-accent tabular-nums">
            {secondsLeft}
          </span>
          <span className="text-sm text-ink-muted">The race is about to start…</span>
        </div>
      </div>
    );
  }

  const dist = metersToDisplayDistance(meters, units);
  const targetDist = metersToDisplayDistance(target, units);

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-4 flex flex-col gap-5">
      <header className="flex flex-col items-center gap-1 text-center">
        <span className="text-xs uppercase tracking-wide text-ink-muted">Race in progress</span>
        {cheer && (
          <span className="animate-pulse text-3xl" aria-live="polite">
            {cheer}
          </span>
        )}
      </header>

      <div className="flex flex-col items-center gap-3">
        <CircularProgress
          value={meters}
          max={target}
          size="min(70vw, 16rem)"
          label={
            <span className="flex flex-col items-center leading-tight">
              <span className="font-display text-3xl font-bold text-ink tabular-nums">
                {dist.value.toFixed(2)}
              </span>
              <span className="text-xs text-ink-muted">
                / {targetDist.value % 1 === 0 ? targetDist.value : targetDist.value.toFixed(1)}{' '}
                {targetDist.unit}
              </span>
            </span>
          }
        />
        {noGps && (
          <p className="max-w-xs text-center text-xs text-ink-muted">
            Location is unavailable, so distance can't be tracked automatically. Tap the button
            below when you finish.
          </p>
        )}
      </div>

      <RaceLeaderboard
        positions={positions}
        youId={youId}
        youMeters={meters}
        targetMeters={target}
        elapsedSeconds={elapsedSeconds}
        nameFor={nameFor}
        units={units}
      />

      <section className="flex items-center justify-center gap-3">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => broadcastReaction(emoji)}
            className="grid h-12 w-12 place-items-center rounded-pill border border-border bg-panel text-2xl transition-transform active:scale-90"
            aria-label={`Send ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </section>

      <div className="flex flex-col gap-3 sticky bottom-20 md:bottom-4">
        {noGps && (
          <Button onClick={manualFinish} className="w-full">
            🏁 I finished
          </Button>
        )}
        <Button variant="secondary" onClick={doAbandon} className="w-full">
          Abandon race
        </Button>
      </div>
    </div>
  );
}
