import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { GroupDetail } from './useGroups';
import { useLeaveGroup, useRemoveMember } from './useGroups';

interface MembersCardProps {
  group: GroupDetail;
  youUserId: string | null;
}

export function MembersCard({ group, youUserId }: MembersCardProps) {
  const isOwner = youUserId === group.owner_id;
  const remove = useRemoveMember(group.id);
  const leave = useLeaveGroup();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  return (
    <section
      aria-labelledby="members-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-3"
    >
      <header className="flex items-center justify-between">
        <h2 id="members-heading" className="font-display text-lg font-semibold text-ink">
          Members
        </h2>
        <span className="text-xs text-ink-muted">{group.members.length}</span>
      </header>

      <ul role="list" className="flex flex-col gap-1.5">
        {group.members.map((m) => {
          const you = m.user_id === youUserId;
          const isOwnerRow = m.user_id === group.owner_id;
          const confirming = confirmingId === m.user_id;
          return (
            <li
              key={m.user_id}
              className={`flex items-center gap-3 rounded-card border px-3 py-2 ${
                you ? 'border-accent/30 bg-accent/5' : 'border-border bg-surface'
              }`}
            >
              <span
                aria-hidden="true"
                className="grid place-items-center w-9 h-9 rounded-full bg-ink/5 text-base shrink-0"
              >
                {m.avatar_emoji ?? '🙂'}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm truncate ${you ? 'font-semibold text-ink' : 'text-ink'}`}>
                  {you ? 'You' : m.display_name}
                  {isOwnerRow && <span className="ml-2 text-xs text-streak font-medium">owner</span>}
                </div>
                <div className="text-xs text-ink-muted truncate">@{m.handle}</div>
              </div>
              {isOwner && !isOwnerRow && (
                confirming ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setConfirmingId(null)}
                      className="rounded-pill px-2.5 py-1 text-xs text-ink-muted hover:bg-ink/5"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        remove.mutate(m.user_id);
                        setConfirmingId(null);
                      }}
                      className="rounded-pill bg-accent px-2.5 py-1 text-xs font-medium text-white"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-label={`Remove ${m.display_name}`}
                    onClick={() => setConfirmingId(m.user_id)}
                    className="p-1.5 rounded-pill text-ink-muted hover:text-accent hover:bg-accent/10"
                  >
                    <MoreHorizontal size={16} strokeWidth={1.8} />
                  </button>
                )
              )}
            </li>
          );
        })}
      </ul>

      {!isOwner && (
        <button
          type="button"
          onClick={() => leave.mutate(group.id)}
          className="self-start text-xs text-ink-muted hover:text-accent"
        >
          Leave this group
        </button>
      )}
    </section>
  );
}
