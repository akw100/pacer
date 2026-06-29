import type { ReactNode } from 'react'

// Lightweight CSS tooltip — appears immediately on hover/focus (no native ~1s
// delay), no dependency. Wrap a trigger; pass `side` for placement and
// `className` to position the wrapper itself (e.g. for an absolutely-placed
// trigger). Keep an aria-label on the trigger for screen readers / touch.
export function Tooltip({
  label,
  children,
  side = 'top',
  className = '',
}: {
  label: string
  children: ReactNode
  side?: 'top' | 'bottom'
  className?: string
}) {
  const pos = side === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
  return (
    <span className={`group relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-[80] -translate-x-1/2 whitespace-nowrap rounded-pill bg-ink px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100 ${pos}`}
      >
        {label}
      </span>
    </span>
  )
}
