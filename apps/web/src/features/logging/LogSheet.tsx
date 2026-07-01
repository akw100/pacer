import { useEffect, useState } from 'react';
import { Drawer } from '../../components/drawer';
import { X } from 'lucide-react';
import type { Run, Units } from '@pacer/shared';
import { RunForm } from './RunForm';
import { WorkoutForm } from './WorkoutForm';
import { GroupSelector } from './GroupSelector';
import { useGroupContext } from '../groups/GroupContext';

// Vaul `Drawer` is a native-feeling bottom sheet on phones AND a centered
// overlay on desktop — we add a `md:` width cap so it doesn't span the screen.
//
// Mounting model: a single <LogSheetMount /> lives at the app root and listens
// for `window` events. The FAB / any caller dispatches the event; they don't
// import this file.

type Tab = 'run' | 'workout' | 'habits';

const OPEN_EVENT = 'pacer:open-log';

interface OpenDetail {
  tab?: Tab;
  editRun?: Run;
  /** Pre-select a group for the "Count in group" picker. Pass null/undefined for personal default. */
  groupId?: string | null;
}

/** Open the Log sheet from anywhere — e.g. the floating + button. */
export function openLogSheet(detail: OpenDetail = {}): void {
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

interface LogSheetMountProps {
  /** Profile unit preference; pass through your useProfile() hook when ready. */
  units?: Units;
}

/** Mount once near the app root. Listens for openLogSheet() calls. */
export function LogSheetMount({ units = 'km' }: LogSheetMountProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('run');
  const [editRun, setEditRun] = useState<Run | undefined>(undefined);
  const { activeGroupId, lastSharedGroupId, rememberLastShared } = useGroupContext();
  // null = "Personal only" (the safe default per the card).
  const [sharedGroupId, setSharedGroupId] = useState<string | null>(null);

  useEffect(() => {
    function onOpen(e: Event) {
      const ce = e as CustomEvent<OpenDetail>;
      setTab(ce.detail?.tab ?? 'run');
      setEditRun(ce.detail?.editRun);
      // Priority of group default on open:
      //   1. explicit groupId in the open call (e.g. "Log to group" CTA)
      //   2. group the user is currently viewing
      //   3. last group they explicitly shared to (sticky for repeat use)
      //   4. null = personal only (safe default, never silently shares)
      const explicit = ce.detail && 'groupId' in ce.detail ? ce.detail.groupId ?? null : undefined;
      const next =
        explicit !== undefined ? explicit : activeGroupId ?? lastSharedGroupId ?? null;
      setSharedGroupId(next);
      setOpen(true);
    }
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [activeGroupId, lastSharedGroupId]);

  function handleShareChange(next: string | null) {
    setSharedGroupId(next);
    rememberLastShared(next);
  }

  const close = () => {
    setOpen(false);
    setEditRun(undefined);
  };

  return (
    <Drawer.Root open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col rounded-t-card border border-border bg-surface md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:w-[28rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-card"
          aria-describedby={undefined}
        >
          <Drawer.Title className="sr-only">Log activity</Drawer.Title>
          {/* Grip handle for the phone sheet */}
          <div className="mx-auto my-2 h-1.5 w-10 rounded-pill bg-border md:hidden" />

          <header className="flex items-center justify-between px-5 pt-2 pb-3">
            <Segmented tab={tab} setTab={setTab} editing={!!editRun} />
            <button
              aria-label="Close"
              onClick={close}
              className="p-1.5 rounded-pill text-ink-muted hover:text-ink hover:bg-ink/5"
            >
              <X size={18} strokeWidth={1.8} />
            </button>
          </header>

          <div className="overflow-y-auto px-5 pb-4 flex flex-col gap-4 max-h-[calc(90vh-3.5rem)]">
            {tab !== 'habits' && (
              <GroupSelector value={sharedGroupId} onChange={handleShareChange} />
            )}
            {tab === 'run' && (
              <RunForm
                units={units}
                initial={editRun}
                sharedGroupId={sharedGroupId}
                onDone={close}
              />
            )}
            {tab === 'workout' && !editRun && (
              <WorkoutForm sharedGroupId={sharedGroupId} onDone={close} />
            )}
            {tab === 'habits' && <HabitsTabSlot />}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** Empty placeholder for the Habits slice card to fill in. We never build habit logic here. */
export function HabitsTabSlot() {
  return (
    <div className="grid place-items-center py-12 text-center text-sm text-ink-muted">
      Habits are tracked elsewhere — see the Habits card.
    </div>
  );
}

function Segmented({
  tab,
  setTab,
  editing,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  editing: boolean;
}) {
  const tabs: Tab[] = ['run', 'workout', 'habits'];
  return (
    <div className="inline-flex rounded-pill border border-border bg-surface p-0.5">
      {tabs.map((t) => {
        const active = tab === t;
        const disabled = editing && t !== 'run';
        return (
          <button
            key={t}
            type="button"
            disabled={disabled}
            onClick={() => setTab(t)}
            className={`rounded-pill px-3 py-1 text-xs font-medium capitalize transition-colors ${
              active ? 'bg-ink text-surface' : 'text-ink-muted hover:text-ink'
            } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}
