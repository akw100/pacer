import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Trophy, UserPlus } from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { metersToDisplayDistance, type Units } from '@pacer/shared';
import { useAuth } from '../auth/AuthProvider';
import { useProfile } from '../auth/useProfile';
import { colorFor } from '../groups/memberColors';
import { useFriendsLeaderboard } from './useFriends';
import type { FriendLeaderboardRow } from '@pacer/shared';

// Home summary of "where I stand among accepted friends." Reads the real
// /friends/leaderboard endpoint (this-week window) and renders every
// entry as a horizontal recharts BarChart row. Never invents numbers,
// never lists people the caller isn't actually friends with. Empty and
// zero states stay honest — the chart is hidden and replaced by copy in
// those cases.
//
// Colors: "You" is always app accent so the viewer's eye lands on their
// own bar first. Other friends use the same deterministic palette that
// the Group Detail v2 leaderboard uses (via `memberColors.colorFor`), so
// a friend who is also a group member reads as the same color on both
// surfaces. memberColors.ts is a pure hash-to-color module with no
// group-specific dependencies, so the cross-slice import is safe.

type Metric = 'score' | 'km' | 'runs' | 'workouts';

const VISIBLE_ROWS = 8;

export function FriendsStandingCard() {
  const { session } = useAuth();
  const callerId = session?.user.id ?? null;
  const { profile } = useProfile();
  const units: Units = (profile as unknown as { units?: Units } | null)?.units ?? 'km';
  const lb = useFriendsLeaderboard();
  const [metric, setMetric] = useState<Metric>('score');

  if (lb.isLoading) {
    return (
      <section
        aria-label="Loading friends standing"
        className="rounded-card border border-border bg-surface p-4 shadow-sm"
      >
        <div className="h-4 w-40 rounded bg-ink/5 animate-pulse" />
        <div className="mt-3 h-4 w-2/3 rounded bg-ink/5 animate-pulse" />
      </section>
    );
  }

  if (lb.isError) {
    return (
      <section className="rounded-card border border-border bg-surface p-4 shadow-sm flex items-center justify-between gap-3 text-sm">
        <span className="text-ink-muted">Couldn't load friends standing.</span>
        <button
          type="button"
          onClick={() => lb.refetch()}
          className="rounded-pill border border-border bg-surface px-3 py-1 text-xs font-medium text-ink hover:bg-ink/5"
        >
          Retry
        </button>
      </section>
    );
  }

  const data = lb.data;
  if (!data) return null;

  // The API always includes the caller in the leaderboard. "friends"
  // means everyone else on the board.
  const friendCount = data.leaderboard.filter((r) => r.user_id !== callerId).length;

  if (friendCount === 0) {
    return <EmptyState />;
  }

  // No personal activity yet this week → caller isn't ranked.
  const rank = data.you_vs_friends.rank;
  if (rank == null) {
    return (
      <Shell metric={metric} setMetric={setMetric} showToggle={false}>
        <BodyMuted>
          Log a run to start the friends leaderboard.
        </BodyMuted>
      </Shell>
    );
  }

  return (
    <Shell metric={metric} setMetric={setMetric} showToggle={true}>
      <FriendsChart
        rows={data.leaderboard}
        callerId={callerId}
        metric={metric}
        units={units}
      />
    </Shell>
  );
}

interface FriendsChartProps {
  rows: FriendLeaderboardRow[];
  callerId: string | null;
  metric: Metric;
  units: Units;
}

interface ChartDatum {
  id: string;
  label: string;
  value: number;
  display: string;
  color: string;
  isYou: boolean;
  handle: string;
  displayName: string;
}

function FriendsChart({ rows, callerId, metric, units }: FriendsChartProps) {
  const data = useMemo(
    () => buildChartData(rows, callerId, metric, units),
    [rows, callerId, metric, units],
  );

  if (data.length === 0) {
    return (
      <BodyMuted>
        No activity from your friends this week yet.
      </BodyMuted>
    );
  }

  const hasAny = data.some((d) => d.value > 0);
  if (!hasAny) {
    return (
      <BodyMuted>
        No activity from you or your friends this week yet.
      </BodyMuted>
    );
  }

  return (
    <div style={{ height: Math.max(120, data.length * 30 + 20) }} className="-mx-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 44, left: 4, bottom: 0 }}
          barCategoryGap={4}
        >
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis
            type="category"
            dataKey="label"
            width={112}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--color-ink)' }}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-ink)', fillOpacity: 0.05 }}
            content={<FriendsTooltip />}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.id} fill={d.color} />
            ))}
            <LabelList
              dataKey="display"
              position="right"
              style={{
                fill: 'var(--color-ink)',
                fontSize: 11,
                fontVariantNumeric: 'tabular-nums',
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function buildChartData(
  rows: FriendLeaderboardRow[],
  callerId: string | null,
  metric: Metric,
  units: Units,
): ChartDatum[] {
  const key = metricKey(metric);
  const sorted = [...rows].sort((a, b) => b[key] - a[key]);
  const ranked = sorted.map((r, i) => ({ ...r, rank: i + 1 }));

  // Top-N + always pin "you" if outside — same pattern as the group
  // leaderboard v1 so the viewer never scrolls to find themselves.
  const top = ranked.slice(0, VISIBLE_ROWS);
  const youInTop = callerId != null && top.some((r) => r.user_id === callerId);
  const youOutside =
    callerId != null && !youInTop ? ranked.find((r) => r.user_id === callerId) : undefined;
  const display =
    youOutside != null ? [...top.slice(0, VISIBLE_ROWS - 1), youOutside] : top;

  return display.map((r) => {
    const isYou = r.user_id === callerId;
    const raw = r[key];
    return {
      id: r.user_id,
      label: `#${r.rank} ${isYou ? 'You' : r.display_name}`,
      value: raw,
      display: formatValue(raw, metric, units),
      color: isYou ? 'var(--color-accent)' : colorFor(r.user_id),
      isYou,
      handle: r.handle,
      displayName: r.display_name,
    };
  });
}

function metricKey(metric: Metric): 'score' | 'distance_meters' | 'runs' | 'workouts' {
  if (metric === 'km') return 'distance_meters';
  return metric;
}

function formatValue(raw: number, metric: Metric, units: Units): string {
  if (raw <= 0) return '';
  if (metric === 'score') return `${raw} pts`;
  if (metric === 'runs') return `${raw}`;
  if (metric === 'workouts') return `${raw}`;
  const { value, unit } = metersToDisplayDistance(raw, units);
  return `${value.toFixed(1)} ${unit}`;
}

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
}

function FriendsTooltip({ active, payload }: TooltipPayload) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]!.payload;
  return (
    <div className="rounded-card border border-border bg-panel px-2.5 py-1.5 text-xs shadow-sm">
      <div className="font-medium text-ink flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: d.color }}
        />
        {d.isYou ? 'You' : d.displayName}
      </div>
      <div className="text-ink-muted tabular-nums">
        {d.display || '0'}
        <span className="text-ink-muted"> · @{d.handle}</span>
      </div>
    </div>
  );
}

function Shell({
  children,
  metric,
  setMetric,
  showToggle,
}: {
  children: React.ReactNode;
  metric: Metric;
  setMetric: (m: Metric) => void;
  showToggle: boolean;
}) {
  return (
    <section
      aria-labelledby="friends-standing-heading"
      className="rounded-card border border-border bg-surface p-4 md:p-5 shadow-sm flex flex-col gap-3"
    >
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <h2
          id="friends-standing-heading"
          className="font-display text-base md:text-lg font-semibold text-ink inline-flex items-center gap-2"
        >
          <Trophy size={16} strokeWidth={1.8} className="text-accent" />
          Friends standing
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          {showToggle && <MetricToggle metric={metric} onChange={setMetric} />}
          <Link
            to="/profile"
            className="text-xs text-ink-muted inline-flex items-center gap-0.5 hover:text-ink"
          >
            Manage
            <ChevronRight size={12} strokeWidth={2} />
          </Link>
        </div>
      </header>
      {children}
    </section>
  );
}

function MetricToggle({
  metric,
  onChange,
}: {
  metric: Metric;
  onChange: (m: Metric) => void;
}) {
  const options: Array<{ id: Metric; label: string }> = [
    { id: 'score', label: 'Score' },
    { id: 'km', label: 'Distance' },
    { id: 'runs', label: 'Runs' },
    { id: 'workouts', label: 'Workouts' },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Friends leaderboard metric"
      className="inline-flex rounded-pill border border-border bg-surface p-0.5"
    >
      {options.map((o) => {
        const active = metric === o.id;
        return (
          <button
            key={o.id}
            role="radio"
            aria-checked={active}
            type="button"
            onClick={() => onChange(o.id)}
            className={`rounded-pill px-2 py-0.5 text-[11px] font-medium transition-colors ${
              active ? 'bg-ink text-surface' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function BodyMuted({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink-muted leading-snug">{children}</p>;
}

function EmptyState() {
  return (
    <section
      aria-labelledby="friends-empty-heading"
      className="rounded-card border border-dashed border-border bg-surface p-5 shadow-sm flex flex-col gap-3"
    >
      <span className="grid place-items-center w-10 h-10 rounded-pill bg-accent/10 text-accent">
        <UserPlus size={18} strokeWidth={1.8} />
      </span>
      <h2 id="friends-empty-heading" className="font-display text-lg font-semibold text-ink">
        Add friends to see where you stand
      </h2>
      <p className="text-sm text-ink-muted leading-relaxed">
        Search someone by their @handle and send a request. Their weekly
        activity will show here when they accept.
      </p>
      <Link
        to="/profile"
        className="self-start inline-flex items-center gap-1.5 rounded-pill bg-accent text-white px-4 py-2 text-sm font-semibold shadow-sm shadow-accent/20"
      >
        <UserPlus size={14} strokeWidth={2.2} />
        Add friends
      </Link>
    </section>
  );
}
