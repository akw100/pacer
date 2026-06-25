# 02 — Foundation B — API skeleton + database foundation

> **Stage:** Foundation  ·  **Suggested order:** 2  ·  **Size:** L  ·  **One owner builds this end to end.**

**Goal (one sentence).** Stand up the Hono API skeleton (health, two Supabase clients, JWT auth middleware, zod-validator wiring, route registry, event bus, subscribers registry, broadcast helper) and the first database migration (`profiles` table + signup trigger, the `SECURITY DEFINER` RLS helper `shares_group_with()`, per-table RLS conventions), plus `.env.example` and the migration workflow docs — so every other slice has a place to hang routes, subscribers, tables, and policies.

**Why it matters / where it sits in the product.** This is the spine every other card plugs into: runs, workouts, habits, scoring, groups, challenges, the Telegram bot, and the assistant all register routes here, subscribe to the event bus here, and add RLS policies that lean on `shares_group_with()`. Nothing else can be merged until these append-only contracts and the `profiles`/auth foundation exist.

## Depends on
- **Foundation A — `packages/shared` (order 1).** You import the shared `Profile` zod schema and domain types for the `/profile/me` route, and the realtime event-type union + payload types for the event bus and `broadcast()`. **If shared isn't merged yet:** define a local minimal `Profile` zod schema inline and a local string-literal event name union to build against, then delete them and switch to the shared imports the moment shared lands. The bus/broadcast signatures are generic over the event name, so this swap is a one-line import change.
- **Supabase project (external, not a card).** You need a Supabase project (staging) with its URL, anon key, service-role key, and JWT secret to run locally. **If you don't have one yet:** the auth middleware and clients are written against env var names from `.env.example`; you can build and typecheck the whole skeleton with placeholder env values, and `/health` returns OK without touching the DB.

## You own these files (no other card touches them)
- `supabase/migrations/0001_foundation.sql` — the first migration; timestamp/order-prefixed so it never collides with later additive migrations.
- `apps/api/src/index.ts` — server entry (`@hono/node-server`).
- `apps/api/src/app.ts` — Hono app assembly, mounts the route registry.
- `apps/api/src/lib/supabase.ts` — the two Supabase client factories.
- `apps/api/src/lib/auth.ts` — JWT-verifying auth middleware + `AppContext` typing.
- `apps/api/src/lib/events.ts` — in-process event bus (`emit`/`on`).
- `apps/api/src/lib/realtime.ts` — `broadcast(channel, event)` Supabase Realtime helper.
- `apps/api/src/lib/validate.ts` — thin `@hono/zod-validator` re-export/wrapper for consistent error shape.
- `apps/api/src/routes/index.ts` — **route registry** (append-only; you create it + register only `health` and `profile`).
- `apps/api/src/routes/health.ts` — `/health`.
- `apps/api/src/routes/profile.ts` — `GET/PATCH /profile/me`.
- `apps/api/src/subscribers/index.ts` — **subscribers registry** (append-only; you create it empty/with a comment, register nothing).
- `apps/api/.env.example` — every required env var name, NO real secrets.
- `apps/api/package.json`, `apps/api/tsconfig.json` — API workspace manifest + TS config.
- `apps/api/README.md` — migration workflow + staging/prod project notes.

Other slices add `apps/api/src/routes/<slice>.ts`, `apps/api/src/subscribers/<slice>.ts`, and `supabase/migrations/<later-timestamp>_*.sql` — never your files except via the two append-only registries.

## Foundation contracts you CONSUME (never modify)
- **From `packages/shared`:** the `Profile` zod schema + `Profile` type (for `/profile/me`); the realtime **event-type union** + event-payload types (used to type `emit`/`on` and `broadcast`). You do **not** define `scoreFor()`, POINTS, or unit/date helpers — those live in shared.
- **Events:** you DEFINE the bus mechanism but EMIT nothing from this card except optionally nothing (profile edits don't score). You SUBSCRIBE to nothing here. Other slices emit/subscribe `run.logged`, `workout.logged`, `habit.checked`, `reaction.added`, `score.awarded`, `challenge.updated`.
- **Append-only registry lines you add:** in `routes/index.ts`, the registration lines for `health` and `profile` only. `subscribers/index.ts` ships with zero registrations (just the import-side-effect convention documented in a comment).

## Build order (do these in this sequence)
1. **Migration — `supabase/migrations/0001_foundation.sql`.**
   - `profiles` table: `id uuid primary key references auth.users(id) on delete cascade`, `handle text unique not null` (3–20 chars, case-normalized — store lower-cased, enforce with a `check` on length + a `citext`-style lower index or a `check (handle = lower(handle))`), `display_name text`, `units text not null default 'km' check (units in ('km','mi'))`, `theme text not null default 'light' check (theme in ('light','dark'))`, `week_start smallint not null default 1 check (week_start in (0,1))`, `avatar_emoji text`, `nudge_pref text not null default 'off' check (nudge_pref in ('off','daily','weekly'))`, `created_at timestamptz not null default now()`.
   - **Signup trigger:** a `SECURITY DEFINER` function `handle_new_user()` on `auth.users` `after insert` that inserts a `profiles` row (id = new user id, a provisional handle, default settings). Keep it minimal — habit seeding (Stretching, Nutrition) belongs to the habits card's migration, not here.
   - **RLS:** `alter table profiles enable row level security;` Policies: a user may `select`/`update` their own row (`auth.uid() = id`); `insert` is done by the trigger (service-definer), so no public insert policy. Group members reading each other's profile comes **later** via an additive policy in the groups card — do not add it here.
   - **`SECURITY DEFINER` RLS helper:** `create or replace function shares_group_with(other uuid) returns boolean language sql security definer set search_path = public` — body `exists`-checks that `auth.uid()` and `other` share at least one `public.group_members` row. `security definer` + the pinned `search_path` make it bypass RLS (so the additive group-read policies in other cards don't recurse). **Forward reference is intentional and safe:** the `group_members` table is created later by the groups card's migration; a SQL function resolves its table names at *call* time, not definition time, and migrations run in timestamp order (`0001` defines the function; groups' migration creates the table before any policy actually calls it). Define the helper here in `0001` — do NOT create `group_members` here (that's the groups card, and stubbing it would be overreach). This is the SOLE definition of shares_group_with(); the groups card (07) creates the group_members table this helper forward-references and CONSUMES the helper — it never re-declares it.
   - **Per-table RLS conventions (document at top of the file as a comment block):** every table enables RLS; default = own-rows (`auth.uid() = user_id`); group-visible reads are **additive `select` policies** using `shares_group_with(owner)`; writes are always own-rows; the service-role client bypasses RLS for trusted aggregation/ingestion.
2. **Shared — nothing to author here.** You consume shared's `Profile` schema/types and event union. (If shared is unmerged, see Depends-on fallback.)
3. **API.**
   - `index.ts`: boot `@hono/node-server` (port from env), import the assembled app from `app.ts`.
   - `app.ts`: create the Hono app, attach the auth middleware globally except `/health` and (later) `/webhook`, mount `routes/index.ts`, import `subscribers/index.ts` for its registration side-effects.
   - `lib/supabase.ts`: `serviceClient()` (service-role key, no user context — trusted server work only) and `userClient(jwt)` (anon key + the request's bearer JWT set as the auth header, so RLS applies). Never expose the service client to anything request-derived.
   - `lib/auth.ts`: middleware reads the `Authorization: Bearer <jwt>`, verifies it with the Supabase JWT secret (or via `userClient(jwt).auth.getUser()`), sets `c.set('userId', ...)` and `c.set('userClient', userClient(jwt))` into a typed `AppContext`. Reject with 401 on missing/invalid token.
   - `lib/validate.ts`: re-export `@hono/zod-validator`'s `zValidator` with a shared error formatter so all slices return a uniform 422 shape.
   - `routes/index.ts`: export a function that registers route modules onto the app; add the two append-only lines for `health` and `profile`.
   - `routes/health.ts`: `GET /health` → `{ ok: true }`, no auth, no DB.
   - `routes/profile.ts`: `GET /profile/me` (read own profile via `userClient`), `PATCH /profile/me` (validate body with the shared `Profile` partial schema via `zValidator`, update own row). Emits/broadcasts nothing.
   - `lib/events.ts`: typed `emit(name, payload)` + `on(name, handler)` over the shared event union; synchronous in-process dispatch, errors in one handler don't block others.
   - `lib/realtime.ts`: `broadcast(channel, event)` using `@supabase/supabase-js` Realtime; **no-op-safe** — if Realtime isn't configured, it logs and returns without throwing. Channels `group:<id>` and `user:<id>`; events carry `{ type, ids }` only, never row data.
   - `subscribers/index.ts`: created with a header comment explaining the "import your `subscribers/<slice>.ts` for its side effects, one append-only line" convention; registers nothing itself.
4. **Web — nothing in this card.** No `apps/web` files are owned or touched here. The web app shell and `apps/web/src/lib/api.ts` belong to Foundation C. (This card is API + DB only.)

## Packages (ONLY these — all from the stack)
- **hono** — the API framework.
- **@hono/node-server** — Node runtime adapter.
- **@hono/zod-validator** — zod validation at route boundary.
- **@supabase/supabase-js** — two DB/auth clients + Realtime broadcast.
- **zod** — schema validation (via shared schemas).
- **tsx** — dev + prod runner, no build step.
- **typescript** — strict typing across the workspace.

## Acceptance criteria — the PR gate (copy this checklist into your PR description)
- [ ] `pnpm --filter api dev` (tsx watch) boots with no build step; `GET /health` returns `{ ok: true }` with no auth and no DB call.
- [ ] `0001_foundation.sql` applies cleanly via `supabase db push` to a fresh project; creating an auth user auto-inserts a `profiles` row via the trigger.
- [ ] RLS is enabled on `profiles`; a user can read/update only their own row; the `shares_group_with()` `SECURITY DEFINER` helper exists and is referenced correctly (resolves at call time against `group_members`).
- [ ] Auth middleware rejects requests with a missing/invalid JWT (401) and populates `userId` + a per-request `userClient` for valid ones.
- [ ] `GET /profile/me` returns the caller's profile; `PATCH /profile/me` validates with the shared `Profile` schema (422 on bad input) and updates only the caller's row.
- [ ] `routes/index.ts` and `subscribers/index.ts` exist as append-only registries with the documented convention; only `health` + `profile` routes are registered.
- [ ] `lib/events.ts` (`emit`/`on`) and `lib/realtime.ts` (`broadcast`, no-op-safe) compile against the shared event union and are exported for other slices to consume.
- [ ] `.env.example` lists every required variable name with NO real secret values.
- [ ] `pnpm --filter api typecheck` passes; strict TS, no `any` escapes on the client/middleware boundaries.
- [ ] No hardcoded theme values (N/A here — API only; confirm no stray color/style constants leaked in).
- [ ] No secrets committed; `.env` is gitignored.

## How to verify locally
1. Copy `apps/api/.env.example` → `apps/api/.env`, fill in your staging Supabase URL/anon/service-role keys + JWT secret + `PORT`.
2. `pnpm --filter api dev` — server boots under tsx watch.
3. `curl localhost:$PORT/health` → `{"ok":true}`.
4. `curl localhost:$PORT/profile/me` with no auth → `401`.
5. In Supabase: create a test auth user → confirm a `profiles` row appears automatically (trigger).
6. Mint a JWT for that user (Supabase dashboard or `auth.signInWithPassword` from a scratch script), then `curl -H "Authorization: Bearer <jwt>" localhost:$PORT/profile/me` → returns that profile; `PATCH` with `{"units":"mi"}` → row updates; `PATCH` with `{"units":"furlongs"}` → `422`.
7. Run `supabase db push` against a throwaway project and confirm `0001_foundation.sql` applies with no errors.

## Out of scope for this card
- Any other table (runs, workouts, habits, plans, groups, challenges, reactions, score_events, telegram_*) — those are each their own card's migration.
- The group-member `select` policy on `profiles` (groups card adds it additively).
- Habit seeding at signup (habits card's migration).
- The web app shell, `apps/web/src/lib/api.ts`, the Supabase browser client, TanStack Query setup (Foundation C).
- `scoreFor()`, POINTS, unit/date helpers, all zod entity schemas beyond consuming `Profile` (Foundation A).
- Telegram, assistant, stats, and all business routes — they register themselves later via the append-only route registry.

## Copy-paste kickoff prompt for Claude
```
You are building the "Foundation B — API skeleton + database foundation" slice of Pacer, a
greenfield fitness-tracking PWA (pnpm monorepo: packages/shared, apps/api, apps/web). Build
everything fresh; the only things to build against are the foundation contracts in this repo.

Build the apps/api Hono skeleton + the first DB migration, and NOTHING else. Open a PR into `dev`
when the acceptance criteria pass.

You OWN exactly these files (touch no others):
  supabase/migrations/0001_foundation.sql
  apps/api/src/index.ts
  apps/api/src/app.ts
  apps/api/src/lib/{supabase,auth,events,realtime,validate}.ts
  apps/api/src/routes/{index,health,profile}.ts
  apps/api/src/subscribers/index.ts
  apps/api/.env.example
  apps/api/{package.json,tsconfig.json,README.md}

CONTRACTS you consume (never redefine): the `Profile` zod schema + type and the realtime
event-type union + payload types from `packages/shared`. If shared isn't merged yet, define a
minimal local Profile schema + event-name union, then swap to shared imports later (one-line change).

Build order:
 1. 0001_foundation.sql: `profiles` table (id=auth uid, unique case-normalized handle 3-20,
    display_name, units 'km'|'mi' default km, theme 'light'|'dark' default light, week_start
    0|1 default 1, avatar_emoji, nudge_pref 'off'|'daily'|'weekly' default off, created_at);
    a SECURITY DEFINER `handle_new_user()` trigger on auth.users that inserts the profile row;
    enable RLS with own-row select/update policies; a SECURITY DEFINER `shares_group_with(uuid)`
    helper (set search_path=public) that exists-checks `group_members` (forward reference — the
    groups migration creates that table; SQL functions resolve table names at call time). Add a
    top-of-file comment block documenting the per-table RLS conventions (own-rows default,
    additive group-read via shares_group_with, service-role bypasses RLS).
 2. apps/api skeleton: index.ts boots @hono/node-server; app.ts assembles Hono, applies auth
    middleware globally except /health, mounts routes/index.ts, imports subscribers/index.ts for
    side effects. lib/supabase.ts exports serviceClient() (service-role, trusted only) and
    userClient(jwt) (anon key + bearer JWT so RLS applies). lib/auth.ts verifies the Supabase JWT,
    sets userId + userClient into a typed context, 401s on bad token. lib/validate.ts wraps
    @hono/zod-validator with a uniform 422 error shape. lib/events.ts: typed emit/on over the
    shared event union (sync, isolated handler errors). lib/realtime.ts: broadcast(channel,event)
    via @supabase/supabase-js Realtime, NO-OP-SAFE if unconfigured; channels group:<id>/user:<id>,
    events carry {type, ids} only. routes/index.ts: append-only registry, register health+profile
    only. routes/health.ts: GET /health -> {ok:true}, no auth/DB. routes/profile.ts: GET/PATCH
    /profile/me using the per-request userClient; PATCH validated by the shared Profile schema.
    subscribers/index.ts: header comment documenting the "import your subscribers/<slice>.ts for
    side effects, one append-only line" convention; register nothing.
 3. .env.example: list every required var name, NO real values — SUPABASE_URL, SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, PORT (add others only if you actually use them).
 4. apps/api/README.md: document the migration workflow (`supabase migration new <name>`,
    `supabase db push`) and that staging and production each get their OWN Supabase project.

Rules: GREENFIELD only. Use ONLY these packages: hono, @hono/node-server, @hono/zod-validator,
@supabase/supabase-js, zod, tsx, typescript. If you think you need another, STOP and add a line
"⚠️ NEEDS TEAM DECISION: <pkg> for <reason>" instead. Store canonical data only (no display values
in DB). No build step — tsx runs dev and prod. No secrets in the repo. Do NOT build any other
table, route, subscriber, the web app, or the shared package.
```
