import { useMyGroups } from '../groups/useGroups';

interface GroupSelectorProps {
  /** Null = personal only. */
  value: string | null;
  onChange: (value: string | null) => void;
}

/**
 * Compact, optional group share picker. Shown above every form in the
 * LogSheet. The default is "Personal only" — the activity is ALWAYS saved
 * to the user's own history; the group tag is purely additive.
 *
 * If the user belongs to no groups we render a quiet hint instead, so the
 * sheet stays focused on logging.
 */
export function GroupSelector({ value, onChange }: GroupSelectorProps) {
  const my = useMyGroups();
  const groups = my.data ?? [];

  if (my.isLoading) {
    return <div className="h-10 rounded-card bg-ink/5 animate-pulse" aria-hidden="true" />;
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border bg-surface px-4 py-3 text-xs text-ink-muted leading-relaxed">
        Join a group to compete with others — your activity stays in your personal history either way.
      </div>
    );
  }

  return (
    <fieldset
      aria-label="Count this activity in a group"
      className="rounded-card border border-border bg-surface px-4 py-3"
    >
      <legend className="text-xs uppercase tracking-wide text-ink-muted">Count in group</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        <Pill active={value === null} onClick={() => onChange(null)} label="Personal only" />
        {groups.map((g) => (
          <Pill
            key={g.id}
            active={value === g.id}
            onClick={() => onChange(g.id)}
            label={g.name}
          />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-ink-muted leading-snug">
        It's still saved to your personal history. The group tag just decides who else sees it.
      </p>
    </fieldset>
  );
}

function Pill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-accent bg-accent text-white'
          : 'border-border bg-surface text-ink hover:bg-ink/5'
      }`}
    >
      {label}
    </button>
  );
}
