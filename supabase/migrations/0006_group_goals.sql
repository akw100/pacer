-- 0006_group_goals.sql — group-scoped goals with derived progress.
-- Owned by card 15 (Group goals backend).
--
-- Depends on 0001_foundation.sql (profiles) and 0003_groups_and_share.sql
-- (groups + shared_group_id on runs/workouts — the only way an activity is
-- attributed to a group).
--
-- Progress is NEVER stored — it's derived live from runs/workouts that the
-- author of each activity tagged with shared_group_id = goal.group_id, inside
-- the goal's [start_date, end_date] window. The API computes it; the only
-- mutable thing on the row is the user-controlled `status`.
--
-- Stored status is intentionally minimal:
--   • 'active'   — the goal is being tracked
--   • 'archived' — user-cancelled (soft delete; the canonical "remove" path
--                  in v1, since there is NO hard DELETE endpoint)
-- The "completed" and "expired" states are DERIVED at read time by the API
-- (progress >= target_value, or end_date < today). Storing them would force
-- a sync job; deriving keeps the schema honest.
--
-- v1 metrics: distance, runs, workouts, score. All derive from
-- runs+workouts with shared_group_id = goal.group_id.
-- v2 (separate migration): habit_checks once habit_checks gains
-- shared_group_id.
--
-- Trust model (mirrors 0005_friendships.sql):
--   • SELECT policy: any group member can read goals for their group.
--   • There are NO INSERT/UPDATE/DELETE policies — RLS denies them by
--     default. All mutations go through the backend API using the
--     service-role key after the API validates auth + membership + roles
--     (creator OR group owner) + transition rules.
--
-- Idempotent: every CREATE uses IF NOT EXISTS / DROP IF EXISTS so re-running
-- in SQL Editor after a partial failure is safe.

-- ── Table ──────────────────────────────────────────────────────────────────

create table if not exists public.group_goals (
  id            uuid        primary key default gen_random_uuid(),
  group_id      uuid        not null references public.groups(id) on delete cascade,
  created_by    uuid        not null references public.profiles(id) on delete cascade,
  title         text        not null check (char_length(title) between 1 and 80),
  metric        text        not null check (metric in ('distance','runs','workouts','score')),
  target_value  numeric     not null check (target_value > 0),
  start_date    date        not null,
  end_date      date        not null,
  status        text        not null default 'active' check (status in ('active','archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint group_goals_date_order check (end_date >= start_date)
);

create index if not exists group_goals_group_active
  on public.group_goals (group_id, status, end_date desc);

create index if not exists group_goals_created_by
  on public.group_goals (created_by);

-- ── updated_at touch trigger ───────────────────────────────────────────────

create or replace function public.group_goals_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists group_goals_set_updated_at on public.group_goals;
create trigger group_goals_set_updated_at
  before update on public.group_goals
  for each row execute function public.group_goals_touch_updated_at();

-- ── Enable RLS ──────────────────────────────────────────────────────────────

alter table public.group_goals enable row level security;

-- ── Policies: group_goals ─────────────────────────────────────────────────
--
-- SELECT only. There are NO INSERT/UPDATE/DELETE policies — RLS denies those
-- to all roles except service_role. The API uses the service-role key for
-- mutations after it has:
--   – verified the caller is a group member (assertMember)
--   – set created_by = c.get('userId') server-side at INSERT
--   – verified caller == created_by OR caller == group.owner_id at
--     UPDATE/archive
--   – validated state transitions and immutability (group_id, created_by,
--     metric are never changed after creation)
--
-- v1 has NO hard DELETE endpoint — archive (status='archived') is the
-- canonical soft-delete path. The cleanup `drop policy if exists` for a
-- delete policy below is defence-in-depth in case an earlier iteration
-- created one before this hardened version.
--
-- Clean up any older permissive policies that may have been created during
-- iteration before this hardened version.
drop policy if exists "group_goals_member_insert" on public.group_goals;
drop policy if exists "group_goals_creator_or_owner_update" on public.group_goals;
drop policy if exists "group_goals_creator_or_owner_delete" on public.group_goals;

-- Read: any current group member can see the group's goals.
drop policy if exists "group_goals_member_read" on public.group_goals;
create policy "group_goals_member_read"
  on public.group_goals for select
  using (
    exists (
      select 1 from public.group_members
      where group_id = public.group_goals.group_id
        and user_id = auth.uid()
    )
  );
