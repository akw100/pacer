import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Share, X } from 'lucide-react';
import { useInstallPrompt } from './useInstallPrompt';

// One-shot install nudge. Surfaces ~12 seconds after sign-in so we don't
// fight the onboarding for attention; a dismissal persists in localStorage
// so we never nag the same user twice on this device.

const DISMISS_KEY = 'pacer:install-dismissed-at';
const SHOW_DELAY_MS = 12_000;
const RENAG_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function InstallPrompt() {
  const { canPrompt, isStandalone, isIos, prompt } = useInstallPrompt();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isStandalone) return;
    const dismissedAt = readDismissed();
    if (dismissedAt && Date.now() - dismissedAt < RENAG_AFTER_MS) return;
    const t = window.setTimeout(() => setShow(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [isStandalone]);

  function dismiss() {
    writeDismissed(Date.now());
    setShow(false);
  }

  async function install() {
    const outcome = await prompt();
    if (outcome === 'accepted') setShow(false);
    else if (outcome === 'unavailable') {
      // Likely iOS — leave the panel open with manual instructions.
    }
  }

  if (!show || isStandalone) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ type: 'spring', stiffness: 240, damping: 28 }}
        role="dialog"
        aria-label="Install Pacer"
        className="fixed bottom-20 md:bottom-6 inset-x-0 mx-auto max-w-md px-4 z-30"
      >
        <div className="rounded-card border border-border bg-surface shadow-xl shadow-ink/10 p-4 flex items-start gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-full bg-accent/10 text-accent shrink-0">
            <Download size={16} strokeWidth={1.8} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-display text-sm font-semibold text-ink">
              Install Pacer
            </div>
            {isIos ? (
              <p className="text-xs text-ink-muted leading-relaxed mt-0.5 inline-flex items-center gap-1 flex-wrap">
                Tap <Share size={11} strokeWidth={1.8} className="inline" />{' '}
                <span className="font-medium">Share</span> in Safari → "Add to Home Screen".
              </p>
            ) : canPrompt ? (
              <p className="text-xs text-ink-muted leading-relaxed mt-0.5">
                One tap and Pacer lives in your dock — opens like a real app, works offline.
              </p>
            ) : (
              <p className="text-xs text-ink-muted leading-relaxed mt-0.5">
                Pacer can be installed from your browser's install icon for a real-app feel.
              </p>
            )}
            <div className="mt-2 flex items-center gap-2">
              {canPrompt && (
                <button
                  type="button"
                  onClick={install}
                  className="rounded-pill bg-accent text-white px-3 py-1.5 text-xs font-semibold"
                >
                  Install
                </button>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="rounded-pill text-xs text-ink-muted hover:text-ink px-2 py-1"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismiss}
            className="p-1.5 rounded-pill text-ink-muted hover:text-ink hover:bg-ink/5"
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function readDismissed(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function writeDismissed(ms: number): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DISMISS_KEY, String(ms));
}
