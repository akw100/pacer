-- 0004_onboarding_state.sql — per-user onboarding + hint dismissal state.
-- Owned by card 13 (Onboarding, PWA install & polish).
--
-- Pure personal UI state — never read by other users. own-rows RLS only,
-- no shares_group_with() exposure here.
--
-- Idempotent: every CREATE / ALTER uses IF NOT EXISTS so this is safe to
-- re-run on an already-migrated project.

create table if not exists public.onboarding_state (
  user_id            uuid        primary key references public.profiles(id) on delete cascade,
  completed_at       timestamptz,
  skipped_at         timestamptz,
  coachmarks_done_at timestamptz,
  -- Hint IDs the user has dismissed. Append-only from the UI; the union
  -- of allowed ids lives in packages/shared/src/onboarding.ts (HintId).
  dismissed_hints    text[]      not null default '{}',
  created_at         timestamptz not null default now()
);

alter table public.onboarding_state enable row level security;

drop policy if exists "onboarding_state_own_read" on public.onboarding_state;
create policy "onboarding_state_own_read"
  on public.onboarding_state for select
  using (auth.uid() = user_id);

drop policy if exists "onboarding_state_own_insert" on public.onboarding_state;
create policy "onboarding_state_own_insert"
  on public.onboarding_state for insert
  with check (auth.uid() = user_id);

drop policy if exists "onboarding_state_own_update" on public.onboarding_state;
create policy "onboarding_state_own_update"
  on public.onboarding_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
