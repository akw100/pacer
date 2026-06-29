import {
  formatDuration,
  metersToDisplayDistance,
  type Units,
  type ReactionEmoji,
} from '@pacer/shared';
import { Dumbbell, Footprints } from 'lucide-react';
import type { GroupFeedItem } from './useGroups';
import { useReact } from './useGroups';

interface FeedCardProps {
  groupId: string;
  items: GroupFeedItem[] | undefined;
  loading: boolean;
  units: Units;
}

export function FeedCard({ groupId, items, loading, units }: FeedCardProps) {
  if (loading) return <Skeleton />;

  return (
    <section
      aria-labelledby="feed-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-4"
    >
      <header className="flex items-center justify-between">
        <h2 id="feed-heading" className="font-display text-lg font-semibold text-ink">
          Group feed
        </h2>
        <span className="text-xs text-ink-muted">{(items ?? []).length} items</span>
      </header>

      {!items || items.length === 0 ? (
        <p className="text-sm text-ink-muted leading-relaxed">
          Activity tagged to this group shows up here. Log a run and tick the group to start a
          thread.
        </p>
      ) : (
        <ul role="list" className="flex flex-col gap-3">
          {items.map((item) => (
            <FeedRow key={`${item.kind}:${item.id}`} item={item} groupId={groupId} units={units} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FeedRow({
  item,
  groupId,
  units,
}: {
  item: GroupFeedItem;
  groupId: string;
  units: Units;
}) {
  const react = useReact(groupId);

  function toggle(emoji: ReactionEmoji, on: boolean) {
    react.mutate({
      input: {
        emoji,
        target_type: item.kind === 'run' ? 'run' : 'workout',
        target_id: item.id,
      },
      on,
    });
  }

  const ago = relativeFrom(item.created_at);

  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid place-items-center w-10 h-10 rounded-full bg-ink/5 shrink-0 text-base"
        >
          {item.avatar_emoji ?? (item.kind === 'run' ? '🏃' : '🏋️')}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink leading-snug">
            <span className="font-semibold">{item.display_name}</span>{' '}
            <span>{describeItem(item, units)}</span>
            <span className="text-ink-muted"> · {ago}</span>
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
            <span aria-hidden="true">
              {item.kind === 'run' ? <Footprints size={12} strokeWidth={1.8} /> : <Dumbbell size={12} strokeWidth={1.8} />}
            </span>
            <span>{item.occurred_on}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-13">
        {item.reactions.map((r) => (
          <ReactionButton
            key={r.emoji}
            emoji={r.emoji as ReactionEmoji}
            count={r.count}
            mine={r.reacted_by_me}
            onToggle={(on) => toggle(r.emoji as ReactionEmoji, on)}
          />
        ))}
      </div>
    </li>
  );
}

function describeItem(item: GroupFeedItem, units: Units): string {
  if (item.kind === 'run' && item.distance_meters && item.duration_seconds) {
    const { value, unit } = metersToDisplayDistance(item.distance_meters, units);
    return `logged a ${value.toFixed(1)} ${unit} run in ${formatDuration(item.duration_seconds)}`;
  }
  if (item.kind === 'workout') {
    return `completed "${item.name ?? 'a workout'}" (${item.workout_kind ?? ''})`;
  }
  return 'logged an activity';
}

function ReactionButton({
  emoji,
  count,
  mine,
  onToggle,
}: {
  emoji: ReactionEmoji;
  count: number;
  mine: boolean;
  onToggle: (next: boolean) => void;
}) {
  const label = emoji === '👏' ? 'Clap' : emoji === '🔥' ? 'Fire' : 'Strong';
  return (
    <button
      type="button"
      aria-label={`${label} (${count})${mine ? ', added by you' : ''}`}
      onClick={() => onToggle(!mine)}
      className={`inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-xs font-medium transition-colors ${
        mine
          ? 'border-accent/40 bg-accent/10 text-accent'
          : 'border-border bg-surface text-ink hover:bg-ink/5'
      }`}
    >
      <span aria-hidden="true">{emoji}</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

function Skeleton() {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-sm">
      <div className="h-5 w-24 rounded bg-ink/10 animate-pulse" />
      <div className="mt-4 space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-16 rounded-card bg-ink/5 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function relativeFrom(iso: string): string {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return '';
  const diffMs = Date.now() - created;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
