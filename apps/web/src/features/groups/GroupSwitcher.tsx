import { Plus } from 'lucide-react';
import type { GroupListItem } from './useGroups';

interface GroupSwitcherProps {
  groups: GroupListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddGroup: () => void;
}

export function GroupSwitcher({ groups, selectedId, onSelect, onAddGroup }: GroupSwitcherProps) {
  if (groups.length === 0) return null;

  return (
    <nav
      aria-label="Your groups"
      className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4"
    >
      {groups.map((g) => {
        const active = g.id === selectedId;
        const initial = g.name.charAt(0).toUpperCase();
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelect(g.id)}
            aria-pressed={active}
            className={`shrink-0 inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border bg-surface text-ink hover:bg-ink/5'
            }`}
          >
            <span
              aria-hidden="true"
              className={`grid place-items-center w-6 h-6 rounded-full text-xs font-bold ${
                active ? 'bg-accent text-white' : 'bg-ink/10 text-ink'
              }`}
            >
              {initial}
            </span>
            <span className="truncate max-w-[10rem]">{g.name}</span>
            <span className={`text-xs ${active ? 'text-accent/70' : 'text-ink-muted'}`}>
              {g.member_count}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAddGroup}
        aria-label="Add a group"
        className="shrink-0 inline-flex items-center gap-1 rounded-pill border border-dashed border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink-muted hover:text-ink hover:bg-ink/5"
      >
        <Plus size={14} strokeWidth={2} />
        Add
      </button>
    </nav>
  );
}
