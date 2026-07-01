import { useState } from 'react';
import { Drawer } from '../../components/drawer';
import { toast } from 'sonner';
import { LogOut, Pencil, RefreshCw, X } from 'lucide-react';
import type { Group } from '@pacer/shared';
import { useLeaveGroup, useRenameGroup } from './useGroups';

// Manage Group sheet. Available to every member of a group:
//   - Member: Leave group
//   - Owner: + Rename, Regenerate invite code
//
// Group deletion and ownership transfer are NOT implemented in the API yet
// (see PR description "missing backend contracts"). We intentionally do NOT
// hack a "leave as owner ⇒ delete cascade" path here — that's a separate
// safety-sensitive change.

interface ManageGroupSheetProps {
  group: Group;
  isOwner: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful leave so the parent can navigate back to the Hub. */
  onLeft?: () => void;
}

export function ManageGroupSheet({
  group,
  isOwner,
  open,
  onOpenChange,
  onLeft,
}: ManageGroupSheetProps) {
  const rename = useRenameGroup(group.id);
  const leave = useLeaveGroup();
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(group.name);
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  async function commitRename() {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === group.name) {
      setEditingName(false);
      return;
    }
    try {
      await rename.mutateAsync({ name: trimmed });
      toast.success('Renamed');
      setEditingName(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rename failed');
    }
  }

  async function regenerate() {
    try {
      await rename.mutateAsync({ regenerate_code: true });
      toast.success('New invite code');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not regenerate');
    }
  }

  async function leaveGroup() {
    try {
      await leave.mutateAsync(group.id);
      toast.success(`Left "${group.name}"`);
      onOpenChange(false);
      onLeft?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not leave');
    } finally {
      setConfirmingLeave(false);
    }
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col rounded-t-card border border-border bg-surface md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:w-[26rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-card"
        >
          <Drawer.Title className="sr-only">Manage {group.name}</Drawer.Title>
          <div className="mx-auto my-2 h-1.5 w-10 rounded-pill bg-border md:hidden" />
          <header className="flex items-center justify-between px-5 pt-2 pb-3">
            <h2 className="font-display text-lg font-semibold text-ink">Manage group</h2>
            <button
              aria-label="Close"
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-pill text-ink-muted hover:text-ink hover:bg-ink/5"
            >
              <X size={18} strokeWidth={1.8} />
            </button>
          </header>

          <div className="px-5 pb-4 flex flex-col gap-3">
            {/* Owner: rename */}
            {isOwner && (
              <div className="rounded-card border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-wide text-ink-muted">Group name</span>
                  {!editingName && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftName(group.name);
                        setEditingName(true);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-accent"
                    >
                      <Pencil size={12} strokeWidth={2} />
                      Rename
                    </button>
                  )}
                </div>
                {editingName ? (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void commitRename();
                        else if (e.key === 'Escape') setEditingName(false);
                      }}
                      className="flex-1 rounded-pill border border-border bg-surface px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={commitRename}
                      disabled={rename.isPending}
                      className="rounded-pill bg-accent text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 font-display text-base font-semibold text-ink truncate">
                    {group.name}
                  </div>
                )}
              </div>
            )}

            {/* Owner: regenerate code */}
            {isOwner && (
              <button
                type="button"
                onClick={regenerate}
                disabled={rename.isPending}
                className="rounded-card border border-border bg-surface px-4 py-3 text-left hover:bg-ink/5 flex items-center gap-3"
              >
                <span className="grid place-items-center w-9 h-9 rounded-pill bg-ink/5 text-ink shrink-0">
                  <RefreshCw size={14} strokeWidth={1.8} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-sm font-semibold text-ink">
                    Regenerate invite code
                  </div>
                  <div className="text-xs text-ink-muted leading-snug">
                    Old code stops working. Useful if someone shared it too widely.
                  </div>
                </div>
              </button>
            )}

            {/* Anyone: leave group */}
            {confirmingLeave ? (
              <div className="rounded-card border border-accent/40 bg-accent/5 p-4">
                <div className="font-display text-sm font-semibold text-ink">
                  Leave "{group.name}"?
                </div>
                <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                  Your past runs and workouts stay with you. They just stop counting for this
                  group's leaderboard. You can re-join later with the invite code.
                </p>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingLeave(false)}
                    className="rounded-pill px-3 py-1.5 text-xs text-ink-muted hover:bg-ink/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={leaveGroup}
                    disabled={leave.isPending}
                    className="rounded-pill bg-accent text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    {leave.isPending ? 'Leaving…' : 'Leave'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingLeave(true)}
                className="rounded-card border border-border bg-surface px-4 py-3 text-left hover:bg-accent/5 flex items-center gap-3"
              >
                <span className="grid place-items-center w-9 h-9 rounded-pill bg-accent/10 text-accent shrink-0">
                  <LogOut size={14} strokeWidth={1.8} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-sm font-semibold text-ink">Leave group</div>
                  <div className="text-xs text-ink-muted leading-snug">
                    Your personal history is untouched.
                  </div>
                </div>
              </button>
            )}

            {isOwner && (
              <p className="text-[11px] text-ink-muted leading-relaxed mt-1">
                Delete group and transfer ownership aren't built yet. Ask the team if you need them.
              </p>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
