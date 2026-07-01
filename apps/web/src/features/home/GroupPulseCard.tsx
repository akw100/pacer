import { Link } from 'react-router';
import type { GroupPulse, LeaderboardRow } from './home.mock';

interface GroupPulseCardProps {
  pulse: GroupPulse;
}

export function GroupPulseCard({ pulse }: GroupPulseCardProps) {
  const top = pulse.rows[0];
  const you = pulse.rows.find((r) => r.isYou);
  // Friendly nudge — never the negative framing ("you're losing"). Falls back
  // to celebration when the user is on top.
  const motivation = motivationFor(top, you);

  return (
    <section
      aria-labelledby="group-pulse-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-4"
    >
      <header className="flex items-center justify-between gap-3">
        <h2 id="group-pulse-heading" className="font-display text-lg font-semibold text-ink">
          Group pulse
        </h2>
        {pulse.groupName && (
          <Link
            to="/group"
            className="text-xs text-ink-muted truncate max-w-[60%] text-right hover:text-ink"
          >
            {pulse.groupName}
          </Link>
        )}
      </header>

      {pulse.rows.length === 0 ? (
        <p className="text-sm text-ink-muted leading-relaxed">
          Tag a run or workout to this group to start the leaderboard.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5" role="list">
          {pulse.rows.map((row, i) => {
            // A trailing "You" row is appended in useHomeData when the
            // viewer isn't in the Top 3. Visually break before that row
            // so the gap is honest — it's not rank 4, it's "your standing".
            const isTrailingYou =
              row.isYou && i === pulse.rows.length - 1 && pulse.rows.length > 3;
            return (
              <li key={row.id} className="contents">
                {isTrailingYou && (
                  <div
                    aria-hidden="true"
                    className="text-center text-ink-muted text-xs select-none -my-0.5"
                  >
                    · · ·
                  </div>
                )}
                <LeaderRow rank={i + 1} row={row} trailing={isTrailingYou} />
              </li>
            );
          })}
        </ol>
      )}

      {motivation && (
        <p className="text-sm text-ink font-medium leading-snug">{motivation}</p>
      )}
    </section>
  );
}

function LeaderRow({
  rank,
  row,
  trailing,
}: {
  rank: number;
  row: LeaderboardRow;
  trailing?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-card border px-3 py-2 ${
        row.isYou
          ? 'border-accent/30 bg-accent/5'
          : 'border-border bg-surface'
      }`}
    >
      <span
        aria-label={trailing ? `Your rank ${rank}` : `Rank ${rank}`}
        className={`grid place-items-center w-7 h-7 rounded-pill text-xs font-semibold ${
          rank === 1 ? 'bg-streak/15 text-streak' : 'bg-ink/5 text-ink-muted'
        }`}
      >
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <div
          className={`truncate text-sm ${
            row.isYou ? 'text-ink font-semibold' : 'text-ink'
          }`}
        >
          {row.isYou ? 'You' : row.name}
        </div>
        {row.handle && (
          <div className="text-[10px] text-ink-muted truncate leading-tight">
            @{row.handle}
          </div>
        )}
      </div>
      <span className="font-display text-base font-bold text-ink tabular-nums">
        {row.points}
        <span className="text-xs text-ink-muted font-medium ml-1">pts</span>
      </span>
    </div>
  );
}

function motivationFor(
  top: LeaderboardRow | undefined,
  you: LeaderboardRow | undefined,
): string | null {
  if (!top || !you) return null;
  if (you.id === top.id) return `You're leading the pack — keep it up!`;
  const gap = top.points - you.points;
  if (gap <= 0) return null;
  return `You're only ${gap} pt${gap === 1 ? '' : 's'} from first place`;
}
