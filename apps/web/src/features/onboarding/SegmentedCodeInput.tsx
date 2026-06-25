import { useEffect, useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';

// Custom 6-character segmented code input. Used for the group invite code.
// Native input styling is suppressed (per card 13: "no native checkboxes/
// selects" — we extend that to inputs that need a non-default look).
//
// Paste-aware: pasting "ABC234" anywhere fills all six boxes at once. Filters
// to the restricted alphabet (no O/0/I/1/L) so a typo is a no-op.

const ALPHABET = /[A-HJ-KMN-PR-TV-Z2-9]/;

interface SegmentedCodeInputProps {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  ariaLabel?: string;
  autoFocus?: boolean;
}

export function SegmentedCodeInput({
  value,
  onChange,
  length = 6,
  ariaLabel = 'Invite code',
  autoFocus,
}: SegmentedCodeInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function setChar(idx: number, ch: string) {
    const filtered = ch.toUpperCase().match(ALPHABET)?.[0] ?? '';
    const chars = padded(value, length).split('');
    chars[idx] = filtered;
    onChange(chars.join('').replace(/ +$/, ''));
    if (filtered && idx < length - 1) refs.current[idx + 1]?.focus();
  }

  function onKey(idx: number) {
    return (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !value[idx] && idx > 0) {
        refs.current[idx - 1]?.focus();
      } else if (e.key === 'ArrowLeft' && idx > 0) {
        e.preventDefault();
        refs.current[idx - 1]?.focus();
      } else if (e.key === 'ArrowRight' && idx < length - 1) {
        e.preventDefault();
        refs.current[idx + 1]?.focus();
      }
    };
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').toUpperCase();
    const cleaned = text.split('').filter((c) => ALPHABET.test(c)).slice(0, length).join('');
    if (cleaned.length === 0) return;
    onChange(cleaned);
    refs.current[Math.min(cleaned.length, length - 1)]?.focus();
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex justify-between gap-2"
    >
      {Array.from({ length }).map((_, idx) => {
        const ch = value[idx] ?? '';
        return (
          <input
            key={idx}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            maxLength={1}
            aria-label={`Character ${idx + 1} of ${length}`}
            value={ch}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setChar(idx, e.target.value)}
            onKeyDown={onKey(idx)}
            onPaste={onPaste}
            className="w-11 h-12 rounded-card border border-border bg-surface text-center font-display text-2xl font-bold text-ink uppercase focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 sm:w-12"
          />
        );
      })}
    </div>
  );
}

function padded(s: string, len: number): string {
  return s.padEnd(len, ' ').slice(0, len);
}
