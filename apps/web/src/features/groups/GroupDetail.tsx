import { useState } from 'react';
import { ArrowLeft, Settings2, Share2, Trophy } from 'lucide-react';
import type { Units } from '@pacer/shared';
import { openLogSheet } from '../logging/LogSheet';
import { useGroupDetail, useGroupFeed, useGroupRealtime, useGroupStats } from './useGroups';
import { LeaderboardCard } from './LeaderboardCard';
import { LeaderCallout } from './LeaderCallout';
import { GroupMemberContributionChart } from './GroupMemberContributionChart';
import { GroupWeeklyTotalsChart } from './GroupWeeklyTotalsChart';
import { YouVsGroupCard } from './YouVsGroupCard';
import { FeedCard } from './FeedCard';
import { MembersCard } from './MembersCard';
import { GoalsCard } from './GoalsCard';
import { InviteSheet } from './InviteSheet';
import { ManageGroupSheet } from './ManageGroupSheet';

// Single-group dashboard view inside /group. Reached by clicking a card in
// the Hub. "Back to groups" returns the user to the Hub via `onBack`.
//
// All four data hooks (detail / stats / feed / realtime) are scoped to a
// non-null group id — we don't render this view when id is null.

interface GroupDetailProps {
  groupId: string;
  youUserId: string | null;
  units: Units;
  onBack: () => void;
}

export function GroupDetail({ groupId, youUserId, units, onBack }: GroupDetailProps) {
  const detail = useGroupDetail(groupId);
  const stats = useGroupStats(groupId);
  const feed = useGroupFeed(groupId);
  useGroupRealtime(groupId);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const group = detail.data ?? null;
  const isOwner = !!group && group.owner_id === youUserId;

  if (detail.isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
        <BackButton onClick={onBack} />
        <div className="mt-4 h-6 w-40 rounded bg-ink/10 animate-pulse" />
        <div className="mt-6 h-40 rounded-card bg-ink/5 animate-pulse" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
        <BackButton onClick={onBack} />
        <div className="mt-6 rounded-card border border-border bg-surface p-6 text-sm text-ink-muted">
          We couldn't load this group. It may have been deleted or you may no longer be a member.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto flex flex-col gap-5">
      <BackButton onClick={onBack} />

      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-ink truncate">{group.name}</h1>
          <p className="text-sm text-ink-muted mt-1">
            {group.members.length} {group.members.length === 1 ? 'member' : 'members'} · Tag a run
            or workout to count it on the board.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            aria-label="Manage group"
            className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-ink/5"
          >
            <Settings2 size={14} strokeWidth={1.8} />
            Manage
          </button>
        </div>
      </header>

      <div className="grid gap-5 md:grid-cols-2 items-start">
        <div className="flex flex-col gap-5">
          <LeaderCallout stats={stats.data} youUserId={youUserId} />
          <GroupWeeklyTotalsChart stats={stats.data} units={units} />
          <GroupMemberContributionChart
            stats={stats.data}
            youUserId={youUserId}
            units={units}
          />
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
            groupId={group.id}
            items={feed.data}
            loading={feed.isLoading}
            units={units}
          />
          <MembersCard group={group} youUserId={youUserId} />
          <GoalsCard
            groupId={group.id}
            youUserId={youUserId}
            isOwner={isOwner}
            units={units}
          />
        </div>
      </div>

      <InviteSheet
        group={group}
        isOwner={isOwner}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
      <ManageGroupSheet
        group={group}
        isOwner={isOwner}
        open={manageOpen}
        onOpenChange={setManageOpen}
        onLeft={onBack}
      />
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink hover:bg-ink/5"
    >
      <ArrowLeft size={14} strokeWidth={2} />
      Back to groups
    </button>
  );
}

