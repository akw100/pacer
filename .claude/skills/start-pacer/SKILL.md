---
name: start-pacer
description: Start the Pacer fitness PWA locally — brings up the API (:8787) and web (:5173) together via `pnpm dev`, after checking it isn't already running, Node/pnpm versions, the two `.env` files, and freeing the strict 5173 port. Use whenever asked to "start/run/launch the project (or app)", "get Pacer running", "bring up local dev", or "spin up the dev servers" in the Pacer repo.
---

# Start Pacer locally

`pnpm dev` at the repo root runs the API and web **together** in parallel
(`pnpm -r --parallel run dev`). The web port is pinned to **5173** with
`--strictPort` because Supabase OAuth's redirect allow-list depends on it — it
fails fast if 5173 is taken rather than drifting to a port that bounces sign-in
to production. So free 5173 instead of letting it move.

## Steps

1. **Already running?** Check both ports first:
   ```sh
   lsof -nP -iTCP:5173 -sTCP:LISTEN; lsof -nP -iTCP:8787 -sTCP:LISTEN
   ```
   If both are listening, it's already up — report the URLs (below) and stop.

2. **Node 22 / pnpm 11.** The repo is engine-strict (`.nvmrc` = 22). If
   `node -v` isn't v22, run `nvm use` (then `nvm install` if needed).

3. **Deps.** If root `node_modules/` is missing, run `pnpm install`.

4. **Env files** — both must exist (gitignored; present on a set-up machine,
   missing on a fresh clone):
   - `apps/api/.env`  ← copy from `apps/api/.env.example`
   - `apps/web/.env`  ← copy from `apps/web/.env.example`

   If either is missing, copy the example and tell the user to fill in the real
   Supabase URL + keys — auth won't work with blank values.

5. **Free 5173 if stale.** If step 1 showed 5173 held by an old dev server you
   want to replace: `lsof -ti:5173 | xargs kill`. Don't kill a process the user
   may be using elsewhere without asking.

6. **Launch** from the repo root, in the background so it keeps serving:
   ```sh
   pnpm dev
   ```

7. **Verify.** API: `curl -s localhost:8787/health` → `{"ok":true}`.
   Web: `curl -sI localhost:5173` → `200`. Report both.

## URLs

- Web: http://localhost:5173
- API: http://localhost:8787  (health: `/health`)

## Gotcha — Google sign-in bounces to production

Sign-in is Supabase OAuth. If `http://localhost:5173` isn't in Supabase →
**Authentication → URL Configuration → Redirect URLs**, Google redirects back to
the prod Site URL instead of localhost. One-time fix: add the local origin to
that allow-list.
