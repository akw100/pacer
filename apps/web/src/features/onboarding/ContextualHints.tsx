import { AnimatePresence, motion } from 'motion/react';
import { Send, Sparkles, X } from 'lucide-react';
import type { HintId } from '@pacer/shared';
import { useContextualHint } from './useContextualHint';
import { useDismissHint } from './useOnboardingState';

// Hover overlay that surfaces ONE contextual hint at a time, dismissable
// with persistence — the dismissed list lives in onboarding_state.
//
// Renders fixed at the bottom of the viewport (above the bottom-tab bar on
// phone). Token-styled, no raw colors.

const COPY: Record<HintId, { icon: React.ReactNode; title: string; body: string }> = {
  'bot-photo': {
    icon: <Send size={14} strokeWidth={1.8} />,
    title: 'Snap-and-log',
    body:
      'Three runs in — nice. Did you know you can text the Pacer bot a photo of your watch and it logs the run for you?',
  },
  'first-challenge': {
    icon: <Sparkles size={14} strokeWidth={1.8} />,
    title: 'Challenge the group',
    body:
      'You\'re in a group — try a quick challenge. "Most km this week" lands well with families.',
  },
};

export function ContextualHints() {
  const hint = useContextualHint();
  const dismiss = useDismissHint();

  return (
    <AnimatePresence>
      {hint && (
        <motion.div
          key={hint}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 220, damping: 26 }}
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 inset-x-0 mx-auto max-w-md px-4 z-40 pointer-events-none"
        >
          <div className="pointer-events-auto rounded-card border border-border bg-surface shadow-xl shadow-ink/10 p-4 flex items-start gap-3">
            <span className="grid place-items-center w-8 h-8 rounded-pill bg-accent/10 text-accent shrink-0">
              {COPY[hint].icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-display text-sm font-semibold text-ink">
                {COPY[hint].title}
              </div>
              <p className="text-xs text-ink-muted leading-relaxed mt-0.5">{COPY[hint].body}</p>
            </div>
            <button
              type="button"
              aria-label="Dismiss hint"
              onClick={() => dismiss(hint)}
              className="p-1.5 rounded-pill text-ink-muted hover:text-ink hover:bg-ink/5"
            >
              <X size={14} strokeWidth={1.8} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
