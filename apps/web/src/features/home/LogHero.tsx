import { Link } from 'react-router';
import { CheckCircle2, Dumbbell, Footprints, Sparkles, Trophy, Users } from 'lucide-react';
import { openLogSheet } from '../logging/LogSheet';
import { useHabits, useTodayChecks } from '../habits/useHabits';

// Prominent Home data-entry hero. This is the main action area on Home —
// not a footer of pills. Replaces the small QuickActions row.
//
// Every action is wired to the existing real flows — no duplicated forms,
// no fake writes. Run/Workout open the existing LogSheet; the Habits tile
// reads real counts from GET /habits + the own-rows `habit_checks` SELECT
// and scrolls to the existing HabitsSection (which holds the real toggle
// UI and the Add-habit form) — we never duplicate that surface here.
// The group CTA either jumps into the LogSheet with the active group
// preselected, or routes to /group to create/join one.

interface LogHeroProps {
  /** Display name of the user's "active" group (the one their pulse card uses). */
  activeGroupName: string | null;
}

// Scrolls to the existing HabitsSection on the same Home screen. The section
// uses `id="habits-heading"` on its <h2> (see HabitsSection.tsx) — that's the
// stable anchor we point at, so a future rename of the visible heading text
// won't break this link.
function scrollToHabits() {
  const el = document.getElementById('habits-heading');
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Briefly highlight the section so the user understands where they landed.
  el.closest('section')?.classList.add('ring-2', 'ring-accent/40');
  window.setTimeout(() => {
    el.closest('section')?.classList.remove('ring-2', 'ring-accent/40');
  }, 1400);
}

export function LogHero({ activeGroupName }: LogHeroProps) {
  // Real habit data — same source the HabitsSection itself uses.
  const habits = useHabits();
  const todayChecks = useTodayChecks();

  const totalHabits = habits.data?.length ?? 0;
  const checkedIds = new Set((todayChecks.data ?? []).map((c) => c.habit_id));
  const doneToday = (habits.data ?? []).filter((h) => checkedIds.has(h.id)).length;

  const habitTile = (() => {
    if (habits.isLoading || todayChecks.isLoading) {
      return { title: 'Daily habits', subtitle: 'Loading…', icon: <Sparkles size={22} strokeWidth={1.8} /> };
    }
    if (totalHabits === 0) {
      return {
        title: 'Add a habit',
        subtitle: 'Start your daily ritual',
        icon: <Sparkles size={22} strokeWidth={1.8} />,
      };
    }
    if (doneToday >= totalHabits) {
      return {
        title: 'All habits done',
        subtitle: `${doneToday} of ${totalHabits} · nice work`,
        icon: <CheckCircle2 size={22} strokeWidth={1.8} />,
      };
    }
    return {
      title: 'Check habits',
      subtitle: `${doneToday} of ${totalHabits} done today`,
      icon: <Sparkles size={22} strokeWidth={1.8} />,
    };
  })();

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
          A run, a workout, a habit — log it before it slips away.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
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
        <ActionTile
          onClick={scrollToHabits}
          icon={habitTile.icon}
          title={habitTile.title}
          subtitle={habitTile.subtitle}
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
