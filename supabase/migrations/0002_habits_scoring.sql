create extension if not exists "pgcrypto";

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  emoji text not null,
  sort int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.habit_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  check_date date not null,
  created_at timestamptz not null default now(),
  constraint habit_checks_unique check (true)
);

alter table public.habit_checks add constraint habit_checks_unique unique (habit_id, check_date);

create table public.score_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  points int not null,
  reason text not null,
  source_type text not null,
  source_id text not null,
  event_date date not null,
  created_at timestamptz not null default now(),
  constraint score_events_reason_check check (reason in ('run','workout','habit','habit_day_bonus','plan_run','streak')),
  constraint score_events_idempotency unique (user_id, reason, source_type, source_id)
);

alter table public.habits enable row level security;

create policy "Habits select: own rows"
  on public.habits
  for select
  using (auth.uid() = user_id);

create policy "Habits insert: own rows only"
  on public.habits
  for insert
  with check (auth.uid() = user_id);

create policy "Habits update: own rows only"
  on public.habits
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Habits delete: own rows only"
  on public.habits
  for delete
  using (auth.uid() = user_id);

alter table public.habit_checks enable row level security;

create policy "Habit checks select: own rows"
  on public.habit_checks
  for select
  using (auth.uid() = user_id);

create policy "Habit checks insert: own rows only"
  on public.habit_checks
  for insert
  with check (auth.uid() = user_id);

create policy "Habit checks delete: own rows only"
  on public.habit_checks
  for delete
  using (auth.uid() = user_id);

alter table public.score_events enable row level security;

create policy "Score events select: own rows"
  on public.score_events
  for select
  using (auth.uid() = user_id);

create policy "Score events insert: own rows only"
  on public.score_events
  for insert
  with check (auth.uid() = user_id);
