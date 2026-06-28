-- Telegram account linking + short-lived link codes. Accessed only by the
-- service-role client (bot ingestion) and the authed /telegram/* routes.
-- Deny-all to anon/authenticated; service-role bypasses RLS.

create table if not exists public.telegram_links (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  telegram_user_id  bigint not null unique,
  telegram_username text,
  linked_at         timestamptz not null default now()
);

create table if not exists public.telegram_link_codes (
  code        text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz not null
);
create index if not exists telegram_link_codes_user_idx
  on public.telegram_link_codes (user_id);

alter table public.telegram_links       enable row level security;
alter table public.telegram_link_codes  enable row level security;
-- No policies => no access for anon/authenticated. Service-role bypasses RLS.
