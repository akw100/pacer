import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Sparkles, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { AssistantChatMessage } from '@pacer/shared'
import { ApiError } from '../../lib/api'
import { useChatCompletion } from './useAssistant'
import { MessageBubble, TypingBubble } from './MessageBubble'
import { SuggestionChips } from './SuggestionChips'

// Server-side caps from packages/shared/src/schemas/assistant.ts. Mirror them
// here so we disable the composer BEFORE the request is rejected at validation.
const MAX_HISTORY = 20
const MAX_LEN = 2000
const WARN_AT = 18

function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Your session expired — refresh and try again.'
    if (err.status === 422) return "Message couldn't be sent. Try shortening it."
    if (err.status === 429) return 'Coach is busy — try again in a minute.'
    if (err.status === 502) return 'Coach hit a snag. Try again.'
  }
  return "Couldn't reach Coach. Check your connection and try again."
}

export function CoachScreen() {
  const [messages, setMessages] = useState<AssistantChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const mutation = useChatCompletion()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll the history viewport to the bottom whenever a message lands
  // or the typing indicator appears/disappears. Cheap and avoids needing an
  // anchor sentinel element.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, mutation.isPending])

  // Auto-grow the composer up to ~5 rows, then scroll inside the textarea.
  useEffect(() => {
    const t = inputRef.current
    if (!t) return
    t.style.height = 'auto'
    t.style.height = `${Math.min(t.scrollHeight, 160)}px`
  }, [draft])

  const trimmedDraft = draft.trim()
  const canSend =
    !mutation.isPending &&
    trimmedDraft.length > 0 &&
    trimmedDraft.length <= MAX_LEN &&
    messages.length < MAX_HISTORY

  function send(content: string) {
    const trimmed = content.trim()
    if (!trimmed || mutation.isPending) return
    if (messages.length >= MAX_HISTORY) return
    if (trimmed.length > MAX_LEN) return

    const next: AssistantChatMessage[] = [...messages, { role: 'user', content: trimmed }]
    setMessages(next)
    setDraft('')
    inputRef.current?.focus()

    mutation.mutate(next, {
      onSuccess: (res) => {
        setMessages((m) => [...m, res.message])
      },
      onError: (err) => {
        // Roll back the optimistic user message and restore the draft so the
        // user can edit + retry without retyping.
        setMessages((m) => m.slice(0, -1))
        setDraft(trimmed)
        toast.error(friendlyError(err))
      },
    })
  }

  function clear() {
    if (mutation.isPending) return
    setMessages([])
    inputRef.current?.focus()
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(draft)
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 4rem)' }}>
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-panel px-4 py-3 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-accent" strokeWidth={1.8} />
            <h1 className="font-display text-xl font-bold text-ink">Pacer Coach</h1>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clear}
              disabled={mutation.isPending}
              aria-label="Clear chat"
              className="inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-xs text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={14} strokeWidth={1.8} />
              Clear
            </button>
          )}
        </div>
        <p className="mt-0.5 text-xs text-ink-muted">
          Ask about your streak, week, friends, or groups.
        </p>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation with Pacer Coach"
        className="flex-1 overflow-y-auto px-4 py-4 md:px-6"
      >
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-4 pt-8 text-center">
            <div className="rounded-full bg-accent/10 p-3">
              <Sparkles size={24} className="text-accent" strokeWidth={1.8} />
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold text-ink">What can I tell you?</h2>
              <p className="text-sm text-ink-muted">
                I can look up your activity, score, friends standing, and groups. Pick a
                starter or ask anything.
              </p>
            </div>
            <SuggestionChips onPick={send} disabled={mutation.isPending} />
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
            {messages.map((m, i) => (
              <MessageBubble key={i} message={m} />
            ))}
            {mutation.isPending && <TypingBubble />}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border bg-panel px-4 py-3 md:px-6">
        <div className="mx-auto max-w-2xl">
          {messages.length >= WARN_AT && messages.length < MAX_HISTORY && (
            <p className="mb-2 text-xs text-ink-muted">
              Sessions reset after {MAX_HISTORY} messages — clear to keep chatting.
            </p>
          )}
          {messages.length >= MAX_HISTORY && (
            <p className="mb-2 text-xs text-accent">
              Session full. Clear to start a new chat.
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask Pacer Coach…"
              rows={1}
              maxLength={MAX_LEN}
              disabled={messages.length >= MAX_HISTORY}
              aria-label="Message"
              className="min-h-[44px] max-h-[160px] flex-1 resize-none rounded-card border border-border bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => send(draft)}
              disabled={!canSend}
              aria-label="Send"
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-card bg-accent text-white transition-all hover:bg-accent/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-accent"
            >
              <Send size={18} strokeWidth={2} />
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-ink-muted">
            <span>Press Enter to send · Shift+Enter for newline</span>
            {draft.length > 0 && (
              <span className={draft.length > MAX_LEN - 200 ? 'text-accent' : ''}>
                {draft.length}/{MAX_LEN}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
