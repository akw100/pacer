// Empty-state starter prompts. Clicking a chip SENDS that text as a user
// message — chips are prompts, never canned assistant responses. The set is
// intentionally small and aligned with the 4 backend tools (score, recent
// activity, friends leaderboard, my groups) so each starter is likely to
// resolve via a real tool call rather than the model guessing.
const STARTERS = [
  "What's my current streak?",
  'How was my last week?',
  'Where do I stand vs my friends?',
  'What groups am I in?',
] as const

interface Props {
  onPick: (prompt: string) => void
  disabled?: boolean
}

export function SuggestionChips({ onPick, disabled }: Props) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {STARTERS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => onPick(prompt)}
          disabled={disabled}
          className="rounded-pill border border-border bg-panel px-4 py-2 text-sm text-ink transition-colors hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {prompt}
        </button>
      ))}
    </div>
  )
}
