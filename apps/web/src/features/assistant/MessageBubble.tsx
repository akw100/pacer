import type { AssistantChatMessage } from '@pacer/shared'

// Single chat bubble. v1 renders the assistant content as plain text with
// `whitespace-pre-wrap` so newlines/blank lines from the model survive — no
// markdown renderer, no link parsing, no HTML interpretation.
export function MessageBubble({ message }: { message: AssistantChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-card px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-accent text-white rounded-tr-sm'
            : 'border border-border bg-panel text-ink rounded-tl-sm'
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}

// Placeholder bubble shown while the mutation is in flight. It's deliberately
// NOT pushed into the messages array — it's UI-only state tied to
// mutation.isPending so a failed send leaves no orphan bubble behind.
export function TypingBubble() {
  return (
    <div className="flex justify-start" aria-label="Coach is typing">
      <div className="rounded-card rounded-tl-sm border border-border bg-panel px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-muted [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-muted [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-muted" />
        </div>
      </div>
    </div>
  )
}
