import { Sparkles } from 'lucide-react';

// Teaching empty state for the Community card. Shown when the platform has
// no data yet OR the caller has no runs (so every percentile is null).
// Friendly, not preachy: tells the user *why* it's blank and the next step.

export function CommunityCardEmpty() {
  return (
    <section
      aria-labelledby="community-empty-heading"
      className="rounded-card border border-dashed border-border bg-surface p-6 shadow-sm flex flex-col gap-3 items-start"
    >
      <span className="grid place-items-center w-10 h-10 rounded-pill bg-accent/10 text-accent">
        <Sparkles size={18} strokeWidth={1.8} />
      </span>
      <h2
        id="community-empty-heading"
        className="font-display text-lg font-semibold text-ink"
      >
        Pacer's community stats light up as people log runs
      </h2>
      <p className="text-sm text-ink-muted leading-relaxed">
        Log your first run to see where you stand against the rest of the platform — totally
        anonymous, no names ever.
      </p>
    </section>
  );
}
