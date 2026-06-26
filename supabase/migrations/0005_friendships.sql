-- 0005_friendships.sql — accepted social graph (friends/connections).
-- Owned by card 14 (Friends backend).
--
-- Depends on 0001_foundation.sql (profiles).
--
-- Trust model (HARDENED — revised after security review):
--   • Reads from clients: participant-only SELECT via supabase-js is allowed
--     so the web app can refresh its own friend list and subscribe to
--     realtime events scoped by RLS.
--   • Writes from clients: DENIED. There are NO INSERT/UPDATE/DELETE
--     policies on this table — RLS denies by default. All mutations MUST go
--     through the backend API, which uses the service-role key and enforces:
--       – requester == auth.uid() at insert
--       – addressee == auth.uid() at accept/decline
--       – blocked_by == auth.uid() at block; only blocked_by may unblock
--       – canonical pair uniqueness (also enforced at DB level)
--       – correct state transitions (pending→accepted/declined, etc.)
--   • profiles RLS is INTENTIONALLY UNCHANGED. Friend identity is exposed
--     only through API endpoints with a minimal projection
--     {id, handle, display_name, avatar_emoji}. Per-user preferences
--     (units, theme, week_start, nudge_pref, created_at) never reach
--     another user.
--
-- DB-level invariants kept here even though writes are API-only — defence
-- in depth against an API bug or a future migration that introduces a
-- different write path:
--   • friendships_not_self           — no self-edges
--   • friendships_blocked_by_consistency  — blocked_by IS NOT NULL iff status='blocked'
--   • friendships_blocked_by_is_participant — blocked_by ∈ {requester_id, addressee_id}
--   • friendships_canonical_pair (unique idx) — (A,B) and (B,A) cannot coexist
--
-- Idempotent: every CREATE uses IF NOT EXISTS / DROP IF EXISTS so re-running
-- in SQL Editor after a partial failure is safe.

-- ── Table ──────────────────────────────────────────────────────────────────

create table if not exists public.friendships (
  requester_id  uuid        not null references public.profiles(id) on delete cascade,
  addressee_id  uuid        not null references public.profiles(id) on delete cascade,
  status        text        not null check (status in ('pending','accepted','declined','blocked')),
  blocked_by    uuid        null     references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  responded_at  timestamptz null,
  primary key (requester_id, addressee_id),
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_blocked_by_consistency check (
    (status = 'blocked' and blocked_by is not null)
    or (status <> 'blocked' and blocked_by is null)
  ),
  constraint friendships_blocked_by_is_participant check (
    blocked_by is null
    or blocked_by = requester_id
    or blocked_by = addressee_id
  )
);

-- Canonical-pair uniqueness: prevents (A,B) and (B,A) from coexisting.
-- The lower-uuid + higher-uuid pair is the unique identity; direction lives
-- in the (requester_id, addressee_id) columns.
create unique index if not exists friendships_canonical_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index if not exists friendships_addressee on public.friendships (addressee_id);
create index if not exists friendships_status    on public.friendships (status);

-- ── friends_with helper ────────────────────────────────────────────────────
-- Boolean predicate. Used by the API (and potentially by future RLS in
-- adjacent slices, e.g. group-invites checking "is this a friend?"). NOT
-- used in profiles RLS — friend identity is exposed via API projection only.
-- SECURITY DEFINER so callers don't need direct read access to friendships.
-- Returns FALSE for any non-accepted edge (pending/declined/blocked).

create or replace function public.friends_with(a uuid, b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b)
        or (requester_id = b and addressee_id = a))
  );
$$;

-- ── Enable RLS ──────────────────────────────────────────────────────────────

alter table public.friendships enable row level security;

-- ── Policies: friendships ──────────────────────────────────────────────────
--
-- ONLY a SELECT policy is defined. Without explicit INSERT/UPDATE/DELETE
-- policies, RLS denies those operations to all roles except service_role
-- (which bypasses RLS). This means the only write path is through the
-- backend API, which uses the service-role key and enforces business rules
-- in code:
--   – auth.uid() must equal requester_id at INSERT
--   – auth.uid() must equal addressee_id at accept/decline
--   – auth.uid() must equal blocked_by to unblock
--   – etc.
--
-- Clean up any older permissive policies that may have been created during
-- iteration before this hardened version.
drop policy if exists "friendships_self_request"  on public.friendships;
drop policy if exists "friendships_self_update"   on public.friendships;
drop policy if exists "friendships_self_delete"   on public.friendships;

-- Read: a row is visible only to its two participants. Lets the web app
-- refresh its own friend list via supabase-js and subscribe to realtime
-- changes scoped to its own rows. Cannot read third-party friendships.
drop policy if exists "friendships_self_read" on public.friendships;
create policy "friendships_self_read"
  on public.friendships for select
  using (
    auth.uid() = requester_id
    or auth.uid() = addressee_id
  );

-- ── profiles RLS — INTENTIONALLY UNCHANGED ─────────────────────────────────
-- The previous draft added `friends_with(...)` to profiles SELECT. That
-- would have exposed `units / theme / week_start / nudge_pref / created_at`
-- to any accepted friend — more than necessary. Instead, the /friends/*
-- API endpoints return only a minimal projection {id, handle, display_name,
-- avatar_emoji}. No change to profiles policies is needed for this slice.
