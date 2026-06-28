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
Two Railway **environments**, each running the same three **services** from this repo:

| Environment | Tracks branch | Supabase project | Telegram bot |
| --- | --- | --- | --- |
| **production** | `main` | shared `Pacer` project (`uqzhpnjwbzgzazagitlz`) | the real BotFather bot |
| **staging** | `dev` | **same** shared project (no separate staging DB) | a separate staging bot |

| Service | What | Build / start | Notes |
| --- | --- | --- | --- |
| `pacer-api` | Hono on Node | no build — `tsx` runs it; start `pnpm --filter @pacer/api start` | `RAILPACK_NODE_VERSION=22` |
| `pacer-web` | Vite SPA | `pnpm --filter @pacer/web build` → static | `RAILPACK_SPA_OUTPUT_DIR=apps/web/dist`, `RAILPACK_NODE_VERSION=22` |
| `pacer-frames` | Python video worker | Dockerfile build, root `services/frames/` | needs `ffmpeg` (in the Dockerfile); called only by `pacer-api` |

> Staging and production **share one Supabase project** (`uqzhpnjwbzgzazagitlz`) — same Postgres,
> Auth, and Storage. Only the **Telegram bots** are separate. Consequences to keep in mind:
> - **No data isolation**: staging reads/writes the same rows and users as production. Treat staging
>   writes as touching real data.
> - **Migrations run once** — `supabase db push` to the one shared project, not per environment.
> - **One Auth project = one Site URL**, so OAuth (Google sign-in) only returns to an env whose web
>   origin is in the project's **Redirect URLs** allow-list (Authentication → URL Configuration). Keep
>   every env's web URL there — `https://pacer-web-staging-cc40.up.railway.app/**`,
>   `https://pacer-web-production-b697.up.railway.app/**`, `http://localhost:5173/**` — or sign-in
>   falls back to the Site URL (prod) and lands users on the wrong environment.

## Live environments
Wired in Railway project **Pacer** (`f0b60e9a-cd91-4427-a37f-efc08d43c05f`). Both services are connected
to `akw100/pacer` via the GitHub App and track their branch per environment. Secrets are still to be
filled per environment in the dashboard (see below); the first successful deploy waits on the api `start`
and web `build` scripts landing.

| Environment | Branch | `pacer-api` | `pacer-web` |
| --- | --- | --- | --- |
| production | `main` | https://pacer-api-production-8c8a.up.railway.app | https://pacer-web-production-b697.up.railway.app |
| staging | `dev` | https://pacer-api-staging-6281.up.railway.app | https://pacer-web-staging-cc40.up.railway.app |

Telegram webhook target per env = that environment's `pacer-api` URL + `/webhook`. The non-secret
`WEB_ORIGIN` / `VITE_API_URL` cross-refs are already set per environment to the URLs above.

## Secrets / env vars — dashboard only, never git
Every secret lives in the **Railway service variables** (and Supabase dashboard), set **per
environment**. Nothing sensitive is ever committed — the repo only ships `apps/api/.env.example`
with the variable **names**. Both environments point at the **same Supabase project** (same
`SUPABASE_URL`/keys); what differs per env is the Telegram bot and the web/api URLs.

| Service | Variables (set in Railway, per environment) |
| --- | --- |
| `pacer-api` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `WEB_ORIGIN`, `FRAMES_SERVICE_URL`, `INTERNAL_TOKEN` |
| `pacer-web` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` |
| `pacer-frames` | `INTERNAL_TOKEN` (same value as api), `API_BASE_URL` (the env's `pacer-api` URL), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, optional `YTDLP_COOKIES`, `YTDLP_PROXY`, and tuning (`MAX_VIDEO_MINUTES`, …) |

The browser gets **only** the anon key (`VITE_*`). The service-role key lives in `pacer-api` and is
never exposed to the web build.

## One-time setup (whoever owns the Railway account)
1. **New Project** → *Deploy from GitHub repo* → pick the Pacer repo. Authorize Railway on the repo.
2. Create the three services from the same repo. `pacer-api`/`pacer-web` set build/start commands and
   `RAILPACK_*` as above (pnpm workspace, install runs at the repo root). `pacer-frames` builds from
   `services/frames/Dockerfile` (set the service root to `services/frames`); `FRAMES_SERVICE_URL` on
   the api points at this service's URL, and both share one `INTERNAL_TOKEN`. The private
   `video-frames` Storage bucket is created by migration `0008`, not the dashboard.
3. Rename the default environment to **production** and set its services to deploy from **`main`**.
4. **Create a second environment, staging**, and set its services to deploy from **`dev`**.
5. Add the env vars per environment (step above) — both environments use the **same Supabase project**
   (same `SUPABASE_URL`/keys), each its own Telegram bot and its own web/api URLs. Add every env's web
   origin to the Supabase **Redirect URLs** allow-list so OAuth returns to the right environment.
6. Point the Telegram webhook for each bot at its environment's `pacer-api` `/webhook` URL.
7. Done — from now on, merging to `dev`/`main` deploys staging/production automatically.

> The Railway MCP / `use-railway` skill can do most of this from chat, but the **deploy trigger stays
> git** — Railway redeploys on branch updates; we don't push builds from a machine.

## Verifying a deploy
- Staging: after a `dev` merge, hit the staging `pacer-web` URL and `pacer-api` `/health`.
- Production: after a release PR (`dev`→`main`) merges, same checks on the production URLs.
- Rollback = revert the merge commit on the branch (another PR) — Railway redeploys the previous state.
