import { Link } from 'react-router';
import { Dumbbell, Footprints, Trophy, Users } from 'lucide-react';
import { openLogSheet } from '../logging/LogSheet';

// Prominent Home data-entry hero. This is the main action area on Home —
// not a footer of pills. Replaces the small QuickActions row.
//
// Every action is wired to the existing real flows — no duplicated forms,
// no fake writes. Run/Workout open the existing LogSheet; the group CTA
// either jumps into the LogSheet with the active group preselected (via
// the existing `openLogSheet({ groupId })` API), or routes to /group for
// the user to create/join one first.

interface LogHeroProps {
  /** Display name of the user's "active" group (the one their pulse card uses). */
  activeGroupName: string | null;
}

export function LogHero({ activeGroupName }: LogHeroProps) {
  return (
    <section
      aria-labelledby="log-hero-heading"
      className="rounded-card border border-border bg-surface p-5 md:p-6 shadow-sm flex flex-col gap-4 relative overflow-hidden"
    >
      <div className="flex flex-col gap-1">
        <h2 id="log-hero-heading" className="font-display text-xl md:text-2xl font-bold text-ink">
          What did you do today?
        </h2>
        <p className="text-sm text-ink-muted">
          A run, a workout — log it before it slips away.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ActionTile
          onClick={() => openLogSheet({ tab: 'run' })}
          icon={<Footprints size={22} strokeWidth={1.8} />}
          title="Log run"
          subtitle="Distance · time · effort"
          primary
        />
        <ActionTile
          onClick={() => openLogSheet({ tab: 'workout' })}
          icon={<Dumbbell size={22} strokeWidth={1.8} />}
          title="Log workout"
          subtitle="Sets · reps · weight"
        />
      </div>

      {activeGroupName ? (
        <button
          type="button"
          onClick={() => openLogSheet({ tab: 'run' })}
          className="inline-flex items-center justify-center gap-2 rounded-pill border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm font-medium text-accent hover:bg-accent/10 transition-colors"
        >
          <Trophy size={14} strokeWidth={2} />
          Counts for <span className="font-semibold">{activeGroupName}</span> if you tag it
        </button>
      ) : (
        <Link
          to="/group"
          className="inline-flex items-center justify-center gap-2 rounded-pill border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-ink/5 transition-colors"
        >
          <Users size={14} strokeWidth={2} />
          Create or join a group to compete
        </Link>
      )}
    </section>
  );
}

interface ActionTileProps {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  primary?: boolean;
}

function ActionTile({ onClick, icon, title, subtitle, primary }: ActionTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-card border p-4 text-left flex items-center gap-3 transition-all active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-accent/40 ${
        primary
          ? 'bg-accent text-white border-accent hover:bg-accent/95 shadow-sm shadow-accent/20'
          : 'bg-surface text-ink border-border hover:bg-ink/5'
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid place-items-center w-12 h-12 rounded-pill shrink-0 ${
          primary ? 'bg-white/15 text-white' : 'bg-accent/10 text-accent'
        }`}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-display text-base font-semibold leading-tight">{title}</span>
        <span
          className={`block text-xs leading-snug mt-0.5 ${
            primary ? 'text-white/80' : 'text-ink-muted'
          }`}
        >
          {subtitle}
        </span>
      </span>
    </button>
  );
}
