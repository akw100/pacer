import { useState } from 'react';
import { Drawer } from 'vaul';
import { Copy, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { Group } from '@pacer/shared';
import { useRenameGroup } from './useGroups';

interface InviteSheetProps {
  group: Group;
  isOwner: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteSheet({ group, isOwner, open, onOpenChange }: InviteSheetProps) {
  const rename = useRenameGroup(group.id);
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(group.join_code);
      setCopied(true);
      toast.success('Code copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copy failed');
    }
  }

  async function regenerate() {
    try {
      await rename.mutateAsync({ regenerate_code: true });
      toast.success('New code generated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate');
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
          <Drawer.Title className="sr-only">Invite to {group.name}</Drawer.Title>
          <div className="mx-auto my-2 h-1.5 w-10 rounded-pill bg-border md:hidden" />
          <header className="flex items-center justify-between px-5 pt-2 pb-3">
            <h2 className="font-display text-lg font-semibold text-ink">Invite to {group.name}</h2>
            <button
              aria-label="Close"
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-pill text-ink-muted hover:text-ink hover:bg-ink/5"
            >
              <X size={18} strokeWidth={1.8} />
            </button>
          </header>
          <div className="px-5 pb-5 flex flex-col gap-4">
            <div className="rounded-card border border-accent/30 bg-accent/5 p-5 flex flex-col items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-accent">Invite code</span>
              <span className="font-display text-4xl font-bold text-ink tracking-[0.3em]">
                {group.join_code}
              </span>
              <button
                type="button"
                onClick={copyCode}
                className="mt-2 inline-flex items-center gap-1.5 rounded-pill bg-accent px-4 py-2 text-sm font-medium text-white"
              >
                <Copy size={14} strokeWidth={2} />
                {copied ? 'Copied!' : 'Copy code'}
              </button>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed text-center">
              Share this code. Anyone who taps "Enter code" in their Groups tab can join.
            </p>
            {isOwner && (
              <button
                type="button"
                onClick={regenerate}
                disabled={rename.isPending}
                className="self-center inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
              >
                <RefreshCw size={12} strokeWidth={1.8} />
                Regenerate code
              </button>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
