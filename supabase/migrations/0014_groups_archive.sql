-- 0014_groups_archive.sql
--
-- Soft-archive for groups. Owner-only. Archived groups disappear from
-- active listings and Home pulse but their historical rows (members,
-- feed, tagged runs/workouts, group goals) survive. Runs/workouts keep
-- their existing ON DELETE SET NULL behavior on shared_group_id; this
-- migration does NOT introduce any hard delete.

alter table public.groups
  add column if not exists archived_at timestamptz null;

-- Partial index — the API filters "active groups" by
-- (archived_at is null), so this index is the one actually used at
-- read time. It stays tight because archived rows are excluded.
create index if not exists groups_active_owner
  on public.groups (owner_id)
  where archived_at is null;

comment on column public.groups.archived_at is
  'When present, the group is soft-archived: hidden from listings but
   history and tagged activity are preserved. Only the owner may set
   or clear this. Restore = set NULL.';
