import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Flag } from 'lucide-react';
import { toast } from 'sonner';
import type { Race } from '@pacer/shared';
import { displayDistanceToMeters, metersToDisplayDistance } from '@pacer/shared';
import { Button } from '../../components/Button';
import { Loader } from '../../components/Loader';
import { useProfile } from '../auth/useProfile';
import { createRace, listRaces, raceKeys } from './api';

// The Races tab (`/races`): the create entry (distance presets + custom) plus a
// list of the caller's races. Creating routes straight to the new lobby; lobby
// rows route to the lobby, active rows to the run screen, finished to the result.

const PRESETS_KM = [1, 3, 5, 10] as const;

export default function RacesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile } = useProfile();
  const units = profile?.units ?? 'km';

  const { data: races, isLoading, isError, refetch } = useQuery({
    queryKey: raceKeys.all,
    queryFn: listRaces,
  });

  const [custom, setCustom] = useState('');

  const createMut = useMutation({
    mutationFn: (targetMeters: number) => createRace(targetMeters),
    onSuccess: (race) => {
      qc.invalidateQueries({ queryKey: raceKeys.all });
      navigate(`/races/${race.id}/lobby`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not create race'),
  });

  function createPreset(km: number) {
    createMut.mutate(displayDistanceToMeters(km, 'km'));
  }
  function createCustom() {
    const value = Number(custom);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a distance greater than zero');
      return;
    }
    createMut.mutate(Math.round(displayDistanceToMeters(value, units)));
  }

  function openRace(race: Race) {
    if (race.status === 'lobby') navigate(`/races/${race.id}/lobby`);
    else if (race.status === 'active') navigate(`/races/${race.id}`);
    else if (race.status === 'finished') navigate(`/races/${race.id}/result`);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4 flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-ink">Races</h1>
        <p className="text-sm text-ink-muted">
          Pick a distance and race a friend in real time.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-card border border-border bg-panel p-4">
        <h2 className="text-xs uppercase tracking-wide text-ink-muted">New race</h2>
        <div className="flex flex-wrap gap-2">
          {PRESETS_KM.map((km) => (
            <button
              key={km}
              type="button"
              disabled={createMut.isPending}
              onClick={() => createPreset(km)}
              className="rounded-pill border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-ink/5 disabled:opacity-50"
            >
              {km} km
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder={`Custom (${units})`}
              className="w-full rounded-pill border border-border bg-surface px-4 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          </div>
          <Button
            onClick={createCustom}
            disabled={createMut.isPending || custom.trim() === ''}
          >
            {createMut.isPending ? 'Creating…' : 'Create'}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs uppercase tracking-wide text-ink-muted">Your races</h2>
        {isLoading ? (
          <div className="grid place-items-center py-8">
            <Loader label="Loading races" />
          </div>
        ) : isError ? (
          <div className="flex items-center justify-between gap-2 rounded-card border border-border bg-panel p-3 text-xs text-ink-muted">
            <span>Couldn't load races.</span>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-pill border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-ink/5"
            >
              Retry
            </button>
          </div>
        ) : (races?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">
            No races yet. Pick a distance above to start one.
          </p>
        ) : (
          <ul role="list" className="flex flex-col gap-2">
            {races!.map((race) => (
              <li key={race.id}>
                <button
                  type="button"
                  onClick={() => openRace(race)}
                  className="flex w-full items-center gap-3 rounded-card border border-border bg-panel p-3 text-left transition-colors hover:bg-ink/5"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-accent/10 text-accent">
                    <Flag size={16} strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink">
                      {distanceLabel(race.target_meters, units)} race
                    </div>
                    <div className="text-xs text-ink-muted capitalize">{race.status}</div>
                  </div>
                  <ChevronRight size={18} strokeWidth={1.8} className="shrink-0 text-ink-muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function distanceLabel(meters: number, units: 'km' | 'mi'): string {
  const d = metersToDisplayDistance(meters, units);
  return `${d.value % 1 === 0 ? d.value : d.value.toFixed(1)} ${d.unit}`;
}
