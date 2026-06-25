import { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className = '', ...props }: SelectProps) {
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <select
        className="w-full appearance-none rounded-card border border-border bg-surface text-ink text-sm px-4 py-2.5 pr-9 focus:outline-none focus:border-accent transition-colors cursor-pointer"
        {...props}
      />
      <ChevronDown size={14} className="absolute right-3 pointer-events-none text-ink-muted" strokeWidth={2} />
    </div>
  )
}
