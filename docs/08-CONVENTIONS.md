# 08 — Conventions (how four branches stay mergeable)

The whole point: each person builds a vertical slice end-to-end, merges to `dev` whenever they're
done, and the merges don't fight. That only works if everyone follows these.

## 1. Own a disjoint set of files

Each task card lists **the files it owns**. Build only inside your ownership. If you feel the urge to
edit a file another card owns, you've found a missing *contract* — add one (an event, a shared type,
an API endpoint) instead of editing their code. Cross-slice communication goes through exactly five
channels, and nothing else:

| Channel | What it's for | Where |
| --- | --- | --- |
| **Shared package** | types, zod schemas, pure helpers (units, dates, `scoreFor`) | `packages/shared/**` |
| **HTTP API** | read another slice's data | the route, never their DB tables directly |
| **Event bus** | react to something happening | `emit(name, payload)` / subscribe in your own `subscribers/<slice>.ts` |
| **`broadcast()`** | push a live update to clients | `apps/api/src/lib/realtime.ts` |
| **Append-only registries** | register your route / subscriber / UI section | add **one line**, never rewrite |

### The event bus (this replaces "editing each other")
Reacting to another slice = subscribing, not calling into it. Canonical events (defined in card 01):
`run.logged`, `workout.logged`, `habit.checked`, `reaction.added`, `score.awarded`, `challenge.updated`.

```
// apps/api/src/subscribers/scoring.ts  (scoring owns this file)
on('run.logged', async (e) => { /* write score_events via shared scoreFor() */ })
```
Then one append-only line in `apps/api/src/subscribers/index.ts`: `import './scoring'`.
That's how logging, scoring, plans, groups, and challenges interoperate without sharing a file.

### Append-only registries — add a line, never rewrite
- API routes → `apps/api/src/routes/index.ts` (one `register(app, '/runs', runs)`-style line).
- Subscribers → `apps/api/src/subscribers/index.ts` (one `import './yourslice'`).
- Home / Progress sections → drop your section component in your own feature folder, then add one
  import + one render line to the page's slot list. Never rewrite another slice's section.

Conflicts on a one-line-append file are trivial to resolve; conflicts inside shared logic are not —
so we never put slice logic in shared files.

### Migrations never collide
All migrations live in **`supabase/migrations/`** (repo root), timestamp-prefixed
(`supabase migration new <name>`). Each slice adds its own files. **Never edit a merged migration** —
add a new one. `0001_foundation.sql` (card 02) is the single definition of `profiles`, the auth
trigger, and the `shares_group_with()` RLS helper; other slices create their tables and *consume*
that helper, never redefine it.

### One canonical surface for the assistant tools
Tool **schemas** live in `packages/shared/src/assistant/tools.ts`; the **executor** is
`executeTool(name, rawArgs, ctx)` in `apps/api/src/lib/assistant/index.ts`. Telegram, chat, and voice
all call `executeTool(...)` — they never re-implement logging/challenge logic.

## 2. Packages: only what's in the stack
Use **only** the packages in [`06-TECH-STACK.md`](06-TECH-STACK.md). Exact names matter:
`motion` (not `framer-motion`), `react-router` v7 (not `react-router-dom`), `@number-flow/react`.
Don't add a dependency for something a few lines or the stdlib/platform can do.

**Need something not on the list?** Don't `pnpm add` it. Raise it with the team (a quick message or a
draft PR comment); if everyone agrees, add it to `06-TECH-STACK.md` in the same PR so the list stays
the single source of truth. A card may flag `⚠️ NEEDS TEAM DECISION: <pkg>` — that's the signal.

## 3. Theming: change one file
Every color, font, radius, and spacing value lives in **one** token file
(`apps/web/src/theme/tokens.css`, Tailwind v4 `@theme`). Components reference tokens
(`bg-surface`, `text-ink`, `rounded-card`) — **never a raw `#hex`, font name, or px radius**.
Re-theming the whole app = editing that one file. A hardcoded color in a PR is a review blocker.

## 4. Data & security
- **Canonical units:** store **meters and seconds**; derive km/mi/pace/durations via the shared
  helpers at display time. Never store a display value.
- **RLS on every table:** own rows by default; group reads via the additive `shares_group_with()`
  policies. The **service-role** Supabase client is for trusted server work only (aggregation,
  Telegram ingestion) — **never** shipped to the browser. The browser uses the **anon** key only.
- **No secrets in git.** No `.env`, API keys, or service-role keys, ever — real values live in the
  Railway/Supabase dashboards (`09-DEPLOY.md`). The `.gitignore` keeps them out; if you ever find
  yourself about to commit one, stop — you were about to leak something. The only committed env file
  is `apps/api/.env.example` (variable **names**, no values).

## 5. Layout & naming
```
packages/shared/src/          schemas/<entity>.ts · units.ts · dates.ts · scoring.ts · events.ts · assistant/
apps/api/src/                 routes/<resource>.ts · subscribers/<slice>.ts · lib/<concern>.ts
apps/web/src/features/<slice>/ everything for one slice's UI (components, hooks, queries)
apps/web/src/{theme,app,components/ui,routes,lib}/  foundation-owned shell — slices don't edit these
supabase/migrations/          <timestamp>_<slice>.sql
```
- One slice = one `features/<slice>/` folder + its own routes/subscriber/schema files.
- TypeScript strict; zod schema is the source of truth for a shape (infer types from it).
- TanStack Query for all server state; realtime events just invalidate query keys.
- Definition of done for any card: acceptance criteria pass · `pnpm typecheck` green · phone **and**
  desktop · teaching empty state · token-only styling · no secrets.
