# CLAUDE.md

Guidance for working in the **Pacer** repo. Read the relevant `docs/` card before you build.

## What this is

Pacer — a fitness-tracking PWA for individuals and small private groups (family/friends). pnpm
monorepo, greenfield:

- `packages/shared` — TS contracts everyone imports (zod schemas, unit/date helpers, scoring, events). Consumed as **raw TS, no build step**.
- `apps/api` — Hono server (+ Supabase, event bus, realtime). _Foundation B._
- `apps/web` — React 19 + Vite PWA. _Foundation C._

## Docs are the source of truth

- `docs/01-SPECS.md` — product spec (**§6 = the scoring table**).
- `docs/04-DATA-MODEL.md` — DB schema + RLS rules.
- `docs/06-TECH-STACK.md` — the **only** packages allowed.
- `docs/07-WORKFLOW.md` — git / branch / PR workflow.
- `docs/08-CONVENTIONS.md` — file ownership + the five cross-slice channels.
- `docs/tasks/*.md` — one card per task; build **only the files your card owns**.

## Hard rules

- **Packages**: use only what's in `06-TECH-STACK.md`. Don't `pnpm add` anything else — raise it with the team and add it to that doc in the same PR.
- **Canonical units**: store **meters & seconds**; derive km/mi/pace/durations via `@pacer/shared` helpers at display time. Never store a display value.
- **Theming**: every color, font, radius, and spacing value lives in one token file (`apps/web/src/theme/tokens.css`, owned by Foundation C). Components reference tokens (`bg-surface`, `text-ink`) — **never** a raw hex / font name / px radius.
- **Ownership**: build only inside your card's owned files. Need another slice's data or behavior? Use one of the five channels in `08-CONVENTIONS.md` (shared package · HTTP API · event bus · `broadcast()` · append-only registries) — never edit another slice's files.
- **Git**: never push to `main` or `dev` (both are PR-protected). Branch `feat/<NN>-<slug>` off `dev`; open a PR **into `dev`**. Release = PR `dev` → `main`.
- **Secrets**: never commit `.env` or keys. The only committed env file is `apps/api/.env.example` (variable names, no values).

## Commands

- `pnpm install` — Node 22 + pnpm 11 (pinned via `packageManager`; engine-strict).
- `pnpm typecheck` — strict `tsc` across all workspaces. This is the CI gate.
- `pnpm test` — shared unit tests (run via `tsx` + Node's built-in test runner).

## Shared contracts (`packages/shared`)

One zod schema per entity is the source of truth — infer types from it (`z.infer`). The package
also holds the pure unit/date helpers, `POINTS` + `scoreFor()` (the single scoring formula web/api/bot
all agree on), and the domain + realtime event catalog. Append-only: add your entity's schema file
and one line to the barrel; don't rewrite shared logic.
