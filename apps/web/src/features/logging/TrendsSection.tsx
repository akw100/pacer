import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  formatPace,
  metersToDisplayDistance,
  paceSecondsPerUnit,
  toDateKey,
  WEEK_START,
  type Run,
  type Units,
} from '@pacer/shared';
import { startOfWeek, subDays, subMonths } from 'date-fns';
import { useRuns, useWorkouts } from './useLogging';

interface TrendsSectionProps {
  units?: Units;
  /** 0 = Sunday, 1 = Monday — matches profiles.week_start. */
  weekStart?: 0 | 1;
}

export function TrendsSection({ units = 'km', weekStart = WEEK_START }: TrendsSectionProps) {
  const runs = useRuns();
  const workouts = useWorkouts();

  const stats = useMemo(() => summarize(runs.data ?? [], workouts.data ?? [], units), [
    runs.data,
    workouts.data,
    units,
  ]);

  const weeklyDistance = useMemo(
    () => weeklyDistanceBars(runs.data ?? [], units, weekStart),
    [runs.data, units, weekStart],
  );

  const paceLine = useMemo(() => paceOverTime(runs.data ?? [], units), [runs.data, units]);

  if (runs.isLoading || workouts.isLoading) return <TrendsSkeleton />;
  if (runs.error || workouts.error)
    return (
      <div className="rounded-card border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-ink">
        Couldn't load trends.
      </div>
    );

  const empty = (runs.data?.length ?? 0) === 0 && (workouts.data?.length ?? 0) === 0;

  return (
    <section className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-ink">Trends</h2>
        <span className="text-xs text-ink-muted">Last 12 weeks</span>
      </header>

      {empty ? (
        <div className="rounded-card border border-dashed border-border bg-surface p-8 text-center text-sm text-ink-muted">
          Log a run or workout to see your trends.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label={`This week (${units})`} value={stats.thisWeekDistance.toFixed(1)} />
            <StatCard label={`This month (${units})`} value={stats.thisMonthDistance.toFixed(0)} />
            <StatCard label="Runs (all-time)" value={String(stats.totalRuns)} />
            <StatCard label="Workouts (all-time)" value={String(stats.totalWorkouts)} />
            <StatCard
              label="Avg effort (last 4w)"
              value={stats.recentAvgExertion ? stats.recentAvgExertion.toFixed(1) : '—'}
            />
            <StatCard label={`All-time (${units})`} value={stats.allTimeDistance.toFixed(0)} />
          </div>

          <div className="rounded-card border border-border bg-surface p-4">
            <div className="text-xs uppercase tracking-wide text-ink-muted mb-2">
              Weekly distance ({units})
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyDistance} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-border)' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--color-ink)', fillOpacity: 0.04 }}
                    contentStyle={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-card)',
                      fontSize: 12,
                      color: 'var(--color-ink)',
                    }}
                  />
                  <Bar dataKey="distance" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-card border border-border bg-surface p-4">
            <div className="text-xs uppercase tracking-wide text-ink-muted mb-2">
              Pace per run (/{units})
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={paceLine} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-border)' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                    tickLine={false}
                    axisLine={false}
                    width={42}
                    domain={['auto', 'auto']}
                    reversed
                    tickFormatter={(v: number) => formatPace(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-card)',
                      fontSize: 12,
                      color: 'var(--color-ink)',
                    }}
                    formatter={(v: number) => formatPace(v)}
                  />
                  <Line
                    type="monotone"
                    dataKey="pace"
                    stroke="var(--color-success)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'var(--color-success)' }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-3">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="font-display text-2xl font-bold text-ink">{value}</div>
    </div>
  );
}

function TrendsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-card border border-border bg-surface animate-pulse" />
        ))}
      </div>
      <div className="h-44 rounded-card border border-border bg-surface animate-pulse" />
      <div className="h-44 rounded-card border border-border bg-surface animate-pulse" />
    </div>
  );
}

// ── Pure summarization helpers ─────────────────────────────────────────────

function summarize(runs: Run[], workouts: { id: string }[], units: Units) {
  const now = new Date();
  const monthAgo = subMonths(now, 1);
  const fourWeeksAgo = subDays(now, 28);
  const weekStart = startOfWeek(now, { weekStartsOn: WEEK_START });

  let thisWeek = 0;
  let thisMonth = 0;
  let allTime = 0;
  const recentExertions: number[] = [];

  for (const r of runs) {
    const { value } = metersToDisplayDistance(r.distance_meters, units);
    allTime += value;
    const d = parseDateKey(r.run_date);
    if (d && d >= monthAgo) thisMonth += value;
    if (d && d >= weekStart) thisWeek += value;
    if (d && d >= fourWeeksAgo && r.exertion_rating != null) recentExertions.push(r.exertion_rating);
  }

  const recentAvgExertion =
    recentExertions.length > 0
      ? recentExertions.reduce((a, b) => a + b, 0) / recentExertions.length
      : 0;

  return {
    thisWeekDistance: thisWeek,
    thisMonthDistance: thisMonth,
    allTimeDistance: allTime,
    totalRuns: runs.length,
    totalWorkouts: workouts.length,
    recentAvgExertion,
  };
}

function weeklyDistanceBars(runs: Run[], units: Units, weekStart: 0 | 1) {
  // 12 most recent weeks, oldest → newest
  const today = new Date();
  const buckets: { key: string; label: string; distance: number; start: Date }[] = [];
  for (let w = 11; w >= 0; w--) {
    const start = startOfWeek(subDays(today, w * 7), { weekStartsOn: weekStart });
    buckets.push({
      key: toDateKey(start),
      label: `${start.getMonth() + 1}/${start.getDate()}`,
      distance: 0,
      start,
    });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const r of runs) {
    const d = parseDateKey(r.run_date);
    if (!d) continue;
    const bucketStart = startOfWeek(d, { weekStartsOn: weekStart });
    const k = toDateKey(bucketStart);
    const bucket = byKey.get(k);
    if (!bucket) continue;
    const { value } = metersToDisplayDistance(r.distance_meters, units);
    bucket.distance += value;
  }
  // Round to 2 decimals for tidy axis labels.
  return buckets.map((b) => ({ label: b.label, distance: Number(b.distance.toFixed(2)) }));
}

function paceOverTime(runs: Run[], units: Units) {
  // Oldest run first so the line moves left-to-right in time.
  const sorted = [...runs].sort((a, b) => (a.run_date < b.run_date ? -1 : 1));
  return sorted.map((r) => ({
    label: r.run_date.slice(5), // MM-DD
    pace: Math.round(paceSecondsPerUnit(r.distance_meters, r.duration_seconds, units)),
  }));
}

function parseDateKey(key: string): Date | null {
  // 'yyyy-MM-dd' parsed in the user's local TZ to avoid UTC off-by-one.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const [, y, mo, d] = m;
  if (!y || !mo || !d) return null;
  return new Date(Number(y), Number(mo) - 1, Number(d));
}

