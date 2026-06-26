import { Users } from 'lucide-react';

interface EmptyStateProps {
  onEnterCode: () => void;
  onCreate: () => void;
}

export function EmptyState({ onEnterCode, onCreate }: EmptyStateProps) {
  return (
    <div className="mx-auto w-full max-w-md text-center px-4 py-12 flex flex-col items-center gap-5">
      <span className="grid place-items-center w-16 h-16 rounded-full bg-accent/10 text-accent">
        <Users size={28} strokeWidth={1.8} />
      </span>
      <div>
        <h2 className="font-display text-2xl font-bold text-ink">No group yet</h2>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed">
          Pacer is more fun with people who push you. Join your family's group with an invite
          code, or start one and share the code.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 w-full">
        <button
          type="button"
          onClick={onEnterCode}
          className="flex-1 rounded-pill border border-border bg-surface px-5 py-3 text-sm font-semibold text-ink hover:bg-ink/5 active:scale-[0.98] transition-transform"
        >
          Enter code
        </button>
        <button
          type="button"
          onClick={onCreate}
          className="flex-1 rounded-pill bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-accent/20 active:scale-[0.98] transition-transform"
        >
          Create group
        </button>
      </div>
    </div>
  );
}
