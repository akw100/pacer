import { useState } from 'react';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { JOIN_CODE_ALPHABET } from '@pacer/shared';
import { useJoinGroup } from './useGroups';

interface JoinGroupSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoined?: (id: string) => void;
}

const VALID_RE = /^[A-HJ-KMN-PR-TV-Z2-9]{6}$/;

export function JoinGroupSheet({ open, onOpenChange, onJoined }: JoinGroupSheetProps) {
  const [code, setCode] = useState('');
  const join = useJoinGroup();

  function format(input: string): string {
    // Filter to the allowed alphabet so paste of a "dirty" code still works.
    const cleaned = input
      .toUpperCase()
      .split('')
      .filter((c) => JOIN_CODE_ALPHABET.includes(c))
      .join('');
    return cleaned.slice(0, 6);
  }

  async function submit() {
    if (!VALID_RE.test(code)) return toast.error('Codes are 6 letters/digits');
    try {
      const g = await join.mutateAsync({ join_code: code });
      toast.success(`Joined "${g.name}"`);
      setCode('');
      onOpenChange(false);
      onJoined?.(g.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Group not found');
    }
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col rounded-t-card border border-border bg-surface md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:w-[24rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-card"
        >
          <Drawer.Title className="sr-only">Join a group</Drawer.Title>
          <div className="mx-auto my-2 h-1.5 w-10 rounded-pill bg-border md:hidden" />
          <header className="flex items-center justify-between px-5 pt-2 pb-3">
            <h2 className="font-display text-lg font-semibold text-ink">Join a group</h2>
            <button
              aria-label="Close"
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-pill text-ink-muted hover:text-ink hover:bg-ink/5"
            >
              <X size={18} strokeWidth={1.8} />
            </button>
          </header>
          <div className="px-5 pb-5 flex flex-col gap-4">
            <label className="flex flex-col gap-1 rounded-card border border-border bg-surface px-4 py-3">
              <span className="text-xs uppercase tracking-wide text-ink-muted">Invite code</span>
              <input
                inputMode="text"
                autoCapitalize="characters"
                placeholder="ABC234"
                value={code}
                onChange={(e) => setCode(format(e.target.value))}
                autoFocus
                className="bg-transparent w-full text-ink text-2xl font-display font-bold tracking-[0.4em] uppercase focus:outline-none placeholder:text-ink-muted/40"
              />
            </label>
            <p className="text-xs text-ink-muted leading-relaxed">
              Codes are 6 characters — letters and digits, no zeros or ones, just to keep them
              easy to read aloud.
            </p>
            <button
              type="button"
              onClick={submit}
              disabled={join.isPending}
              className="rounded-pill bg-accent text-white py-3 text-sm font-semibold active:scale-[0.98] disabled:opacity-50 transition-transform"
            >
              {join.isPending ? 'Joining…' : 'Join'}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
