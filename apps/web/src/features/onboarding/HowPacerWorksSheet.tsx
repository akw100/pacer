import { useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import { Footprints, HelpCircle, Trophy, Users, X } from 'lucide-react';

// "?" button + the sheet behind it. Mounted at the app shell level. Opens a
// short 3-beat explainer: log → score → compete. vaul on phone, centered
// dialog on desktop (the same Drawer primitive — its width caps under md:).
//
// We expose the trigger as a fixed pill in the top-right so it never has to
// touch the shell's header file. Returning users who already saw the
// onboarding can still re-open it any time.

const OPEN_EVENT = 'pacer:open-how-it-works';

export function openHowPacerWorks(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function HowPacerWorksSheet() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="How Pacer works"
        className="fixed top-3 right-3 z-30 grid place-items-center w-9 h-9 rounded-full border border-border bg-surface text-ink-muted hover:text-ink shadow-sm"
      >
        <HelpCircle size={16} strokeWidth={1.8} />
      </button>

      <Drawer.Root open={open} onOpenChange={setOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40" />
          <Drawer.Content
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col rounded-t-card border border-border bg-surface md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:w-[26rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-card"
          >
            <Drawer.Title className="sr-only">How Pacer works</Drawer.Title>
            <div className="mx-auto my-2 h-1.5 w-10 rounded-pill bg-border md:hidden" />
            <header className="flex items-center justify-between px-5 pt-2 pb-3">
              <h2 className="font-display text-lg font-semibold text-ink">How Pacer works</h2>
              <button
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-pill text-ink-muted hover:text-ink hover:bg-ink/5"
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </header>
            <div className="px-5 pb-6 flex flex-col gap-4">
              <Beat
                icon={<Footprints size={20} strokeWidth={1.8} />}
                title="1. Log"
                body="Tap the + button to log a run, workout, or habit. Texting the Telegram bot works too."
              />
              <Beat
                icon={<Trophy size={20} strokeWidth={1.8} />}
                title="2. Score"
                body="Every activity earns points. Your weekly score is what your group sees."
              />
              <Beat
                icon={<Users size={20} strokeWidth={1.8} />}
                title="3. Compete"
                body="Tag any activity to a group to count it on the leaderboard — your personal log stays personal."
              />
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}

function Beat({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-border bg-surface p-4">
      <span className="grid place-items-center w-10 h-10 rounded-full bg-accent/10 text-accent shrink-0">
        {icon}
      </span>
      <div>
        <div className="font-display text-base font-semibold text-ink">{title}</div>
        <p className="text-sm text-ink-muted leading-relaxed mt-0.5">{body}</p>
      </div>
    </div>
  );
}
