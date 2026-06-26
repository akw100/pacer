import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../auth/AuthProvider';

// Step 4: pick habits. Stretching + Nutrition are pre-checked per the UX
// doc. "+ Add custom" inserts a new row inline. Finish → POST /habits for
// every selected row, then call onFinish to mark onboarding complete.

interface HabitRow {
  id: string;
  name: string;
  emoji: string;
  checked: boolean;
}

const DEFAULTS: HabitRow[] = [
  { id: 'stretching', name: 'Stretching', emoji: '🧘', checked: true },
  { id: 'nutrition', name: 'Nutrition', emoji: '🥗', checked: true },
  { id: 'hydration', name: 'Hydration', emoji: '🥤', checked: false },
  { id: 'sleep', name: 'Sleep', emoji: '😴', checked: false },
];

interface StepHabitsProps {
  onFinish: () => Promise<void> | void;
}

export function StepHabits({ onFinish }: StepHabitsProps) {
  const { session } = useAuth();
  const [rows, setRows] = useState<HabitRow[]>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  function toggle(id: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r)));
  }

  function addCustom() {
    const name = draft.trim();
    if (!name) return;
    setRows((rs) => [
      ...rs,
      { id: `custom-${rs.length}`, name, emoji: '✨', checked: true },
    ]);
    setDraft('');
    setAdding(false);
  }

  function remove(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  async function finish() {
    const token = session?.access_token;
    if (!token) return;
    setBusy(true);
    const selected = rows.filter((r) => r.checked);
    try {
      // Fire-and-forget creates. A failed habit (e.g. duplicate) shouldn't
      // block onboarding completion; the user can edit habits later anyway.
      await Promise.allSettled(
        selected.map((r, i) =>
          apiFetch('/habits', {
            token,
            method: 'POST',
            body: { name: r.name, emoji: r.emoji, sort: i },
          }),
        ),
      );
      await onFinish();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save habits');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h2 className="font-display text-2xl font-bold text-ink">Pick your rituals</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Tiny daily wins build the streak. Toggle what fits you — change them any time.
        </p>
      </header>

      <ul role="list" className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id}>
            <label className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 cursor-pointer hover:bg-ink/5">
              <span aria-hidden="true" className="text-xl">{r.emoji}</span>
              <span className="flex-1 text-sm font-medium text-ink">{r.name}</span>
              {r.id.startsWith('custom-') && (
                <button
                  type="button"
                  aria-label={`Remove ${r.name}`}
                  onClick={(e) => {
                    e.preventDefault();
                    remove(r.id);
                  }}
                  className="p-1.5 rounded-pill text-ink-muted hover:text-accent hover:bg-accent/10"
                >
                  <X size={14} strokeWidth={1.8} />
                </button>
              )}
              <span
                role="checkbox"
                aria-checked={r.checked}
                className={`relative inline-block w-10 h-6 rounded-pill transition-colors ${
                  r.checked ? 'bg-accent' : 'bg-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                    r.checked ? 'translate-x-4' : ''
                  }`}
                />
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={r.checked}
                onChange={() => toggle(r.id)}
              />
            </label>
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            autoFocus
            placeholder="e.g. 10k steps"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addCustom();
              else if (e.key === 'Escape') {
                setAdding(false);
                setDraft('');
              }
            }}
            className="flex-1 rounded-pill border border-border bg-surface px-4 py-2 text-sm text-ink focus:outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={addCustom}
            className="rounded-pill bg-accent text-white px-3 py-1.5 text-sm font-medium"
          >
            Add
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="self-start inline-flex items-center gap-1 rounded-pill border border-dashed border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
        >
          <Plus size={14} strokeWidth={2} />
          Add custom
        </button>
      )}

      <button
        type="button"
        onClick={finish}
        disabled={busy}
        className="rounded-pill bg-accent text-white py-3 text-sm font-semibold disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Finish & go to Home'}
      </button>
    </div>
  );
}
