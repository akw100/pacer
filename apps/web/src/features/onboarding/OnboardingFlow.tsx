import { useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useProfile } from '../auth/useProfile';
import { StepGroup } from './steps/StepGroup';
import { StepTelegram } from './steps/StepTelegram';
import { StepHabits } from './steps/StepHabits';
import { useOnboardingState, usePatchOnboarding } from './useOnboardingState';

// Onboarding overlay shown after the user has a handle (Auth slice handles
// step 1 — claiming the handle — via /onboarding/handle). This carousel
// covers steps 2-4: Join/create a group, learn about Telegram, pick habits.
//
// Display: phone — full-screen sheet; desktop — centered modal capped at
// ~480px. The overlay is fail-open: if /onboarding/state errors, we don't
// render the carousel so the rest of the app is reachable.
//
// Completion: PATCH /onboarding/state { completed_at | skipped_at } the
// moment the user finishes / skips. We then mark the coachmark tour for
// launch by clearing `coachmarks_done_at` only on first complete (not on
// skip — a user who skips probably doesn't want a tour either).

const STEP_TITLES = ['Group', 'Telegram', 'Habits'] as const;

export function OnboardingFlow() {
  const { status } = useProfile();
  const onboarding = useOnboardingState();
  const patch = usePatchOnboarding();

  const handleClaimed = status === 'ready';
  const state = onboarding.data;
  const dismissed = !!state?.completed_at || !!state?.skipped_at;

  const shouldShow = handleClaimed && !!state && !dismissed;

  const [emblaRef, embla] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    duration: 18,
  });
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!embla) return;
    const update = () => setStep(embla.selectedScrollSnap());
    embla.on('select', update);
    update();
    return () => {
      embla.off('select', update);
    };
  }, [embla]);

  if (!shouldShow) return null;

  async function complete() {
    await patch.mutateAsync({ completed_at: new Date().toISOString() });
  }

  async function skip() {
    await patch.mutateAsync({ skipped_at: new Date().toISOString() });
  }

  function next() {
    embla?.scrollNext();
  }

  function back() {
    embla?.scrollPrev();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-ink/40 p-0 md:p-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 28 }}
        className="relative w-full md:max-w-[28rem] max-h-[92vh] flex flex-col rounded-t-card md:rounded-card border border-border bg-surface shadow-xl shadow-ink/10 overflow-hidden"
      >
        <header className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-1.5">
            {step > 0 && (
              <button
                type="button"
                onClick={back}
                aria-label="Back"
                className="inline-flex items-center -ml-1.5 mr-1 rounded-pill text-ink-muted hover:text-ink hover:bg-ink/5 p-1"
              >
                <ChevronLeft size={16} strokeWidth={2} />
              </button>
            )}
            {STEP_TITLES.map((_, i) => (
              <span
                key={i}
                aria-label={`Step ${i + 1} of ${STEP_TITLES.length}: ${STEP_TITLES[i]}`}
                className={`h-1.5 rounded-pill transition-all ${
                  i === step ? 'w-6 bg-accent' : 'w-1.5 bg-border'
                }`}
              />
            ))}
            <span id="onboarding-title" className="sr-only">
              Welcome to Pacer — set up your home base
            </span>
          </div>
          <button
            type="button"
            onClick={skip}
            aria-label="Skip onboarding"
            className="inline-flex items-center gap-1 rounded-pill text-xs font-medium text-ink-muted hover:text-ink hover:bg-ink/5 px-2 py-1"
          >
            Skip
            <X size={12} strokeWidth={2} />
          </button>
        </header>

        <div ref={emblaRef} className="overflow-hidden flex-1">
          <div className="flex">
            <Slide>
              <StepGroup onComplete={next} onSkip={next} />
            </Slide>
            <Slide>
              <StepTelegram onContinue={next} onSkip={next} />
            </Slide>
            <Slide>
              <StepHabits onFinish={complete} />
            </Slide>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Slide({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-[0_0_100%] min-w-0 px-5 py-4 overflow-y-auto">{children}</div>
  );
}
