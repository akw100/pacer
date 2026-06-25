import { useState } from 'react';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { useCreateGroup } from './useGroups';

interface CreateGroupSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function CreateGroupSheet({ open, onOpenChange, onCreated }: CreateGroupSheetProps) {
  const [name, setName] = useState('');
  const create = useCreateGroup();

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return toast.error('Name your group first');
    try {
      const group = await create.mutateAsync({ name: trimmed });
      toast.success(`Created "${group.name}"`);
      setName('');
      onOpenChange(false);
      onCreated?.(group.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create group');
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
          <Drawer.Title className="sr-only">Create a group</Drawer.Title>
          <div className="mx-auto my-2 h-1.5 w-10 rounded-pill bg-border md:hidden" />
          <header className="flex items-center justify-between px-5 pt-2 pb-3">
            <h2 className="font-display text-lg font-semibold text-ink">Create a group</h2>
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
              <span className="text-xs uppercase tracking-wide text-ink-muted">Group name</span>
              <input
                type="text"
                placeholder="Wasserman Family"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="bg-transparent w-full text-ink text-base focus:outline-none placeholder:text-ink-muted/50"
              />
            </label>
            <p className="text-xs text-ink-muted leading-relaxed">
              We'll generate a 6-letter invite code you can share. Anyone with the code can join.
              You stay the owner.
            </p>
            <button
              type="button"
              onClick={submit}
              disabled={create.isPending}
              className="rounded-pill bg-accent text-white py-3 text-sm font-semibold active:scale-[0.98] disabled:opacity-50 transition-transform"
            >
              {create.isPending ? 'Creating…' : 'Create group'}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
