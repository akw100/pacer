-- 0009_video_routine_sharing.sql — make flows public + likeable.
-- Depends on 0008_video_routines.sql.

-- ── public flows ─────────────────────────────────────────────────────────────
alter table public.video_routines
  add column is_public boolean not null default false;

-- Anyone authenticated may read a public routine (OR'd with the owner policy).
create policy "video_routines_public_read"
  on public.video_routines for select
  using (is_public = true);

-- ── likes ────────────────────────────────────────────────────────────────────
create table public.video_routine_likes (
  routine_id uuid        not null references public.video_routines(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (routine_id, user_id)
);

create index video_routine_likes_routine on public.video_routine_likes (routine_id);

alter table public.video_routine_likes enable row level security;

-- Manage your own likes.
create policy "video_routine_likes_own"
  on public.video_routine_likes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Read likes for any routine you can see (your own or a public one) — powers the
-- like counts on the Discover list.
create policy "video_routine_likes_read"
  on public.video_routine_likes for select
  using (
    exists (
      select 1 from public.video_routines r
      where r.id = routine_id and (r.user_id = auth.uid() or r.is_public)
    )
  );
