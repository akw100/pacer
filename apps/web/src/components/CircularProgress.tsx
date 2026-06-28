import { useEffect, useState } from 'react';

// Animated circular progress ring — adapted from magicui's animated-circular-progress-bar
// (https://magicui.design/docs/components/animated-circular-progress-bar), retheme'd to
// Pacer tokens. The faint track shows how much is left; the accent arc fills to show how
// much is done. Pure SVG + a CSS transition on stroke-dashoffset (no new dependency); on
// mount the arc fills from empty, and it animates between values as `value` changes.

interface CircularProgressProps {
  value: number; // current progress, e.g. step + 1
  max: number; // total, e.g. number of steps
  size?: number | string; // px number or any CSS length (e.g. clamp/vmin), default 36
  label?: React.ReactNode; // center content; defaults to `value/max`
  className?: string;
  trackColor?: string; // CSS color for the "still to do" ring; defaults to --color-border
  arcColor?: string; // CSS color for the "done" arc; defaults to --color-accent
}

const R = 16; // viewBox is 40×40, stroke 4 → radius 16 keeps the ring fully inside
const C = 2 * Math.PI * R;

export function CircularProgress({
  value,
  max,
  size = 36,
  label,
  className = '',
  trackColor = 'var(--color-border)',
  arcColor = 'var(--color-accent)',
}: CircularProgressProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const shown = mounted ? pct : 0; // fill from empty on first paint
  const offset = C * (1 - shown);

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size, containerType: 'size' }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value} of ${max}`}
    >
      <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90">
        <circle cx="20" cy="20" r={R} fill="none" strokeWidth="4" stroke={trackColor} />
        <circle
          cx="20"
          cy="20"
          r={R}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          stroke={arcColor}
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <span
        className="absolute inset-0 grid place-items-center font-semibold leading-none tabular-nums"
        style={{ fontSize: '28cqmin' }}
      >
        {label ?? `${value}/${max}`}
      </span>
    </div>
  );
}
