import type { RecentActivityItem } from './home.mock';

interface RecentActivityListProps {
  items: RecentActivityItem[];
}

export function RecentActivityList({ items }: RecentActivityListProps) {
  return (
    <section
      aria-labelledby="recent-activity-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-3"
    >
      <header className="flex items-center justify-between">
        <h2 id="recent-activity-heading" className="font-display text-lg font-semibold text-ink">
          Recent activity
        </h2>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-ink-muted leading-relaxed">
          Log a run or workout to see it appear here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" role="list">
          {items.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityRow({ item }: { item: RecentActivityItem }) {
  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className="grid place-items-center w-8 h-8 rounded-pill bg-ink/5 text-ink-muted text-xs font-semibold shrink-0">
          {item.actorName.charAt(0)}
        </span>
        <p className="text-sm text-ink leading-snug">
          <span className="font-semibold">{item.actorName}</span>{' '}
          <span className="text-ink">{item.description}</span>
          <span className="text-ink-muted"> · {item.ago}</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2 pl-10">
        {item.reactions.map((r) => (
          <ReactionButton key={r.label} emoji={r.emoji} label={r.label} count={r.count} />
        ))}
      </div>
    </li>
  );
}

function ReactionButton({
  emoji,
  label,
  count,
}: {
  emoji: string;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      aria-label={`React with ${label} (${count})`}
      className="inline-flex items-center gap-1 rounded-pill border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-ink/5 active:scale-95 transition-transform"
    >
      <span aria-hidden="true">{emoji}</span>
      <span className="tabular-nums text-ink-muted">{count}</span>
    </button>
  );
}
