import { useState } from 'react';
import { Button } from '../../components/Button';
import { useAuth } from './AuthProvider';

// Page 0 (docs/02-PAGES-UX.md §0): a single card — logo, one-line value prop,
// "Continue with Google" as the primary action. Email fallback is a later card.
export default function SignInPage() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      // On success the browser redirects to Google; nothing else to do here.
    } catch {
      setError('Could not start Google sign-in. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-6">
      <div className="w-full max-w-sm rounded-card border border-border bg-surface p-8 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">Pacer</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Track workouts. Compete with your family.
        </p>

        <Button
          onClick={onGoogle}
          disabled={busy}
          className="mt-8 w-full"
        >
          {busy ? 'Connecting…' : 'Continue with Google'}
        </Button>

        {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      </div>
    </div>
  );
}
