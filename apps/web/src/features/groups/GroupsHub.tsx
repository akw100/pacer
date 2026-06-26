import { useState } from 'react';
import { LogIn, Plus } from 'lucide-react';
import type { Units } from '@pacer/shared';
import { GroupCard } from './GroupCard';
import { CreateGroupSheet } from './CreateGroupSheet';
import { JoinGroupSheet } from './JoinGroupSheet';
import { EmptyState } from './EmptyState';
import { useMyGroups } from './useGroups';

// Groups Hub — the entry view of /group. Lists every group the user belongs
// to as a card; clicking a card opens that group's Detail view via
// `onOpenGroup`. Create / Join are ALWAYS available — both in the empty
// state and as header actions when the user already has groups. The
// LogSheet / FAB is not touched here.

interface GroupsHubProps {
  youUserId: string | null;
  units: Units;
  onOpenGroup: (id: string) => void;
}

export function GroupsHub({ youUserId, units, onOpenGroup }: GroupsHubProps) {
  const my = useMyGroups();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const groups = my.data ?? [];

  if (my.isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
        <div className="h-6 w-40 rounded bg-ink/10 animate-pulse" />
        <div className="mt-6 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 rounded-card bg-ink/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state — but Create / Join are mounted INSIDE so the user can act
  // immediately. EmptyState is still used for its visual.
  if (groups.length === 0) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
        <Header />
        <div className="mt-4">
          <EmptyState
            onEnterCode={() => setJoinOpen(true)}
            onCreate={() => setCreateOpen(true)}
          />
        </div>
        <CreateGroupSheet
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={onOpenGroup}
        />
        <JoinGroupSheet
          open={joinOpen}
          onOpenChange={setJoinOpen}
          onJoined={onOpenGroup}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto flex flex-col gap-5">
      <Header />

      <section aria-label="Your groups" className="flex flex-col gap-3">
        {groups.map((g) => (
          <GroupCard
            key={g.id}
            group={g}
            youUserId={youUserId}
            units={units}
            onOpen={onOpenGroup}
          />
        ))}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setJoinOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-pill border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink hover:bg-ink/5 transition-colors"
        >
          <LogIn size={14} strokeWidth={2} />
          Enter code
        </button>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-pill bg-accent text-white px-4 py-3 text-sm font-semibold shadow-sm shadow-accent/20"
        >
          <Plus size={14} strokeWidth={2.2} />
          Create group
        </button>
      </div>

      <CreateGroupSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={onOpenGroup}
      />
      <JoinGroupSheet
        open={joinOpen}
        onOpenChange={setJoinOpen}
        onJoined={onOpenGroup}
      />
    </div>
  );
}

function Header() {
  return (
    <header>
      <h1 className="font-display text-2xl font-bold text-ink">Your groups</h1>
      <p className="text-sm text-ink-muted leading-relaxed mt-1">
        Each group has its own leaderboard. Your personal log stays personal — you choose which
        runs and workouts count for which group.
      </p>
    </header>
  );
}
