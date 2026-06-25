import { Flame, Sparkles } from 'lucide-react';

interface HomeHeaderProps {
  greeting: string;
  firstName: string;
  streakDays: number;
  weeklyPoints: number;
}

export function HomeHeader({ greeting, firstName, streakDays, weeklyPoints }: HomeHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      <h1 className="font-display text-3xl font-bold text-ink leading-tight">
        {greeting}, <span className="text-accent">{firstName}</span>
      </h1>
      <div className="flex flex-wrap gap-2">
        <Chip
          icon={<Flame size={14} strokeWidth={2} className="text-streak" />}
          label={`${streakDays} day${streakDays === 1 ? '' : 's'}`}
          srLabel={`Streak: ${streakDays} days`}
        />
        <Chip
          icon={<Sparkles size={14} strokeWidth={2} className="text-accent" />}
          label={`${weeklyPoints} pts this week`}
          srLabel={`Weekly points: ${weeklyPoints}`}
        />
      </div>
    </header>
  );
}

function Chip({
  icon,
  label,
  srLabel,
}: {
  icon: React.ReactNode;
  label: string;
  srLabel: string;
}) {
  return (
    <span
      aria-label={srLabel}
      className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1 text-xs font-medium text-ink shadow-sm"
    >
      {icon}
      <span aria-hidden="true">{label}</span>
    </span>
  );
}
