import { useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  CalendarCheck2,
  ClipboardList,
  Dumbbell,
  Flame,
  Footprints,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { POINTS, type FriendsLeaderboardResponse } from '@pacer/shared';
import { colorFor } from '../groups/memberColors';

// "The weekly score" explainer. Left column lists the six-to-seven real
// scoring rules from packages/shared/src/scoring.ts (POINTS) — never
// hardcoded, never invented. Right column (Home mode) shows a compact
// top-4 leaderboard from the caller's real /friends/leaderboard payload
// so the message "everyone competes — not just runners" lands beside
// live evidence of who's currently ahead. Group Detail mode omits the
// leaderboard because that surface already has four leaderboard cards
// and a fifth would be visual noise.

interface CommonProps {
  /** Optional heading override — otherwise "The weekly score". */
  heading?: string;
}

interface WithLeaderboardProps extends CommonProps {
  mode: 'with-leaderboard';
  /** The real /friends/leaderboard payload. Pass whatever the hook
   *  returns; null / undefined during load renders the loading state,
   *  and empty-leaderboard renders an honest empty. */
  leaderboard: FriendsLeaderboardResponse | undefined;
  /** Caller's user_id for the You highlight. */
  callerId: string | null;
}

interface RulesOnlyProps extends CommonProps {
  mode: 'rules-only';
}

export type ScoreExplainerCardProps = WithLeaderboardProps | RulesOnlyProps;

interface RuleRow {
  key: string;
  label: string;
  value: string;
  icon: ReactNode;
}

// Rules are derived from POINTS at render time, NEVER hardcoded. If a
// future PR raises RUN_PER_KM to 2 the card updates automatically.
function buildRules(): RuleRow[] {
  return [
    {
      key: 'run',
      label: 'Run logged',
      value: `${POINTS.RUN_BASE} + ${POINTS.RUN_PER_KM}/km`,
      icon: <Footprints size={14} strokeWidth={1.8} />,
    },
    {
      key: 'workout',
      label: 'Workout logged',
      value: `${POINTS.WORKOUT}`,
      icon: <Dumbbell size={14} strokeWidth={1.8} />,
    },
    {
      key: 'habit',
      label: 'Habit completed',
      value: `${POINTS.HABIT_PER_DAY} / day`,
      icon: <CalendarCheck2 size={14} strokeWidth={1.8} />,
    },
    {
      key: 'all_habits',
      label: 'All habits in a day',
      value: `+${POINTS.ALL_HABITS_BONUS}`,
      icon: <Sparkles size={14} strokeWidth={1.8} />,
    },
    {
      key: 'plan_run',
      label: 'Planned run on schedule',
      value: `+${POINTS.PLAN_RUN_ON_SCHEDULE}`,
      icon: <ClipboardList size={14} strokeWidth={1.8} />,
    },
    {
      key: 'streak',
      label: '7-day streak',
      value: `+${POINTS.STREAK_7DAY}`,
      icon: <Flame size={14} strokeWidth={1.8} />,
    },
    {
      key: 'race_win',
      label: 'Race win',
      value: `+${POINTS.RACE_WIN}`,
      icon: <Trophy size={14} strokeWidth={1.8} />,
    },
  ];
}

export function ScoreExplainerCard(props: ScoreExplainerCardProps) {
  const rules = useMemo(buildRules, []);
  const withLeaderboard = props.mode === 'with-leaderboard';

  return (
    <section
      aria-labelledby="score-explainer-heading"
      className="rounded-card border border-border bg-surface p-5 md:p-6 shadow-sm flex flex-col gap-4"
    >
      <header className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-[0.18em] text-accent font-semibold">
          The competitive glue
        </span>
        <h2
          id="score-explainer-heading"
          className="font-display text-xl md:text-2xl font-bold text-ink leading-tight"
        >
          Everyone competes — not just the runner.
        </h2>
      </header>

      <div
        className={`grid gap-5 items-start ${
          withLeaderboard ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : ''
        }`}
      >
        <RulesColumn rules={rules} heading={props.heading ?? 'The weekly score'} />
        {withLeaderboard && (
          <LeaderboardColumn
            leaderboard={props.leaderboard}
            callerId={props.callerId}
          />
        )}
      </div>

      <p className="text-xs text-ink-muted leading-relaxed">
        A simple weekly score means the walker, the swimmer and the marathoner all play the same
        game.
      </p>
    </section>
  );
}

function RulesColumn({ rules, heading }: { rules: RuleRow[]; heading: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs uppercase tracking-wide text-ink-muted font-medium">
        {heading}
      </div>
      <ul role="list" className="flex flex-col divide-y divide-border/70">
        {rules.map((r) => (
          <li
            key={r.key}
            className="flex items-center justify-between gap-3 py-2"
          >
            <span className="inline-flex items-center gap-2 text-sm text-ink">
              <span
                aria-hidden="true"
                className="grid place-items-center w-6 h-6 rounded-pill bg-ink/5 text-ink-muted"
              >
                {r.icon}
              </span>
              {r.label}
            </span>
            <span className="text-sm font-semibold text-accent tabular-nums">
              {r.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LeaderboardColumn({
  leaderboard,
  callerId,
}: {
  leaderboard: FriendsLeaderboardResponse | undefined;
  callerId: string | null;
}) {
  // Loading — the caller hasn't handed us data yet.
  if (!leaderboard) {
    return (
      <div className="rounded-card border border-border bg-panel p-4 flex flex-col gap-2">
        <div className="h-4 w-32 rounded bg-ink/5 animate-pulse" />
        <div className="h-4 rounded bg-ink/5 animate-pulse" />
        <div className="h-4 rounded bg-ink/5 animate-pulse" />
        <div className="h-4 rounded bg-ink/5 animate-pulse" />
      </div>
    );
  }

  // The leaderboard array always includes the caller when they're signed
  // in. `friendCount` is the number of OTHER accepted friends on the row set.
  const friendCount = leaderboard.leaderboard.filter(
    (r) => r.user_id !== callerId,
  ).length;

  if (friendCount === 0) {
    return (
      <div className="rounded-card border border-dashed border-border bg-panel p-4 flex flex-col gap-1">
        <div className="text-xs uppercase tracking-wide text-ink-muted font-medium">
          This week
        </div>
        <p className="text-sm text-ink-muted leading-snug">
          Your friends network is empty right now. Add a friend to start comparing weekly scores.
        </p>
      </div>
    );
  }

  // Rank by score, take the top 4. Real data, no synthetic tie-breakers.
  const sorted = [...leaderboard.leaderboard].sort(
    (a, b) => b.score - a.score || b.distance_meters - a.distance_meters,
  );
  const top = sorted.slice(0, 4);
  const max = Math.max(1, ...top.map((r) => r.score));

  return (
    <div className="rounded-card border border-border bg-panel p-4 flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide text-ink-muted font-medium">
          This week · your friends
        </span>
        <span className="inline-flex items-center gap-1 rounded-pill bg-success/10 text-success text-[10px] font-semibold px-2 py-0.5">
          <span
            aria-hidden="true"
            className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"
          />
          live
        </span>
      </div>
      <ol role="list" className="flex flex-col gap-1.5">
        {top.map((row, i) => {
          const isYou = row.user_id === callerId;
          const pct = row.score > 0 ? (row.score / max) * 100 : 0;
          const color = isYou ? 'var(--color-accent)' : colorFor(row.user_id);
          const rank = i + 1;
          return (
            <li key={row.user_id} className="flex items-center gap-2">
              <span
                aria-label={`Rank ${rank}`}
                className={`grid place-items-center w-5 h-5 shrink-0 text-[10px] font-bold rounded-pill ${
                  rank === 1
                    ? 'bg-streak/15 text-streak'
                    : 'bg-ink/5 text-ink-muted'
                }`}
              >
                {rank}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className={`flex items-center gap-1.5 text-xs truncate ${
                    isYou ? 'text-ink font-semibold' : 'text-ink'
                  }`}
                >
                  <span aria-hidden="true" className="text-sm leading-none">
                    {row.avatar_emoji ?? '🏃'}
                  </span>
                  <span className="truncate">{isYou ? 'You' : row.display_name}</span>
                </div>
                <div className="mt-0.5 h-1.5 w-full rounded-pill bg-ink/5 overflow-hidden">
                  <div
                    className="h-full rounded-pill transition-[width] duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                    aria-hidden="true"
                  />
                </div>
              </div>
              <span className="text-xs font-semibold text-ink tabular-nums w-10 text-right">
                {row.score}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
