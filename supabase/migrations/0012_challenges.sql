-- 0012_challenges.sql — challenges between friends and groups.
-- Owned by card 09 (Challenges).
--
-- Depends on 0001_foundation.sql (profiles), 0002_logging.sql (runs/workouts),
-- 0002_habits_scoring.sql (habit_checks/score_events) and 0003_groups_and_share.sql
-- (groups/group_members + the shares_group_with helper). Challenges only READ
-- those via the API's service client for progress aggregation; this migration
-- adds three new tables and never weakens another slice's policies.
--
-- Progress model: a participant's progress is computed server-side from ALL of
-- their logged activity inside [start_date, end_date] (not just group-shared
-- rows) — except metric='check_in', a self-report counter stored here.
--
-- Idempotent: every CREATE uses IF NOT EXISTS / DROP IF EXISTS so re-running in
-- the SQL Editor after a partial failure is safe.

-- ── Tables ───────────────────────────────────────────────────────────────────

create table if not exists public.challenges (
  id          uuid        primary key default gen_random_uuid(),
  creator_id  uuid        not null references public.profiles(id) on delete cascade,
  audience    text        not null check (audience in ('user', 'group', 'everyone')),
  -- set only when audience = 'group'.
  group_id    uuid        references public.groups(id) on delete cascade,
  metric      text        not null check (
                metric in ('distance', 'run_count', 'reps', 'workout_count', 'habit_days', 'score', 'check_in')
              ),
  target      numeric     not null check (target > 0),
  start_date  date        not null,
  end_date    date        not null,
  description text        check (description is null or char_length(description) <= 500),
  youtube_url text,
  created_at  timestamptz not null default now(),
  constraint challenges_window check (end_date >= start_date),
  constraint challenges_group_audience check (
    (audience = 'group' and group_id is not null)
    or (audience <> 'group' and group_id is null)
  )
);

create index if not exists challenges_creator on public.challenges (creator_id);
create index if not exists challenges_group   on public.challenges (group_id) where group_id is not null;
create index if not exists challenges_window  on public.challenges (start_date, end_date);

create table if not exists public.challenge_participants (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'invited' check (status in ('invited', 'accepted', 'declined')),
  primary key (challenge_id, user_id)
);

create index if not exists challenge_participants_user on public.challenge_participants (user_id);

create table if not exists public.challenge_check_ins (
  id           uuid        primary key default gen_random_uuid(),
  challenge_id uuid        not null references public.challenges(id) on delete cascade,
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  check_date   date        not null,
  created_at   timestamptz not null default now(),
  unique (challenge_id, user_id, check_date)
);

create index if not exists challenge_check_ins_lookup on public.challenge_check_ins (challenge_id, user_id);

-- ── Visibility helper ────────────────────────────────────────────────────────
-- can_see_challenge centralises "who may see this challenge" so the SELECT
-- policies on challenges AND challenge_participants can both call it WITHOUT
-- triggering recursive RLS (SECURITY DEFINER bypasses RLS for the lookups).
--   • creator always
--   • any participant
--   • audience='everyone' → anyone (open challenge)
--   • audience='group'    → members of that group
create or replace function public.can_see_challenge(cid uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.challenges c
    where c.id = cid
      and (
        c.creator_id = viewer
        or c.audience = 'everyone'
        or exists (
          select 1 from public.challenge_participants p
          where p.challenge_id = c.id and p.user_id = viewer
        )
        or (
          c.audience = 'group'
          and exists (
            select 1 from public.group_members m
            where m.group_id = c.group_id and m.user_id = viewer
          )
        )
      )
  );
$$;

-- ── Enable RLS ───────────────────────────────────────────────────────────────

alter table public.challenges            enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.challenge_check_ins    enable row level security;

-- ── Policies: challenges ─────────────────────────────────────────────────────

drop policy if exists "challenges_visible_read" on public.challenges;
create policy "challenges_visible_read"
  on public.challenges for select
  using (public.can_see_challenge(id, auth.uid()));

drop policy if exists "challenges_creator_insert" on public.challenges;
create policy "challenges_creator_insert"
  on public.challenges for insert
  with check (auth.uid() = creator_id);

drop policy if exists "challenges_creator_write" on public.challenges;
create policy "challenges_creator_write"
  on public.challenges for update
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

drop policy if exists "challenges_creator_delete" on public.challenges;
create policy "challenges_creator_delete"
  on public.challenges for delete
  using (auth.uid() = creator_id);

-- ── Policies: challenge_participants ─────────────────────────────────────────

drop policy if exists "challenge_participants_read" on public.challenge_participants;
create policy "challenge_participants_read"
  on public.challenge_participants for select
  using (public.can_see_challenge(challenge_id, auth.uid()));

-- A user may add THEMSELVES to a challenge they can see — i.e. join an open or
-- group challenge. Invites for 'user'/'group' audiences are written server-side
-- by the service client at creation time.
drop policy if exists "challenge_participants_self_join" on public.challenge_participants;
create policy "challenge_participants_self_join"
  on public.challenge_participants for insert
  with check (auth.uid() = user_id and public.can_see_challenge(challenge_id, auth.uid()));

-- A user may update only their OWN participation row (accept / decline).
drop policy if exists "challenge_participants_self_respond" on public.challenge_participants;
create policy "challenge_participants_self_respond"
  on public.challenge_participants for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Policies: challenge_check_ins ────────────────────────────────────────────

drop policy if exists "challenge_check_ins_read" on public.challenge_check_ins;
create policy "challenge_check_ins_read"
  on public.challenge_check_ins for select
  using (public.can_see_challenge(challenge_id, auth.uid()));

drop policy if exists "challenge_check_ins_self_insert" on public.challenge_check_ins;
create policy "challenge_check_ins_self_insert"
  on public.challenge_check_ins for insert
  with check (auth.uid() = user_id and public.can_see_challenge(challenge_id, auth.uid()));

drop policy if exists "challenge_check_ins_self_delete" on public.challenge_check_ins;
create policy "challenge_check_ins_self_delete"
  on public.challenge_check_ins for delete
  using (auth.uid() = user_id);
