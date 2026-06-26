-- 0003_groups_and_share.sql — private groups, members, reactions + the
-- optional group-share contract on activities.
-- Owned by card 07 (Groups, leaderboard, feed & realtime).
--
-- Depends on 0001_foundation.sql (profiles, shares_group_with stub) and
-- 0002_logging.sql (runs, workouts).
--
-- Additive design: this migration NEVER weakens another slice's policies.
--   • A run/workout is ALWAYS personal (user_id). The new
--     `shared_group_id` column is OPTIONAL — null means "personal only".
--   • Group visibility comes from filtering on shared_group_id in the
--     feed/stats queries; we do NOT change RLS on runs/workouts beyond
--     keeping the existing additive shares_group_with policies intact.
--   • The foundation's `shares_group_with` was a stub returning false; we
--     replace it with the real implementation here, now that group_members
--     exists. This is intentionally consolidated in this one migration so
--     other slices' policies that already call it light up correctly.
--
-- Idempotent: every CREATE uses IF NOT EXISTS / DROP IF EXISTS so re-running
-- in SQL Editor after a partial failure is safe.

-- ── Tables first (so policies that reference them resolve) ──────────────────

create table if not exists public.groups (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null check (char_length(name) between 1 and 60),
  -- 6-char invite code from a restricted alphabet (no O/0/I/1/L).
  join_code   text        not null unique check (join_code ~ '^[A-HJ-KMN-PR-TV-Z2-9]{6}$'),
  owner_id    uuid        not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists groups_owner on public.groups (owner_id);

create table if not exists public.group_members (
  group_id  uuid        not null references public.groups(id) on delete cascade,
  user_id   uuid        not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user on public.group_members (user_id);

create table if not exists public.reactions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  target_type text        not null check (target_type in ('run', 'workout', 'habit_day')),
  target_id   uuid        not null,
  emoji       text        not null check (emoji in ('👏', '🔥', '💪')),
  created_at  timestamptz not null default now(),
  unique (user_id, target_type, target_id, emoji)
);

create index if not exists reactions_target on public.reactions (target_type, target_id);

-- ── shares_group_with — real implementation ─────────────────────────────────
-- Replaces the foundation's stub (returns false). SECURITY DEFINER avoids
-- recursive RLS evaluation when called from a SELECT policy on group_members.

create or replace function public.shares_group_with(target_owner uuid, viewer uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = target_owner
      and b.user_id = viewer
  );
$$;

-- React-target owner helper used by the reactions RLS policies. plpgsql with
-- dynamic SQL for the habit_day branch so this migration compiles even when
-- the habits slice's `habit_checks` table hasn't been created yet (or has
-- been renamed). If habit_checks is missing, habit_day reactions resolve to
-- null and the RLS policy denies the insert — exactly the desired behavior.

create or replace function public.reaction_target_owner(t_type text, t_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  owner_uuid uuid;
begin
  if t_type = 'run' then
    select user_id into owner_uuid from public.runs where id = t_id;
  elsif t_type = 'workout' then
    select user_id into owner_uuid from public.workouts where id = t_id;
  elsif t_type = 'habit_day' then
    if to_regclass('public.habit_checks') is not null then
      execute 'select user_id from public.habit_checks where id = $1' into owner_uuid using t_id;
    end if;
  end if;
  return owner_uuid;
end;
$$;

-- ── Enable RLS ──────────────────────────────────────────────────────────────

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.reactions enable row level security;

-- ── Policies: groups ────────────────────────────────────────────────────────

drop policy if exists "groups_owner_all" on public.groups;
create policy "groups_owner_all"
  on public.groups for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "groups_members_read" on public.groups;
create policy "groups_members_read"
  on public.groups for select
  using (
    exists (
      select 1 from public.group_members
      where group_id = public.groups.id and user_id = auth.uid()
    )
  );

drop policy if exists "groups_insert_self" on public.groups;
create policy "groups_insert_self"
  on public.groups for insert
  with check (auth.uid() = owner_id);

-- ── Policies: group_members ────────────────────────────────────────────────

drop policy if exists "group_members_co_read" on public.group_members;
create policy "group_members_co_read"
  on public.group_members for select
  using (
    exists (
      select 1 from public.group_members self
      where self.group_id = public.group_members.group_id and self.user_id = auth.uid()
    )
  );

drop policy if exists "group_members_self_join" on public.group_members;
create policy "group_members_self_join"
  on public.group_members for insert
  with check (auth.uid() = user_id);

drop policy if exists "group_members_self_leave" on public.group_members;
create policy "group_members_self_leave"
  on public.group_members for delete
  using (auth.uid() = user_id);

-- ── Policies: reactions ────────────────────────────────────────────────────

drop policy if exists "reactions_co_member_read" on public.reactions;
create policy "reactions_co_member_read"
  on public.reactions for select
  using (
    public.shares_group_with(public.reaction_target_owner(target_type, target_id), auth.uid())
    or auth.uid() = user_id
  );

drop policy if exists "reactions_co_member_insert" on public.reactions;
create policy "reactions_co_member_insert"
  on public.reactions for insert
  with check (
    auth.uid() = user_id
    and public.shares_group_with(public.reaction_target_owner(target_type, target_id), auth.uid())
  );

drop policy if exists "reactions_own_delete" on public.reactions;
create policy "reactions_own_delete"
  on public.reactions for delete
  using (auth.uid() = user_id);

-- ── Optional group-share on activities ──────────────────────────────────────
-- A run/workout stays a personal record (user_id). The user MAY also tag it
-- to a single group they belong to so the activity shows up in that group's
-- feed and counts toward that group's leaderboard. Null = personal only.

alter table public.runs
  add column if not exists shared_group_id uuid null references public.groups(id) on delete set null;

alter table public.workouts
  add column if not exists shared_group_id uuid null references public.groups(id) on delete set null;

create index if not exists runs_shared_group     on public.runs     (shared_group_id, run_date desc) where shared_group_id is not null;
create index if not exists workouts_shared_group on public.workouts (shared_group_id, workout_date desc) where shared_group_id is not null;

-- Defence-in-depth: a user can only share to a group they belong to. The API
-- also checks this, but the trigger prevents a buggy client (or a future
-- migration) from punching through. SECURITY DEFINER so the check sees
-- group_members rows regardless of the caller's RLS view.
create or replace function public.enforce_shared_group_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.shared_group_id is not null then
    if not exists (
      select 1 from public.group_members
      where group_id = new.shared_group_id
        and user_id = new.user_id
    ) then
      raise exception 'cannot share activity to a group you do not belong to'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists runs_enforce_shared_group on public.runs;
create trigger runs_enforce_shared_group
  before insert or update of shared_group_id, user_id on public.runs
  for each row execute function public.enforce_shared_group_membership();

drop trigger if exists workouts_enforce_shared_group on public.workouts;
create trigger workouts_enforce_shared_group
  before insert or update of shared_group_id, user_id on public.workouts
  for each row execute function public.enforce_shared_group_membership();

-- Additive group-read RLS on activities: a co-member can read another
-- member's run/workout ONLY when it was shared to a group they both belong
-- to. This is narrower than 0002_logging.sql's blanket shares_group_with
-- read — it's added here for the post-MVP groups feed; the existing broader
-- policy stays in place so its semantics don't regress.

drop policy if exists "runs_shared_group_read" on public.runs;
create policy "runs_shared_group_read"
  on public.runs for select
  using (
    shared_group_id is not null
    and exists (
      select 1 from public.group_members
      where group_id = public.runs.shared_group_id
        and user_id = auth.uid()
    )
  );

drop policy if exists "workouts_shared_group_read" on public.workouts;
create policy "workouts_shared_group_read"
  on public.workouts for select
  using (
    shared_group_id is not null
    and exists (
      select 1 from public.group_members
      where group_id = public.workouts.shared_group_id
        and user_id = auth.uid()
    )
  );
