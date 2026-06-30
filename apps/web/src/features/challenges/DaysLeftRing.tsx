// Days-left ring (spec §02-PAGES: "date range with days-left ring"). A small SVG
// progress ring whose arc shows how much of the window has elapsed, with the
// days remaining in the centre. Streak-toned; token colors only via currentColor.

interface DaysLeftRingProps {
  start: string; // yyyy-MM-dd
  end: string;
  today: string;
  size?: number;
}

export function DaysLeftRing({ start, end, today, size = 52 }: DaysLeftRingProps) {
  const startMs = new Date(`${start}T00:00:00`).getTime();
  const endMs = new Date(`${end}T00:00:00`).getTime();
  const todayMs = new Date(`${today}T00:00:00`).getTime();

  const total = Math.max(1, Math.round((endMs - startMs) / 86_400_000));
  const remaining = Math.max(0, Math.round((endMs - todayMs) / 86_400_000));
  const elapsedFraction = Math.max(0, Math.min(1, (todayMs - startMs) / (endMs - startMs || 1)));

  const stroke = 4;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * elapsedFraction;

  return (
    <span className="relative inline-grid place-items-center text-streak" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
      </svg>
      <span className="absolute flex flex-col items-center leading-none">
        {remaining <= 0 ? (
          // Window still open today — its final day. "0 days" would read as over.
          <span className="font-display text-[10px] font-bold uppercase tracking-wide text-ink">Last day</span>
        ) : (
          <>
            <span className="font-display text-sm font-bold text-ink tabular-nums">{remaining}</span>
            <span className="text-[9px] uppercase tracking-wide text-ink-muted">{remaining === 1 ? 'day' : 'days'}</span>
          </>
        )}
      </span>
      <span className="sr-only">
        {remaining} of {total} days left
      </span>
    </span>
  );
}
