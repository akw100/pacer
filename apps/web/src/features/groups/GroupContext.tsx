import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// Thin shared seam between the Groups page and the LogSheet:
//   - When the user is on a Group page, that group becomes the "active" one.
//   - Opening the LogSheet from anywhere reads this active group and uses it
//     as the default share target (with "Personal only" still one tap away).
//   - When the user navigates away from a group, the active group clears so
//     the FAB's next open defaults back to Personal.
//
// We persist the LAST manually-confirmed group selection in localStorage too,
// per the card's "use last selected group if that pattern already exists"
// directive — so users who tend to share to the same group don't have to
// re-pick it every time.

const LAST_GROUP_KEY = 'pacer:last-shared-group-id';

interface GroupContextValue {
  /** Group currently in focus on the page (read-only by the LogSheet). */
  activeGroupId: string | null;
  setActiveGroupId: (id: string | null) => void;
  /** Most recent group the user explicitly shared to. Used as a fallback default. */
  lastSharedGroupId: string | null;
  rememberLastShared: (id: string | null) => void;
}

const GroupContext = createContext<GroupContextValue | null>(null);

export function GroupProvider({ children }: { children: ReactNode }) {
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [lastSharedGroupId, setLastSharedGroupId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LAST_GROUP_KEY);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (lastSharedGroupId) window.localStorage.setItem(LAST_GROUP_KEY, lastSharedGroupId);
    else window.localStorage.removeItem(LAST_GROUP_KEY);
  }, [lastSharedGroupId]);

  return (
    <GroupContext.Provider
      value={{
        activeGroupId,
        setActiveGroupId,
        lastSharedGroupId,
        rememberLastShared: setLastSharedGroupId,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
}

export function useGroupContext(): GroupContextValue {
  const ctx = useContext(GroupContext);
  if (!ctx) {
    // Soft fallback so the LogSheet/Form can render outside the provider
    // (e.g. in unit tests). Reads are always null; writes are no-ops.
    return {
      activeGroupId: null,
      setActiveGroupId: () => {},
      lastSharedGroupId: null,
      rememberLastShared: () => {},
    };
  }
  return ctx;
}
