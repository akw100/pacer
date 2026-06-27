import { useCallback, useEffect, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, Maximize, Minimize, X } from 'lucide-react';
import { formatDuration } from '@pacer/shared';
import { useVideoRoutine } from './useVideoRoutines';

// Full-page, fullscreen-able step-through of a routine — one section per slide.
// All slides mount at once (embla keeps them in the DOM), so every frame loads
// up front and stepping never waits on the network or a signed-URL refresh.

export function RoutineCarousel({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading } = useVideoRoutine(id);
  const containerRef = useRef<HTMLDivElement>(null);
  const [emblaRef, embla] = useEmblaCarousel({ loop: false });
  const [index, setIndex] = useState(0);
  const [isFull, setIsFull] = useState(false);

  const sections = data?.sections ?? [];

  useEffect(() => {
    if (!embla) return;
    const update = () => setIndex(embla.selectedScrollSnap());
    embla.on('select', update);
    update();
    return () => {
      embla.off('select', update);
    };
  }, [embla]);

  const next = useCallback(() => embla?.scrollNext(), [embla]);
  const prev = useCallback(() => embla?.scrollPrev(), [embla]);
  // Tapping the frame advances; wraps back to the first at the end so a tap
  // always does something (handy on touch / fullscreen).
  const advance = useCallback(() => {
    if (!embla) return;
    if (embla.selectedScrollSnap() >= sections.length - 1) embla.scrollTo(0);
    else embla.scrollNext();
  }, [embla, sections.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape' && !document.fullscreenElement) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onClose]);

  useEffect(() => {
    const onChange = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen();
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={data?.title ?? 'Workout routine'}
      className="fixed inset-0 z-[70] flex flex-col bg-ink text-white"
    >
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <span className="min-w-0 truncate font-display text-base font-semibold">
          {data?.title ?? 'Routine'}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFull ? 'Exit fullscreen' : 'Fullscreen'}
            title={isFull ? 'Exit fullscreen' : 'Fullscreen'}
            className="rounded-pill p-2 text-white/80 hover:bg-white/10 hover:text-white"
          >
            {isFull ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="rounded-pill p-2 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden">
        {isLoading ? (
          <Centered>Loading…</Centered>
        ) : sections.length === 0 ? (
          <Centered>No frames available for this routine.</Centered>
        ) : (
          <>
            <div ref={emblaRef} className="h-full overflow-hidden">
              <div className="flex h-full">
                {sections.map((s) => (
                  <div key={s.idx} className="flex-[0_0_100%] min-w-0 h-full flex flex-col">
                    <button
                      type="button"
                      onClick={advance}
                      aria-label="Next frame"
                      className="flex-1 flex items-center justify-center p-2"
                    >
                      <img
                        src={s.frame_url}
                        alt={s.move_label ?? s.title}
                        className="max-h-full max-w-full object-contain rounded-card"
                      />
                    </button>
                    <div className="px-5 pb-6 pt-2 text-center">
                      <p className="font-display text-xl font-bold">{s.move_label ?? s.title}</p>
                      <p className="text-sm text-white/60">
                        {s.move_label ? `${s.title} · ` : ''}
                        {formatDuration(s.start_sec)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Prev / Next */}
            <button
              type="button"
              onClick={prev}
              disabled={index === 0}
              aria-label="Previous"
              title="Previous"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-30"
            >
              <ChevronLeft size={28} />
            </button>
            <button
              type="button"
              onClick={next}
              disabled={index === sections.length - 1}
              aria-label="Next"
              title="Next"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-30"
            >
              <ChevronRight size={28} />
            </button>

            {/* Counter */}
            <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-pill bg-black/40 px-3 py-1 text-xs font-medium">
              {index + 1} / {sections.length}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center text-white/70">{children}</div>;
}
