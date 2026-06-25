import { useProfile } from '../auth/useProfile';
import { useAuth } from '../auth/AuthProvider';
import { useGroupContext } from './GroupContext';
import { GroupsHub } from './GroupsHub';
import { GroupDetail } from './GroupDetail';

// Top-level Group screen — a thin router between two views:
//   - GroupsHub: list of every group as a card (entry view).
//   - GroupDetail: single-group dashboard (after the user picks a card).
//
// We track the currently-open group in GroupContext rather than the URL so
// the LogSheet's "Count in group" selector preselects the same group when
// opened mid-detail. The shell route is just `/group` — we do NOT need a
// react-router route per group for this UX.

export function GroupsPage() {
  const { profile } = useProfile();
  const { session } = useAuth();
  const youUserId = session?.user.id ?? null;
  const units = profile?.units ?? 'km';

  const { activeGroupId, setActiveGroupId } = useGroupContext();

  if (activeGroupId) {
    return (
      <GroupDetail
        groupId={activeGroupId}
        youUserId={youUserId}
        units={units}
        onBack={() => setActiveGroupId(null)}
      />
    );
  }

  return (
    <GroupsHub
      youUserId={youUserId}
      units={units}
      onOpenGroup={setActiveGroupId}
    />
  );
}
