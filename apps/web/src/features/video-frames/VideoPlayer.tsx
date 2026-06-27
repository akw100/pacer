import { X } from 'lucide-react'

// Lightweight YouTube embed overlay — plays the original video in an iframe.
// Backdrop or the close button dismisses; clicking the player itself doesn't.
export function VideoPlayer({ videoId, onClose }: { videoId: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Video"
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/90 p-4"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        title="Close"
        className="absolute right-3 top-3 rounded-pill p-2 text-white/80 hover:bg-white/10 hover:text-white"
      >
        <X size={20} />
      </button>
      <div className="aspect-video w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
          title="YouTube video player"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          className="h-full w-full rounded-card"
        />
      </div>
    </div>
  )
}
