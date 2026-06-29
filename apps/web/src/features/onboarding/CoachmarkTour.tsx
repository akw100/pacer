import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check } from 'lucide-react';
import { COACHMARK_STEPS, type CoachmarkStep } from './coachmarks';
import { useOnboardingState, usePatchOnboarding } from './useOnboardingState';

// 3-tooltip tour shown once on first Home visit AFTER onboarding completion.
// Points at the existing FAB, score chip, and Group tab via DOM selectors —
// no anchor attribute changes required in other slices' files.
//
// We never show it twice (coachmarks_done_at flag), and we never block the
// app if anchors aren't on screen (an anchor miss skips that step).

interface BubblePos {
  top: number;
  left: number;
  placement: CoachmarkStep['placement'];
  rect: DOMRect;
}

function findAnchor(step: CoachmarkStep): HTMLElement | null {
  for (const sel of step.selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return null;
}

function placePopover(anchor: HTMLElement, placement: CoachmarkStep['placement']): BubblePos {
  const rect = anchor.getBoundingClientRect();
  const gap = 12;
  let top = 0;
  let left = 0;
  switch (placement) {
    case 'top':
      top = rect.top - gap;
      left = rect.left + rect.width / 2;
      break;
    case 'bottom':
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2;
      break;
    case 'left':
      top = rect.top + rect.height / 2;
      left = rect.left - gap;
      break;
    case 'right':
      top = rect.top + rect.height / 2;
      left = rect.right + gap;
      break;
  }
  return { top, left, placement, rect };
}

export function CoachmarkTour() {
  const onboarding = useOnboardingState();
  const patch = usePatchOnboarding();
  const state = onboarding.data;
  const isReady = !!state?.completed_at && !state?.coachmarks_done_at;

  const [idx, setIdx] = useState(0);
  const [pos, setPos] = useState<BubblePos | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  // Delay launch a beat so the Home shell finishes mounting.
  const [launched, setLaunched] = useState(false);
  useEffect(() => {
    if (!isReady) return;
    const t = window.setTimeout(() => setLaunched(true), 400);
    return () => window.clearTimeout(t);
  }, [isReady]);

  useLayoutEffect(() => {
    if (!launched) return;
    const step = COACHMARK_STEPS[idx];
    if (!step) return;

    function tryPlace() {
      const anchor = findAnchor(step!);
      if (!anchor) {
        // Anchor not on the current screen — skip ahead. If we run out,
        // mark the tour done so we don't loop forever.
        if (idx < COACHMARK_STEPS.length - 1) {
          setIdx((i) => i + 1);
        } else {
          void finish();
        }
        return;
      }
      anchor.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setPos(placePopover(anchor, step!.placement));
    }
    tryPlace();
    const onResize = () => tryPlace();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [idx, launched]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!launched) return;
      if (e.key === 'Escape') void finish();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') advance();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function advance() {
    if (idx < COACHMARK_STEPS.length - 1) setIdx((i) => i + 1);
    else void finish();
  }

  async function finish() {
    setLaunched(false);
    try {
      await patch.mutateAsync({ coachmarks_done_at: new Date().toISOString() });
    } catch {
      // Non-blocking — worst case it shows once more on the next visit.
    }
  }

  if (!isReady || !launched) return null;
  const step = COACHMARK_STEPS[idx];
  if (!step) return null;

  return (
    <AnimatePresence>
      {pos && (
        <div className="fixed inset-0 z-[70]">
          {/* Spotlight overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ink/40"
            onClick={advance}
          />
          {/* Highlight ring around the anchor */}
          <Highlight rect={pos.rect} />
          {/* Bubble */}
          <motion.div
            key={step.id}
            ref={bubbleRef}
            role="dialog"
            aria-label={step.title}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            style={bubbleStyle(pos)}
            className="absolute w-72 max-w-[88vw] rounded-card border border-border bg-surface p-4 shadow-xl shadow-ink/15"
          >
            <div className="text-xs uppercase tracking-wide text-accent font-semibold">
              {idx + 1} of {COACHMARK_STEPS.length}
            </div>
            <h3 className="mt-1 font-display text-lg font-semibold text-ink">{step.title}</h3>
            <p className="mt-1 text-sm text-ink-muted leading-relaxed">{step.body}</p>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={finish}
                className="rounded-pill text-xs text-ink-muted hover:text-ink px-2 py-1"
              >
                Skip tour
              </button>
              <button
                type="button"
                onClick={advance}
                autoFocus
                className="inline-flex items-center gap-1 rounded-pill bg-accent text-white px-3 py-1.5 text-xs font-semibold"
              >
                {idx < COACHMARK_STEPS.length - 1 ? 'Next' : 'Got it'}
                <Check size={12} strokeWidth={2.4} />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Highlight({ rect }: { rect: DOMRect }) {
  const pad = 6;
  const style: React.CSSProperties = {
    position: 'absolute',
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
    pointerEvents: 'none',
  };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={style}
      className="rounded-pill border-2 border-accent shadow-[0_0_0_9999px_rgba(31,39,51,0.40)]"
    />
  );
}

function bubbleStyle(pos: BubblePos): React.CSSProperties {
  // Translate from the anchor edge so the bubble sits *outside* the anchor.
  const base: React.CSSProperties = {
    top: pos.top,
    left: pos.left,
  };
  switch (pos.placement) {
    case 'top':
      base.transform = 'translate(-50%, -100%)';
      break;
    case 'bottom':
      base.transform = 'translate(-50%, 0)';
      break;
    case 'left':
      base.transform = 'translate(-100%, -50%)';
      break;
    case 'right':
      base.transform = 'translate(0, -50%)';
      break;
  }
  return base;
}
