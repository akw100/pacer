import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Users } from 'lucide-react';
import { apiFetch, ApiError } from '../../../lib/api';
import { useAuth } from '../../auth/AuthProvider';
import { SegmentedCodeInput } from '../SegmentedCodeInput';

// Step 2: enter an invite code or create a group. Skippable.
// Calls /groups/join and /groups — both POSTs. If the groups endpoints aren't
// merged yet (separate slice), the user sees an inline error and can still skip.

type Mode = 'choose' | 'enter' | 'create' | 'created';

interface StepGroupProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function StepGroup({ onComplete, onSkip }: StepGroupProps) {
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>('choose');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const token = session?.access_token ?? null;

  async function join() {
    if (!token || code.length !== 6) return;
    setBusy(true);
    try {
      await apiFetch<unknown>('/groups/join', {
        token,
        method: 'POST',
        body: { join_code: code },
      });
      toast.success('Joined!');
      onComplete();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        toast.error("That code didn't match a group.");
      } else {
        toast.error('Could not join. Try again or skip for now.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!token || name.trim().length === 0) return;
    setBusy(true);
    try {
      const group = await apiFetch<{ join_code: string }>('/groups', {
        token,
        method: 'POST',
        body: { name: name.trim() },
      });
      setCreatedCode(group.join_code);
      setMode('created');
    } catch {
      toast.error('Could not create. Try again or skip for now.');
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!createdCode) return;
    try {
      await navigator.clipboard.writeText(createdCode);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Header
        title="Join your people"
        sub="Pacer is more fun together — pop in a code from family, or start a group of your own."
      />

      {mode === 'choose' && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setMode('enter')}
            className="rounded-card border border-border bg-surface px-4 py-4 text-left hover:bg-ink/5"
          >
            <div className="font-display text-base font-semibold text-ink">Have a code?</div>
            <div className="text-sm text-ink-muted">Enter a 6-letter invite code.</div>
          </button>
          <button
            type="button"
            onClick={() => setMode('create')}
            className="rounded-card border border-border bg-surface px-4 py-4 text-left hover:bg-ink/5"
          >
            <div className="font-display text-base font-semibold text-ink">Create a group</div>
            <div className="text-sm text-ink-muted">We'll give you a code to share.</div>
          </button>
        </div>
      )}

      {mode === 'enter' && (
        <div className="flex flex-col gap-4">
          <SegmentedCodeInput value={code} onChange={setCode} autoFocus />
          <button
            type="button"
            onClick={join}
            disabled={busy || code.length !== 6}
            className="rounded-pill bg-accent text-white py-3 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? 'Joining…' : 'Join group'}
          </button>
          <button
            type="button"
            onClick={() => setMode('choose')}
            className="text-xs text-ink-muted hover:text-ink"
          >
            Back
          </button>
        </div>
      )}

      {mode === 'create' && (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 rounded-card border border-border bg-surface px-4 py-3">
            <span className="text-xs uppercase tracking-wide text-ink-muted">Group name</span>
            <input
              type="text"
              autoFocus
              placeholder="Wasserman Family"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-transparent w-full text-ink text-base focus:outline-none placeholder:text-ink-muted/50"
            />
          </label>
          <button
            type="button"
            onClick={create}
            disabled={busy || name.trim().length === 0}
            className="rounded-pill bg-accent text-white py-3 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create group'}
          </button>
          <button
            type="button"
            onClick={() => setMode('choose')}
            className="text-xs text-ink-muted hover:text-ink"
          >
            Back
          </button>
        </div>
      )}

      {mode === 'created' && createdCode && (
        <div className="flex flex-col gap-4 items-center">
          <span className="grid place-items-center w-12 h-12 rounded-full bg-accent/10 text-accent">
            <Users size={20} strokeWidth={1.8} />
          </span>
          <div className="text-center">
            <div className="font-display text-lg font-semibold text-ink">Share this code</div>
            <div className="text-sm text-ink-muted">Anyone with it can join your group.</div>
          </div>
          <div className="font-display text-4xl font-bold text-ink tracking-[0.4em]">
            {createdCode}
          </div>
          <button
            type="button"
            onClick={copyCode}
            className="inline-flex items-center gap-1.5 rounded-pill bg-accent text-white px-4 py-2 text-sm font-medium"
          >
            <Copy size={14} strokeWidth={2} />
            Copy code
          </button>
          <button
            type="button"
            onClick={onComplete}
            className="rounded-pill border border-border bg-surface px-4 py-2 text-sm font-medium text-ink"
          >
            Continue
          </button>
        </div>
      )}

      {mode !== 'created' && (
        <button
          type="button"
          onClick={onSkip}
          className="self-center text-xs text-ink-muted hover:text-ink"
        >
          Skip for now
        </button>
      )}
    </div>
  );
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <header>
      <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink-muted">{sub}</p>
    </header>
  );
}
