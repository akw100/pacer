-- Live Race: a synchronized GPS footrace. Live positions are NOT stored
-- (broadcast-only); only lobby/lifecycle/result state lives here.

create table if not exists public.races (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references auth.users(id) on delete cascade,
  target_meters integer not null check (target_meters > 0),
  status        text not null default 'lobby'
                check (status in ('lobby','active','finished','cancelled')),
  start_at      timestamptz,
  finished_at   timestamptz,
  winner_id     uuid references auth.users(id),
  rematch_of    uuid references public.races(id),
  created_at    timestamptz not null default now()
);

create table if not exists public.race_participants (
  race_id         uuid not null references public.races(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'runner' check (role in ('runner','spectator')),
  state           text not null default 'invited'
                  check (state in ('invited','joined','ready','racing','finished','dnf')),
  final_meters    numeric,
  finished_at     timestamptz,
  elapsed_seconds integer,
  manual_finish   boolean not null default false,
  run_id          uuid references public.runs(id),
  joined_at       timestamptz not null default now(),
  primary key (race_id, user_id)
);
create index if not exists race_participants_user_idx on public.race_participants (user_id);

alter table public.races enable row level security;
alter table public.race_participants enable row level security;

-- A user can read a race they participate in (and its participant rows). All
-- writes go through the API (service-role); no direct client writes.
create policy races_read on public.races for select to authenticated
  using (exists (select 1 from public.race_participants p
                 where p.race_id = races.id and p.user_id = auth.uid()));
create policy race_participants_read on public.race_participants for select to authenticated
  using (exists (select 1 from public.race_participants me
                 where me.race_id = race_participants.race_id and me.user_id = auth.uid()));

-- ── Extend existing CHECK constraints for race-sourced rows ──────────────────
-- A finisher's run is logged with source 'race' (see apps/api/src/lib/race-result.ts);
-- the winner gets a 'race_win' score_event. Both columns carry a CHECK
-- constraint enumerating allowed values (migration 0002_logging.sql), so widen
-- them here rather than leaving the inserts to fail.

alter table public.runs drop constraint if exists runs_source_check;
alter table public.runs add constraint runs_source_check
  check (source in ('web','telegram','race'));

alter table public.score_events drop constraint if exists score_events_reason_check;
alter table public.score_events add constraint score_events_reason_check
  check (reason in ('run','workout','habit','habit_day_bonus','plan_run','streak','race_win'));
