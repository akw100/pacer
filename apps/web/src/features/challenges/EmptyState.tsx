import { Trophy } from 'lucide-react';

// Teaching empty state for the Challenges tab — it sells the feature when no
// challenge exists yet (spec §02-PAGES: "Challenge your group to anything").

export function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mx-auto w-full max-w-md text-center px-4 py-12 flex flex-col items-center gap-5">
      <span className="grid place-items-center w-16 h-16 rounded-full bg-accent/10 text-accent">
        <Trophy size={28} strokeWidth={1.8} />
      </span>
      <div>
        <h2 className="font-display text-2xl font-bold text-ink">No challenges yet</h2>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed">
          Challenge your group to anything — most km this week, a 7-day stretch streak, or “do this
          10-minute video 3×”. Pick a metric, set a target, and watch the leaderboard fill in.
        </p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="rounded-pill bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-accent/20 active:scale-[0.98] transition-transform"
      >
        Create a challenge
      </button>
    </div>
  );
}
