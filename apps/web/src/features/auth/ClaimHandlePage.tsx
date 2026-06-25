import { useState, type FormEvent } from 'react';
import { ProfileSchema } from '@pacer/shared';
import { Button } from '../../components/Button';
import { apiFetch, ApiError } from '../../lib/api';
import { useAuth } from './AuthProvider';
import { useProfile } from './useProfile';

// Onboarding step 1 (docs/02-PAGES-UX.md §1): claim a handle + display name.
// Handle format is validated live against the shared schema; availability is
// confirmed on save (a unique-violation comes back as an inline error — the API
// has no separate availability endpoint).
const handleSchema = ProfileSchema.shape.handle;

export default function ClaimHandlePage() {
  const { session } = useAuth();
  const { refetch } = useProfile();

  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleResult = handleSchema.safeParse(handle);
  const handleValid = handleResult.success;
  const formValid = handleValid && displayName.trim().length > 0;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formValid || !session) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/profile/me', {
        token: session.access_token,
        method: 'PATCH',
        body: { handle, displayName: displayName.trim() },
      });
      refetch(); // status flips to 'ready' → the guard routes to Home.
    } catch (err) {
      setSaving(false);
      if (err instanceof ApiError && (err.status === 409 || err.status === 400)) {
        setError('That handle is taken — try another.');
      } else {
        setError('Could not save. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-card border border-border bg-surface p-8"
      >
        <h1 className="font-display text-2xl font-bold text-ink">
          Claim your handle
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          This is how your family will see you.
        </p>

        <label className="mt-6 block text-sm font-medium text-ink" htmlFor="handle">
          Handle
        </label>
        <div className="mt-1 flex items-center rounded-pill border border-border bg-surface px-4 focus-within:border-accent">
          <span className="text-ink-muted">@</span>
          <input
            id="handle"
            value={handle}
            onChange={(e) =>
              setHandle(e.target.value.toLowerCase().replace(/\s/g, ''))
            }
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="your_handle"
            className="w-full bg-transparent py-2.5 pl-1 text-ink outline-none placeholder:text-ink-muted"
          />
        </div>
        {handle.length > 0 && !handleValid && (
          <p className="mt-1.5 text-xs text-ink-muted">
            3–20 characters: lowercase letters, numbers, and underscores only.
          </p>
        )}

        <label
          className="mt-5 block text-sm font-medium text-ink"
          htmlFor="displayName"
        >
          Display name
        </label>
        <input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
          className="mt-1 w-full rounded-pill border border-border bg-surface px-4 py-2.5 text-ink outline-none placeholder:text-ink-muted focus:border-accent"
        />

        <Button type="submit" disabled={!formValid || saving} className="mt-7 w-full">
          {saving ? 'Saving…' : 'Continue'}
        </Button>

        {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      </form>
    </div>
  );
}
