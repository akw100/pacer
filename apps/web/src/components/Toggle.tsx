import { InputHTMLAttributes } from 'react'

interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

export function Toggle({ label, id, className = '', ...props }: ToggleProps) {
  return (
    <label htmlFor={id} className={`inline-flex items-center gap-2.5 cursor-pointer select-none ${className}`}>
      <input id={id} type="checkbox" role="switch" className="sr-only peer" {...props} />
      <span className="relative w-10 h-6 rounded-pill bg-border transition-colors peer-checked:bg-accent after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4" />
      {label && <span className="text-sm text-ink">{label}</span>}
    </label>
  )
}
