-- Foundation migration for Pacer's base database.
-- Defines the profiles table, the signup trigger, and the base helper for
-- additive group-based access policies.

create table public.profiles (
  id uuid primary key,
  handle text not null unique,
  display_name text not null,
  units text not null default 'km',
  theme text not null default 'light',
  week_start int not null default 1,
  avatar_emoji text,
  nudge_pref text not null default 'daily',
  created_at timestamptz not null default now(),
  constraint profiles_handle_format check (handle = lower(handle)),
  constraint profiles_handle_regex check (handle ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_units_check check (units in ('km','mi')),
  constraint profiles_theme_check check (theme in ('light','dark')),
  constraint profiles_week_start_check check (week_start in (0,1)),
  constraint profiles_nudge_pref_check check (nudge_pref in ('off','daily','weekly'))
);

create or replace function public.create_profile_on_signup()
returns trigger
language plpgsql
security definer
as $$
declare
  normalized_handle text;
  candidate_name text;
begin
  normalized_handle := lower(regexp_replace(split_part(coalesce(new.email, new.id::text), '@', 1), '[^a-z0-9_]', '_', 'g'));
  normalized_handle := regexp_replace(normalized_handle, '_{2,}', '_', 'g');
  normalized_handle := trim(both '_' from normalized_handle);
  if normalized_handle = '' then
    normalized_handle := 'user';
  end if;
  if length(normalized_handle) > 12 then
    normalized_handle := left(normalized_handle, 12);
  end if;
  normalized_handle := left(normalized_handle || '_' || left(replace(new.id::text, '-', ''), 7), 20);

  candidate_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(coalesce(new.email, ''), '@', 1),
    new.id::text
  );

  -- Ensure the generated handle is unique within the profiles table.
  -- This is a lightweight fallback for duplicate names.
  declare
    handle_candidate text := normalized_handle;
    suffix int := 1;
  begin
    while exists (select 1 from public.profiles where handle = handle_candidate) loop
      handle_candidate := left(normalized_handle, greatest(1, 20 - length(suffix::text) - 1)) || '_' || suffix::text;
      suffix := suffix + 1;
    end loop;

    insert into public.profiles (
      id,
      handle,
      display_name,
      units,
      theme,
      week_start,
      avatar_emoji,
      nudge_pref,
      created_at
    ) values (
      new.id,
      handle_candidate,
      coalesce(nullif(trim(candidate_name), ''), new.id::text),
      'km',
      'light',
      1,
      null,
      'daily',
      now()
    ) on conflict (id) do nothing;
  end;

  return new;
end;
$$;

create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute function public.create_profile_on_signup();

create or replace function public.shares_group_with(target_owner uuid, viewer uuid)
returns boolean
language sql
security definer
as $$
  select false;
$$;

alter table public.profiles enable row level security;

create policy "Profile select: own row or group member"
  on public.profiles
  for select
  using (
    auth.uid() = id
    or shares_group_with(id, auth.uid())
  );

create policy "Profile update: own row only"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Profile insert: own row only"
  on public.profiles
  for insert
  with check (auth.uid() = id);
