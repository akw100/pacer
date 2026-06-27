import { useEffect } from 'react'
import { Mic, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useVoiceAgent } from './useVoiceAgent'

// Floating, hands-free voice control. Sits above the mobile nav bar; tap to start
// talking, tap again to stop. The agent can navigate, click, and fill forms by voice.
export function VoiceAgent() {
  const { status, error, toggle } = useVoiceAgent()

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  const live = status === 'live'
  const connecting = status === 'connecting'

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-20 flex items-center gap-2">
      {live && (
        <span className="rounded-pill bg-panel border border-border px-3 py-1 text-xs text-ink-muted shadow-sm">
          Listening…
        </span>
      )}
      <button
        onClick={toggle}
        aria-label={live || connecting ? 'Stop voice control' : 'Start voice control'}
        aria-pressed={live}
        className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
          live ? 'bg-ink text-white shadow-ink/25' : 'bg-accent text-white shadow-accent/25'
        }`}
      >
        {live && <span className="absolute inset-0 rounded-full bg-accent/40 animate-ping" />}
        {connecting ? (
          <Loader2 size={24} className="animate-spin" />
        ) : live ? (
          <X size={24} strokeWidth={2.5} />
        ) : (
          <Mic size={24} strokeWidth={2.2} />
        )}
      </button>
    </div>
  )
}
