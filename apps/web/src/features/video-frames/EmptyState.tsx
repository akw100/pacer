import { Clapperboard } from 'lucide-react';

// Teaching empty state (required by the Definition of Done) — shown before the
// user has created any routines.
export function EmptyState() {
  return (
    <div className="flex flex-col items-center rounded-card border border-border bg-panel px-6 py-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Clapperboard size={26} strokeWidth={1.8} />
      </div>
      <h2 className="font-display text-lg font-bold text-ink">Turn a workout video into steps</h2>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        Paste a YouTube workout or stretch video above. Pacer reads its sections, grabs the clearest
        frame of each move, and gives you a swipeable, fullscreen routine — so you can follow along
        without rewatching the whole thing.
      </p>
      <p className="mt-3 text-xs text-ink-muted">Works best with videos that have chapters.</p>
    </div>
  );
}
