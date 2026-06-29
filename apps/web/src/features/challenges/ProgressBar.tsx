import { motion, useReducedMotion } from 'motion/react';

// A token-styled progress bar toward a challenge target. The fill animates with
// a spring so a fresh check-in / logged run visibly advances the bar — motion
// tied to meaning (progress), never ambient.

interface ProgressBarProps {
  fraction: number; // 0..1
  /** Coral by default; success green once the target is reached. */
  complete?: boolean;
  label?: string;
}

export function ProgressBar({ fraction, complete, label }: ProgressBarProps) {
  const pct = Math.round(fraction * 100);
  const reduced = useReducedMotion();
  return (
    <div className="flex flex-col gap-1">
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Challenge progress'}
        className="h-2.5 w-full overflow-hidden rounded-pill bg-ink/5"
      >
        <motion.div
          className={`h-full rounded-pill ${complete ? 'bg-success' : 'bg-accent'}`}
          initial={reduced ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
      {label && <span className="text-xs text-ink-muted">{label}</span>}
    </div>
  );
}
