# 09 — Deploy (Railway, git-driven)

**Deploys happen by merging git branches — never from a laptop.** No `railway up`, no CLI deploys, no
"push from my machine to prod". Railway watches GitHub and redeploys when a branch moves:

```
merge PR → dev   ──▶  Railway STAGING redeploys
merge PR → main  ──▶  Railway PRODUCTION redeploys
```

That's the whole deploy story. If you ever feel tempted to deploy by hand, you're about to ship
something that isn't on `main` — open a PR instead.

## Topology
Two Railway **environments**, each running the same two **services** from this repo:

| Environment | Tracks branch | Supabase project | Telegram bot |
| --- | --- | --- | --- |
| **production** | `main` | Pacer-prod | the real BotFather bot |
| **staging** | `dev` | Pacer-staging (separate!) | a separate staging bot |

| Service | What | Build / start | Notes |
| --- | --- | --- | --- |
| `pacer-api` | Hono on Node | no build — `tsx` runs it; start `pnpm --filter @pacer/api start` | `RAILPACK_NODE_VERSION=22` |
| `pacer-web` | Vite SPA | `pnpm --filter @pacer/web build` → static | `RAILPACK_SPA_OUTPUT_DIR=apps/web/dist`, `RAILPACK_NODE_VERSION=22` |

> Staging and production get **separate Supabase projects** and **separate Telegram bots** — staging
> traffic must never touch production data. (Migrations: `supabase db push` against each project.)

## Secrets / env vars — dashboard only, never git
Every secret lives in the **Railway service variables** (and Supabase dashboard), set **per
environment**. Nothing sensitive is ever committed — the repo only ships `apps/api/.env.example`
with the variable **names**. Staging variables point at the staging Supabase/bot; production at prod.

| Service | Variables (set in Railway, per environment) |
| --- | --- |
| `pacer-api` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `WEB_ORIGIN` |
| `pacer-web` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` |

The browser gets **only** the anon key (`VITE_*`). The service-role key lives in `pacer-api` and is
never exposed to the web build.

## One-time setup (whoever owns the Railway account)
1. **New Project** → *Deploy from GitHub repo* → pick the Pacer repo. Authorize Railway on the repo.
2. Create the two services (`pacer-api`, `pacer-web`) from the same repo; set each one's build/start
   commands and `RAILPACK_*` variables as above (pnpm workspace, so install runs at the repo root).
3. Rename the default environment to **production** and set its services to deploy from **`main`**.
4. **Create a second environment, staging**, and set its services to deploy from **`dev`**.
5. Add the env vars per environment (step above), pointing each at its own Supabase project + bot.
6. Point the Telegram webhook for each bot at its environment's `pacer-api` `/webhook` URL.
7. Done — from now on, merging to `dev`/`main` deploys staging/production automatically.

> The Railway MCP / `use-railway` skill can do most of this from chat, but the **deploy trigger stays
> git** — Railway redeploys on branch updates; we don't push builds from a machine.

## Verifying a deploy
- Staging: after a `dev` merge, hit the staging `pacer-web` URL and `pacer-api` `/health`.
- Production: after a release PR (`dev`→`main`) merges, same checks on the production URLs.
- Rollback = revert the merge commit on the branch (another PR) — Railway redeploys the previous state.
