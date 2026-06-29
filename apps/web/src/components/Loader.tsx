import { useState } from 'react';
import './Loader.css';

const VARIANTS = 19;
// ponytail: module counter, not Math.random — cycles so consecutive loaders
// never repeat. Random start so a reload doesn't always open on variant 1.
let cursor = Math.floor(Math.random() * VARIANTS);

/** Shared loading indicator. Shows a different animation each time it mounts.
 *  `label` is the accessible name (and optional visible caption). Use for
 *  page/section loading; tiny in-button spinners stay as lucide icons. */
export function Loader({
  label = 'Loading',
  showLabel = false,
  className = '',
}: {
  label?: string;
  showLabel?: boolean;
  className?: string;
}) {
  const [variant] = useState(() => (cursor = (cursor % VARIANTS) + 1));
  return (
    <div
      role="status"
      aria-label={label}
      className={`flex flex-col items-center justify-center gap-4 ${className}`}
    >
      <span className={`pacer-loader pacer-loader--${variant}`} />
      {showLabel && <span className="text-sm text-ink-muted">{label}</span>}
    </div>
  );
}
