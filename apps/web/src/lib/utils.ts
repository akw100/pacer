import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// MagicUI / shadcn-style class combiner. Used by the components under
// src/components/magicui/*. clsx joins conditional classes, twMerge resolves
// Tailwind conflicts (last-wins) so consumer `className` overrides defaults.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
