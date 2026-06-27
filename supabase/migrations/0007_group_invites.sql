-- 0007_group_invites.sql — pending invites from one group member to a friend.
-- Owned by card 16 (Group invites backend).
--
-- Depends on 0003_groups_and_share.sql (groups, group_members) and
-- 0005_friendships.sql (friends_with helper).
--
-- Product rule: a user becomes a group member ONLY after either
--   (1) joining via the group's invite code (existing 0003 flow), or
--   (2) being invited by an existing member AND explicitly accepting the
--       invite (this slice). The backend never auto-adds members.
--
-- Trust model (mirrors 0005_friendships and 0006_group_goals):
--   • Least-privilege SELECT: only the invited_user, the inviter, or the
--     group owner can read an invite row. Non-owner / non-participant
--     group members CANNOT see the invite list — they learn about new
--     members only when accept succeeds and group_members updates.
--   • There are NO INSERT/UPDATE/DELETE policies — RLS denies them by
--     default. All mutations go through the backend API using the
--     service-role key after the API validates:
--       – inviter is a group member
--       – inviter and invited are accepted friends (via friends_with)
--       – invited is not already a group member
--       – at most one pending invite per (group, invited) pair
--       – accept/decline can only be performed by invited_user
--       – cancel (DELETE) can only be performed by invited_by
--
-- DB-level invariants — defence in depth against API drift:
--   • group_invites_not_self            — invited_by <> invited_user
--   • partial unique idx (group_id, invited_user) WHERE status='pending'
--     — at most one pending row per pair; declined rows are kept as audit
--       and don't block a future retry once the user changes their mind.
--
-- Idempotent: every CREATE uses IF NOT EXISTS / DROP IF EXISTS so re-running
-- in SQL Editor after a partial failure is safe.

create table if not exists public.group_invites (
  id            uuid        primary key default gen_random_uuid(),
  group_id      uuid        not null references public.groups(id) on delete cascade,
  invited_by    uuid        not null references public.profiles(id) on delete cascade,
  invited_user  uuid        not null references public.profiles(id) on delete cascade,
  status        text        not null check (status in ('pending','accepted','declined')) default 'pending',
  created_at    timestamptz not null default now(),
  responded_at  timestamptz null,
  constraint group_invites_not_self check (invited_by <> invited_user)
);

-- Prevent duplicate pending invites for the same (group, invited) pair.
-- Declined / accepted rows are NOT covered (they're history) so a friend
-- who once declined can be invited again if they change their mind.
create unique index if not exists group_invites_one_pending_per_pair
  on public.group_invites (group_id, invited_user)
  where status = 'pending';

create index if not exists group_invites_invited_user
  on public.group_invites (invited_user, status);

create index if not exists group_invites_group
  on public.group_invites (group_id, status);

alter table public.group_invites enable row level security;

-- Clean up any older permissive policies that may have been created during
-- iteration before this hardened version.
drop policy if exists "group_invites_member_insert"      on public.group_invites;
drop policy if exists "group_invites_participant_update" on public.group_invites;
drop policy if exists "group_invites_participant_delete" on public.group_invites;
drop policy if exists "group_invites_member_visible"     on public.group_invites;

-- Read (least privilege): only invited_user, invited_by, or group owner.
-- Any other group member sees nothing through RLS. Note: the inner scalar
-- subquery on `groups` returns the owner_id only if the caller can read
-- that groups row (owner via groups_owner_all, member via
-- groups_members_read). For unrelated third parties it returns NULL, and
-- the comparison evaluates to NULL (not TRUE), so no leak.
drop policy if exists "group_invites_visible" on public.group_invites;
create policy "group_invites_visible"
  on public.group_invites for select
  using (
    auth.uid() = invited_user
    or auth.uid() = invited_by
    or auth.uid() = (
      select owner_id from public.groups
      where id = public.group_invites.group_id
    )
  );
