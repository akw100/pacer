import { Link } from 'react-router';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useFriendsLeaderboard } from './useFriends';

// Compact "Add friend" pill for the Home dashboard. Renders ONLY when the
// caller has zero accepted friends — otherwise returns null and takes no
// vertical space. Replaces the previous full-height empty-state card that
// used to render inside FriendsStandingCard.
//
// The button navigates to /profile, the same destination the old empty-
// state card and the current "Manage" link both use. No new route, no
// new backend surface.

export function AddFriendInline() {
  const { session } = useAuth();
  const callerId = session?.user.id ?? null;
  const lb = useFriendsLeaderboard();

  // Loading / error / no data: render nothing. This intentionally avoids a
  // flash of the button while the leaderboard is being fetched — the
  // FriendsStandingCard chart resolves the same query, so once data lands
  // exactly one of (chart, button, nothing) renders.
  if (lb.isLoading || lb.isError || !lb.data) return null;

  // The API always includes the caller in the leaderboard row set. Any
  // other row is an accepted friend. If any friend exists, don't render.
  const friendCount = lb.data.leaderboard.filter((r) => r.user_id !== callerId).length;
  if (friendCount > 0) return null;

  return (
    <div className="flex justify-end -mt-1">
      <Link
        to="/profile"
        aria-label="Add a friend"
        className="inline-flex items-center gap-1.5 rounded-pill bg-accent text-white px-3 py-1.5 text-xs font-semibold shadow-sm shadow-accent/20 hover:bg-accent/90 transition-colors"
      >
        <UserPlus size={12} strokeWidth={2.2} />
        Add friend
      </Link>
    </div>
  );
}
