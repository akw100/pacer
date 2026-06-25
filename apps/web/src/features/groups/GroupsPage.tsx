import { useEffect, useState } from 'react';
import { Share2, Trophy, Users } from 'lucide-react';
import { useProfile } from '../auth/useProfile';
import { useAuth } from '../auth/AuthProvider';
import { openLogSheet } from '../logging/LogSheet';
import { useGroupContext } from './GroupContext';
import {
  useGroupDetail,
  useGroupFeed,
  useGroupRealtime,
  useGroupStats,
  useMyGroups,
} from './useGroups';
import { GroupSwitcher } from './GroupSwitcher';
import { EmptyState } from './EmptyState';
import { LeaderboardCard } from './LeaderboardCard';
import { YouVsGroupCard } from './YouVsGroupCard';
import { FeedCard } from './FeedCard';
import { MembersCard } from './MembersCard';
import { CreateGroupSheet } from './CreateGroupSheet';
import { JoinGroupSheet } from './JoinGroupSheet';
import { InviteSheet } from './InviteSheet';

// Top-level Group screen. Mounts the switcher + active-group dashboard.
// When the user picks a group here, we update the shared GroupContext so the
// LogSheet's "Count in group" selector preselects the same one.

export function GroupsPage() {
  const my = useMyGroups();
  const { profile } = useProfile();
  const { session } = useAuth();
  const youUserId = session?.user.id ?? null;
  const units = profile?.units ?? 'km';

  const { activeGroupId, setActiveGroupId } = useGroupContext();
  const groups = my.data ?? [];

  // Pick a default once we know what the user belongs to.
  useEffect(() => {
    if (!activeGroupId && groups.length > 0) {
      setActiveGroupId(groups[0]!.id);
    } else if (activeGroupId && !groups.find((g) => g.id === activeGroupId) && groups.length > 0) {
      setActiveGroupId(groups[0]!.id);
    } else if (groups.length === 0 && activeGroupId) {
      setActiveGroupId(null);
    }
  }, [groups, activeGroupId, setActiveGroupId]);

  const detail = useGroupDetail(activeGroupId);
  const stats = useGroupStats(activeGroupId);
  const feed = useGroupFeed(activeGroupId);
  useGroupRealtime(activeGroupId);

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  if (my.isLoading) {
    return (
      <div className="p-4 max-w-5xl mx-auto">
        <div className="h-6 w-40 rounded bg-ink/10 animate-pulse" />
        <div className="mt-6 h-40 rounded-card bg-ink/5 animate-pulse" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="p-4 max-w-5xl mx-auto">
        <EmptyState
          onEnterCode={() => setJoinOpen(true)}
          onCreate={() => setCreateOpen(true)}
        />
        <CreateGroupSheet
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={setActiveGroupId}
        />
        <JoinGroupSheet
          open={joinOpen}
          onOpenChange={setJoinOpen}
          onJoined={setActiveGroupId}
        />
      </div>
    );
  }

  const group = detail.data ?? null;
  const isOwner = !!group && group.owner_id === youUserId;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-ink truncate">
            {group?.name ?? 'Groups'}
          </h1>
          <p className="text-sm text-ink-muted">
            Tag a run or workout to this group to count it on the board.
          </p>
        </div>
        {group && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-ink/5"
            >
              <Share2 size={14} strokeWidth={2} />
              Invite
            </button>
            <button
              type="button"
              onClick={() => openLogSheet({ groupId: group.id })}
              className="inline-flex items-center gap-1.5 rounded-pill bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-accent/20"
            >
              <Trophy size={14} strokeWidth={2} />
              Log to group
            </button>
          </div>
        )}
      </header>

      <GroupSwitcher
        groups={groups}
        selectedId={activeGroupId}
        onSelect={setActiveGroupId}
        onAddGroup={() => setJoinOpen(true)}
      />

      <div className="grid gap-5 md:grid-cols-2 items-start">
        <div className="flex flex-col gap-5">
          <LeaderboardCard
            stats={stats.data}
            loading={stats.isLoading}
            youUserId={youUserId}
            units={units}
          />
          <YouVsGroupCard stats={stats.data} units={units} />
        </div>
        <div className="flex flex-col gap-5">
          <FeedCard
            groupId={group?.id ?? ''}
            items={feed.data}
            loading={feed.isLoading}
            units={units}
          />
          {group && <MembersCard group={group} youUserId={youUserId} />}
          <ChallengeShortcut groupName={group?.name ?? ''} />
        </div>
      </div>

      {group && (
        <InviteSheet
          group={group}
          isOwner={isOwner}
          open={inviteOpen}
          onOpenChange={setInviteOpen}
        />
      )}
      <CreateGroupSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={setActiveGroupId}
      />
      <JoinGroupSheet
        open={joinOpen}
        onOpenChange={setJoinOpen}
        onJoined={setActiveGroupId}
      />
    </div>
  );
}

function ChallengeShortcut({ groupName }: { groupName: string }) {
  return (
    <div className="rounded-card border border-dashed border-border bg-surface p-4 flex items-center gap-3">
      <span className="grid place-items-center w-9 h-9 rounded-pill bg-streak/10 text-streak shrink-0">
        <Users size={16} strokeWidth={1.8} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink">Challenge {groupName || 'this group'}</div>
        <div className="text-xs text-ink-muted leading-snug">
          Set a target — a YouTube workout, a weekly distance — and see who shows up.
        </div>
      </div>
      <button
        type="button"
        disabled
        className="rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted"
        title="Challenges card coming soon"
      >
        Soon
      </button>
    </div>
  );
}
