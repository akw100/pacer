import { useMemo, useState } from 'react';
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
import type { GroupStats, LeaderboardRow } from './useGroups';
import { colorFor } from './memberColors';

// Real recharts BarChart of member contributions to the group's week.
// Reads `stats.leaderboard` verbatim — no invented values, no aggregation
// beyond the metric toggle. Each bar is colored by the same
// memberColors palette used elsewhere on the page; "you" wins with the
// app accent so the viewer's eye lands on their own bar first.

type Metric = 'score' | 'km' | 'runs';

interface GroupMemberContributionChartProps {
  stats: GroupStats | undefined;
  youUserId: string | null;
  units: Units;
}

const MAX_VISIBLE = 10;

export function GroupMemberContributionChart({
  stats,
  youUserId,
  units,
}: GroupMemberContributionChartProps) {
  const [metric, setMetric] = useState<Metric>('score');

  const rows = useMemo(
    () => buildChartData(stats, metric, youUserId, units),
    [stats, metric, youUserId, units],
  );

  if (!stats) return null;

  const hasActivity = rows.some((r) => r.value > 0);

  return (
    <section
      aria-labelledby="member-contribution-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-4"
    >
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <h2
          id="member-contribution-heading"
          className="font-display text-lg font-semibold text-ink"
        >
          Member contribution
        </h2>
        <MetricToggle metric={metric} onChange={setMetric} />
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No members yet. Invite people to your group to fill this chart.
        </p>
      ) : !hasActivity ? (
        <p className="text-sm text-ink-muted">
          No activity this week yet — nobody has logged into this group.
        </p>
      ) : (
        <div style={{ height: Math.max(120, rows.length * 34 + 32) }} className="-mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: 44, left: 4, bottom: 0 }}
              barCategoryGap={4}
            >
              <XAxis type="number" hide domain={[0, 'dataMax']} />
              <YAxis
                type="category"
                dataKey="label"
                width={104}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'var(--color-ink)' }}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-ink)', fillOpacity: 0.05 }}
                content={<ChartTooltip metric={metric} units={units} />}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                {rows.map((r) => (
                  <Cell key={r.id} fill={r.color} />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(v: unknown) => formatValueLabel(v, metric, units)}
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
      )}
    </section>
  );
}

interface ChartDatum {
  id: string;
  label: string;
  value: number;
  color: string;
  isYou: boolean;
  row: LeaderboardRow;
}

function buildChartData(
  stats: GroupStats | undefined,
  metric: Metric,
  youUserId: string | null,
  _units: Units,
): ChartDatum[] {
  if (!stats) return [];
  const key = metricKey(metric);
  const sorted = [...stats.leaderboard].sort((a, b) => b[key] - a[key]);
  const withRank = sorted.map((r, i) => ({ ...r, rank: i + 1 }));
  const top = withRank.slice(0, MAX_VISIBLE);
  const youInTop = youUserId != null && top.some((r) => r.user_id === youUserId);
  const youOutsideRow =
    youUserId != null && !youInTop ? withRank.find((r) => r.user_id === youUserId) : undefined;
  const display =
    youOutsideRow != null ? [...top.slice(0, MAX_VISIBLE - 1), youOutsideRow] : top;

  return display.map((r) => {
    const isYou = r.user_id === youUserId;
    return {
      id: r.user_id,
      label: `#${r.rank} ${isYou ? 'You' : r.display_name}`,
      value: r[key],
      color: isYou ? 'var(--color-accent)' : colorFor(r.user_id),
      isYou,
      row: r,
    };
  });
}

function metricKey(metric: Metric): 'score' | 'distance_meters' | 'runs' {
  return metric === 'km' ? 'distance_meters' : metric === 'runs' ? 'runs' : 'score';
}

function formatValueLabel(v: unknown, metric: Metric, units: Units): string {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n === 0) return '';
  if (metric === 'score') return `${n} pts`;
  if (metric === 'runs') return `${n}`;
  const { value, unit } = metersToDisplayDistance(n, units);
  return `${value.toFixed(1)} ${unit}`;
}

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
}

function ChartTooltip({
  active,
  payload,
  metric,
  units,
}: TooltipPayload & { metric: Metric; units: Units }) {
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
        {d.isYou ? 'You' : d.row.display_name}
      </div>
      <div className="text-ink-muted tabular-nums">
        {formatValueLabel(d.value, metric, units)}
      </div>
    </div>
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
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Contribution metric"
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
            className={`rounded-pill px-2.5 py-0.5 text-xs font-medium transition-colors ${
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
