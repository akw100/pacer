-- 0002_logging.sql — runs, workouts, workout_sets, score_events tables + RLS.
-- Owned by card 04 (MVP logging: runs & workouts).
-- Depends on 0001_foundation.sql (profiles + shares_group_with).

-- ── runs ─────────────────────────────────────────────────────────────────────

create table public.runs (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references public.profiles(id) on delete cascade,
  run_date         date        not null,
  distance_meters  numeric     not null check (distance_meters > 0),
  duration_seconds integer     not null check (duration_seconds > 0),
  exertion_rating  smallint    check (exertion_rating between 1 and 10),
  warm_up          boolean     not null default false,
  stretched        boolean     not null default false,
  post_run_food    boolean     not null default false,
  sleep_hours      numeric     check (sleep_hours between 0 and 24),
  notes            text,
  source           text        not null default 'web' check (source in ('web', 'telegram')),
  created_at       timestamptz not null default now()
);

create index runs_user_date on public.runs (user_id, run_date desc);

alter table public.runs enable row level security;

-- Own rows: full access.
create policy "runs_own"
  on public.runs for all using (auth.uid() = user_id);

-- Group members: read-only. shares_group_with is OR'd with own-row check.
create policy "runs_group_read"
  on public.runs for select
  using (public.shares_group_with(user_id, auth.uid()));

-- ── workouts ─────────────────────────────────────────────────────────────────

create table public.workouts (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references public.profiles(id) on delete cascade,
  name             text        not null,
  workout_date     date        not null,
  kind             text        not null check (kind in ('strength', 'mobility', 'swim', 'bike', 'other')),
  duration_seconds integer     check (duration_seconds > 0),
  source           text        not null default 'web' check (source in ('web', 'telegram')),
  created_at       timestamptz not null default now()
);

create index workouts_user_date on public.workouts (user_id, workout_date desc);

alter table public.workouts enable row level security;

create policy "workouts_own"
  on public.workouts for all using (auth.uid() = user_id);

create policy "workouts_group_read"
  on public.workouts for select
  using (public.shares_group_with(user_id, auth.uid()));

-- ── workout_sets ─────────────────────────────────────────────────────────────

create table public.workout_sets (
  id            uuid     primary key default gen_random_uuid(),
  workout_id    uuid     not null references public.workouts(id) on delete cascade,
  exercise_name text     not null,
  sets          smallint not null check (sets > 0),
  reps          smallint not null check (reps > 0),
  weight        numeric  check (weight >= 0)
);

alter table public.workout_sets enable row level security;

-- Access is derived from the parent workout's owner.
create policy "workout_sets_own"
  on public.workout_sets for all
  using (
    exists (select 1 from public.workouts w
            where w.id = workout_id and w.user_id = auth.uid())
  );

create policy "workout_sets_group_read"
  on public.workout_sets for select
  using (
    exists (select 1 from public.workouts w
            where w.id = workout_id and public.shares_group_with(w.user_id, auth.uid()))
  );

-- ── score_events ─────────────────────────────────────────────────────────────
-- Append-only ledger. Weekly/lifetime scores are SUM() over this.
-- source_type + source_id is polymorphic (run, workout, habit, etc.).
-- Unique constraint makes scoring idempotent: re-logging the same source is a no-op.

create table public.score_events (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  points      integer     not null,
  reason      text        not null check (reason in ('run','workout','habit','habit_day_bonus','plan_run','streak')),
  source_type text        not null,
  source_id   uuid        not null,
  event_date  date        not null,
  created_at  timestamptz not null default now(),
  constraint score_events_idempotent unique (reason, source_type, source_id)
);

create index score_events_user_date on public.score_events (user_id, event_date desc);

alter table public.score_events enable row level security;

create policy "score_events_own"
  on public.score_events for select using (auth.uid() = user_id);

-- ── score_events cleanup triggers ────────────────────────────────────────────
-- Deleting a run/workout removes its score_events (no FK possible on polymorphic source_id).

create or replace function public.delete_score_events_for_source()
returns trigger language plpgsql security definer as $$
begin
  delete from public.score_events
  where source_type = tg_argv[0] and source_id = old.id;
  return old;
end;
$$;

create trigger runs_delete_score_events
  before delete on public.runs
  for each row execute procedure public.delete_score_events_for_source('run');

create trigger workouts_delete_score_events
  before delete on public.workouts
  for each row execute procedure public.delete_score_events_for_source('workout');
