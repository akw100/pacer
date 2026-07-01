import { useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useProfile } from '../auth/useProfile';
import { useFriendsList } from '../friends/useFriends';

/**
 * Resolve a display name for any race participant `user_id`.
 *
 * Race rows (`RaceParticipant`) carry only `user_id` — no profile join — so the
 * web resolves names from the same source the invite picker uses: the caller's
 * accepted-friends list (each carries the OTHER person's minimal profile) plus
 * the caller's own profile. Any id we can't resolve (e.g. a friend-of-a-friend
 * the caller can't see) falls back to a short, stable id stub so the row still
 * renders. "You" is surfaced for the current user for at-a-glance reading.
 */
export function useRaceNames(): {
  nameFor: (userId: string) => string;
  youId: string | null;
} {
  const youId = useAuth().session?.user.id ?? null;
  const { profile } = useProfile();
  const friends = useFriendsList();

  const byId = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of friends.data?.accepted ?? []) {
      map.set(f.other.id, f.other.display_name);
    }
    if (youId) map.set(youId, profile?.displayName ?? 'You');
    return map;
  }, [friends.data, youId, profile?.displayName]);

  const nameFor = (userId: string): string => {
    if (userId === youId) return 'You';
    return byId.get(userId) ?? `Runner ${userId.slice(0, 4)}`;
  };

  return { nameFor, youId };
}
