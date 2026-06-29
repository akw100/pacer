import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ChallengeWithProgress } from '@pacer/shared';
import { useAuth } from '../auth/AuthProvider';
import { useProfile } from '../auth/useProfile';
import { useChallenges, useChallengesRealtime } from './useChallenges';
import { ChallengeCard } from './ChallengeCard';
import { ChallengeDetail } from './ChallengeDetail';
import { CreateChallengeSheet, type ChallengePreset } from './CreateChallengeSheet';
import { InvitationCard } from './InvitationCard';
import { EmptyState } from './EmptyState';

// The Challenges tab. Three sections — Active / Upcoming / Finished — plus an
// invitations strip at the top, a create button, and a teaching empty state.
// The list is the single source: the detail panel reads the selected challenge
// straight from it (no second fetch), so realtime invalidation updates both.

export default function ChallengesPage() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const units = profile?.units ?? 'km';
  const youUserId = session?.user.id ?? null;

  const { data: challenges, isLoading } = useChallenges();
  useChallengesRealtime();

  const [createOpen, setCreateOpen] = useState(false);
  const [preset, setPreset] = useState<ChallengePreset | null>(null);
  const [selected, setSelected] = useState<ChallengeWithProgress | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  function openCreate(p: ChallengePreset | null) {
    setPreset(p);
    setCreateOpen(true);
  }

  // "Rematch" a finished challenge: reopen the create flow with its settings.
  function rematch(c: ChallengeWithProgress) {
    setSelected(null);
    openCreate({
      audience: c.audience,
      groupId: c.group_id,
      metric: c.metric,
      targetCanonical: c.target,
      description: c.description ?? undefined,
      youtubeUrl: c.youtube_url,
    });
  }

  // Keep the open detail panel in sync with refetched list data.
  const selectedLive = useMemo(
    () => (selected ? (challenges?.find((c) => c.id === selected.id) ?? selected) : null),
    [selected, challenges],
  );

  // "Mine" = challenges I created or am a participant in (excludes open ones I
  // haven't joined). Invitations are always surfaced regardless of the filter.
  const visible = useMemo(
    () => (challenges ?? []).filter((c) => filter === 'all' || c.my_status !== null),
    [challenges, filter],
  );

  const grouped = useMemo(() => {
    const invitations: ChallengeWithProgress[] = [];
    const active: ChallengeWithProgress[] = [];
    const upcoming: ChallengeWithProgress[] = [];
    const finished: ChallengeWithProgress[] = [];
    for (const c of visible) {
      if (c.my_status === 'invited') invitations.push(c);
      if (c.state === 'active') active.push(c);
      else if (c.state === 'upcoming') upcoming.push(c);
      else finished.push(c);
    }
    return { invitations, active, upcoming, finished };
  }, [visible]);

  const isEmpty = !isLoading && (challenges?.length ?? 0) === 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4 flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Challenges</h1>
        <button
          type="button"
          onClick={() => openCreate(null)}
          className="inline-flex items-center gap-1.5 rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white active:scale-[0.98] transition-transform"
        >
          <Plus size={16} strokeWidth={2.5} />
          New
        </button>
      </header>

      {!isEmpty && !isLoading && <FilterTabs filter={filter} onChange={setFilter} />}

      {isLoading && <Skeleton />}

      {isEmpty && <EmptyState onCreate={() => openCreate(null)} />}

      {grouped.invitations.length > 0 && (
        <section className="flex flex-col gap-2">
          {grouped.invitations.map((c) => (
            <InvitationCard key={c.id} challenge={c} units={units} />
          ))}
        </section>
      )}

      <Section title="Active" items={grouped.active} units={units} youUserId={youUserId} onOpen={setSelected} />
      <Section title="Upcoming" items={grouped.upcoming} units={units} youUserId={youUserId} onOpen={setSelected} />
      <Section title="Finished" items={grouped.finished} units={units} youUserId={youUserId} onOpen={setSelected} />

      {!isEmpty && !isLoading && visible.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-muted">
          You haven't joined any challenges yet. Switch to <span className="font-medium text-ink">All</span> to find open ones.
        </p>
      )}

      <CreateChallengeSheet open={createOpen} onOpenChange={setCreateOpen} units={units} preset={preset} />
      <ChallengeDetail
        challenge={selectedLive}
        units={units}
        youUserId={youUserId}
        onOpenChange={(open) => !open && setSelected(null)}
        onRematch={rematch}
      />
    </div>
  );
}

type Filter = 'all' | 'mine';

function FilterTabs({ filter, onChange }: { filter: Filter; onChange: (f: Filter) => void }) {
  const tabs: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'mine', label: 'Mine' },
  ];
  return (
    <div role="radiogroup" aria-label="Filter challenges" className="inline-flex rounded-pill border border-border bg-surface p-0.5 self-start">
      {tabs.map((t) => {
        const active = filter === t.id;
        return (
          <button
            key={t.id}
            role="radio"
            aria-checked={active}
            type="button"
            onClick={() => onChange(t.id)}
            className={`rounded-pill px-3 py-1 text-xs font-medium transition-colors ${
              active ? 'bg-ink text-surface' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function Section({
  title,
  items,
  units,
  youUserId,
  onOpen,
}: {
  title: string;
  items: ChallengeWithProgress[];
  units: 'km' | 'mi';
  youUserId: string | null;
  onOpen: (c: ChallengeWithProgress) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs uppercase tracking-wide text-ink-muted">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((c) => (
          <ChallengeCard key={c.id} challenge={c} units={units} youUserId={youUserId} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {[0, 1].map((i) => (
        <div key={i} className="h-40 rounded-card border border-border bg-ink/5 animate-pulse" />
      ))}
    </div>
  );
}
