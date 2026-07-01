import type { ReactionEmoji } from '@pacer/shared';
import { useReact } from '../groups/useGroups';
import type { RecentActivityItem } from './home.mock';

interface RecentActivityListProps {
  items: RecentActivityItem[];
  /** Group the feed items belong to — needed to post reactions. Null when the
   *  list is the personal fallback (own runs/workouts), which has no reactions. */
  groupId: string | null;
}

export function RecentActivityList({ items, groupId }: RecentActivityListProps) {
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
            <ActivityRow key={item.id} item={item} groupId={groupId} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityRow({ item, groupId }: { item: RecentActivityItem; groupId: string | null }) {
  const react = useReact(groupId);
  const canReact = !!item.target && !!groupId;

  function toggle(emoji: ReactionEmoji, on: boolean) {
    if (!item.target || !groupId) return;
    react.mutate({
      input: { emoji, target_type: item.target.type, target_id: item.target.id },
      on,
    });
  }

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
      {item.reactions.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-10">
          {item.reactions.map((r) => (
            <ReactionButton
              key={r.label}
              emoji={r.emoji as ReactionEmoji}
              label={r.label}
              count={r.count}
              mine={r.mine}
              onToggle={canReact ? (on) => toggle(r.emoji as ReactionEmoji, on) : undefined}
            />
          ))}
        </div>
      )}
    </li>
  );
}

function ReactionButton({
  emoji,
  label,
  count,
  mine,
  onToggle,
}: {
  emoji: string;
  label: string;
  count: number;
  mine: boolean;
  onToggle?: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={!onToggle}
      aria-label={`React with ${label} (${count})${mine ? ', added by you' : ''}`}
      aria-pressed={mine}
      onClick={() => onToggle?.(!mine)}
      className={`inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-xs font-medium transition-transform active:scale-95 disabled:active:scale-100 ${
        mine
          ? 'border-accent/40 bg-accent/10 text-accent'
          : 'border-border bg-surface text-ink hover:bg-ink/5'
      }`}
    >
      <span aria-hidden="true">{emoji}</span>
      <span className="tabular-nums text-ink-muted">{count}</span>
    </button>
  );
}
