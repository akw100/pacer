import { useCallback, useEffect, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, Maximize, Minimize, X } from 'lucide-react';
import { formatDuration } from '@pacer/shared';
import { CircularProgress } from '../../components/CircularProgress';
import { Loader } from '../../components/Loader';
import { Tooltip } from '../../components/Tooltip';
import { useVideoRoutine } from './useVideoRoutines';

// Full-page, fullscreen-able step-through of a routine — one section per slide.
// The frame fills the whole screen (object-cover, edge to edge); controls and the
// caption sit on top as gradient overlays. All slides mount at once (embla keeps
// them in the DOM), so every frame loads up front and stepping never waits.

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
      className="fixed inset-0 z-[70] bg-ink text-white"
    >
      {isLoading ? (
        <Centered><Loader /></Centered>
      ) : sections.length === 0 ? (
        <Centered>No frames available for this routine.</Centered>
      ) : (
        <>
          <div ref={emblaRef} className="h-full overflow-hidden">
            <div className="flex h-full">
              {sections.map((s, i) => (
                <div key={s.idx} className="relative flex-[0_0_100%] min-w-0 h-full">
                  <button
                    type="button"
                    onClick={advance}
                    aria-label="Next frame"
                    className="block h-full w-full"
                  >
                    <img
                      src={s.frame_url}
                      alt={s.move_label ?? s.title}
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 via-ink/40 to-transparent px-5 pb-8 pt-16 text-center">
                    <p className="font-display text-xl font-bold">{s.move_label ?? s.title}</p>
                    <p className="text-sm text-white/70">
                      {s.move_label ? `${s.title} · ` : ''}
                      {formatDuration(s.start_sec)} · {i + 1}/{sections.length}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top bar (overlaid) */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-ink/70 to-transparent px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <CircularProgress
                value={index + 1}
                max={sections.length}
                size={34}
                trackColor="rgba(255, 255, 255, 0.25)"
              />
              <span className="min-w-0 truncate font-display text-base font-semibold">
                {data?.title ?? 'Routine'}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Tooltip label={isFull ? 'Exit fullscreen' : 'Fullscreen'} side="bottom">
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label={isFull ? 'Exit fullscreen' : 'Fullscreen'}
                  className="rounded-pill p-2 text-white/80 hover:bg-white/10 hover:text-white"
                >
                  {isFull ? <Minimize size={20} /> : <Maximize size={20} />}
                </button>
              </Tooltip>
              <Tooltip label="Close" side="bottom">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded-pill p-2 text-white/80 hover:bg-white/10 hover:text-white"
                >
                  <X size={20} />
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Prev / Next — wrapper div carries the absolute placement so the
              Tooltip's own relative anchor isn't overridden. */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2">
            <Tooltip label="Previous">
              <button
                type="button"
                onClick={prev}
                disabled={index === 0}
                aria-label="Previous"
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-30"
              >
                <ChevronLeft size={28} />
              </button>
            </Tooltip>
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Tooltip label="Next">
              <button
                type="button"
                onClick={next}
                disabled={index === sections.length - 1}
                aria-label="Next"
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-30"
              >
                <ChevronRight size={28} />
              </button>
            </Tooltip>
          </div>
        </>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center text-white/70">{children}</div>;
}
