# @pacer/api

The Pacer API: a [Hono](https://hono.dev) server on `@hono/node-server`, run by **tsx with no
build step** (dev = watch, prod = the same entry). It is the spine every feature slice plugs into —
routes, event-bus subscribers, and DB migrations all hang off the foundations here.

## What's in this card (Foundation B — API skeleton)

- `src/index.ts` — server entry (`@hono/node-server`).
- `src/app.ts` — Hono app assembly; global auth guard (skips public prefixes), mounts the route registry, imports subscribers for side-effects.
- `src/lib/supabase.ts` — `serviceClient()` (service-role, bypasses RLS) + `userClient(jwt)` (per-request, RLS applies).
- `src/lib/auth.ts` — bearer-JWT auth middleware + the typed `AppEnv` context (`userId`, `userClient`).
- `src/lib/events.ts` — in-process event bus (`emit` / `on`), typed over the shared event catalog.
- `src/lib/realtime.ts` — `broadcast(channel, event)` over Supabase Realtime; **no-op-safe** when unconfigured.
- `src/lib/validate.ts` — `zValidator` wrapper for a uniform 422 error shape.
- `src/routes/` — append-only route registry; ships `health` + `profile` only.
- `src/subscribers/` — append-only subscriber registry; ships empty.

> The `profiles` table, signup trigger, RLS, and `shares_group_with()` live in
> `supabase/migrations/0001_foundation.sql` (the database task). This skeleton is written against
> that schema but does not own the migration.

## Run locally

1. `cp apps/api/.env.example apps/api/.env` and fill in the values (Supabase URL + anon +
   service-role keys; optional JWT secret; `PORT`).
2. From the repo root: `pnpm --filter @pacer/api dev` — boots under `tsx watch`, no build.
3. Verify:
   - `curl localhost:$PORT/health` → `{"ok":true}` (no auth, no DB).
   - `curl localhost:$PORT/profile/me` → `401` (no token).
   - `curl -H "Authorization: Bearer <jwt>" localhost:$PORT/profile/me` → the caller's profile.
   - `PATCH /profile/me` with `{"units":"mi"}` → updated row; with `{"units":"furlongs"}` → `422`.

## Conventions other slices follow here

- **Add a route:** create `src/routes/<slice>.ts`, then add one line to `src/routes/index.ts`. Authed
  by default; public routes add their prefix to `PUBLIC_PATH_PREFIXES` in `app.ts`.
- **Add a subscriber:** create `src/subscribers/<slice>.ts` that calls `on('event', handler)` at
  module top level, then add `import './<slice>';` to `src/subscribers/index.ts`.
- **Two clients, two trust levels:** request handlers use the per-request `userClient` (RLS applies);
  only trusted server work uses `serviceClient()`. Never hand the service client request-derived input.
- **Realtime carries WHAT changed, not data:** `broadcast()` sends `{ type, ids }`; clients refetch
  via the normal API path.

## Migration workflow (database task)

Migrations live in `supabase/migrations/` and run in timestamp/order-prefixed order.

- New migration: `supabase migration new <name>` → edit the generated SQL.
- Apply to the project: `supabase db push`.
- **Staging and production share one Supabase project** — push migrations **once**; the change is live
  for both environments. (See `docs/09-DEPLOY.md`.)
