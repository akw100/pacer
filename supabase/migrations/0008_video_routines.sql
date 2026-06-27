-- 0008_video_routines.sql — video_routines table + private frames storage bucket.
-- Owned by the video-frames slice (YouTube workout → step-through carousel).
-- Depends on 0001_foundation.sql (profiles).

-- ── video_routines ───────────────────────────────────────────────────────────
-- One row per "liked" YouTube workout turned into a saved routine. The sections
-- array (jsonb) is produced by the Python frames worker and read as a whole, so
-- it stays denormalised — no child table. Frame images live in Storage; sections
-- store the object path, never the bytes.

create table public.video_routines (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  youtube_url text        not null,
  video_id    text,
  title       text,
  status      text        not null default 'processing'
                          check (status in ('processing', 'ready', 'error')),
  error       text,
  sections    jsonb,
  created_at  timestamptz not null default now()
);

create index video_routines_user_created on public.video_routines (user_id, created_at desc);

alter table public.video_routines enable row level security;

-- Owner-only: routines are private (no group-read in v1).
create policy "video_routines_own"
  on public.video_routines for all using (auth.uid() = user_id);

-- ── frames storage bucket ────────────────────────────────────────────────────
-- Private bucket; objects keyed by <userId>/<routineId>/<idx>.jpg. Uploads come
-- from the worker via the service role and reads happen through service-role
-- signed URLs (both bypass RLS), so the policy below is defense-in-depth for any
-- direct client access — owner can only see their own prefix.

insert into storage.buckets (id, name, public)
values ('video-frames', 'video-frames', false)
on conflict (id) do nothing;

create policy "video_frames_owner_read"
  on storage.objects for select
  using (
    bucket_id = 'video-frames'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
