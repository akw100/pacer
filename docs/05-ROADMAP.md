# 05 — Roadmap (MVP-first, built in parallel)

The build is **one short shared phase, then a wide parallel phase.** This doc is the map: the three
stages, what the MVP is, and exactly who-owns-what so four people never touch the same file. Each row
links to a self-contained card in [`tasks/`](tasks/) with a copy-paste kickoff prompt.

> **The only hard rule is: foundation first.** After that, the order is a *recommendation* (do the
> highest-value thing first), not a schedule. Slices are independent — pick any open card, build it,
> merge it to `dev` whenever it's done. Nobody waits on anyone.

## ⏱ The 1-day plan (what's critical)

This is a ~1-day build — be ruthless about scope:

- **Must ship today (the critical path):** Stage 0 (foundation) + Stage 1 (MVP) = cards 01–05 → a
  working app: sign in → log runs/workouts → check habits → see your score. **That is the goal.**
- **Only if time is left (stretch):** Stage 2 (cards 06–14), in value order — realistically you'll get
  at most Groups (07). **Cut from the bottom** when time's short: drop 14 (voice) first, then 13
  (onboarding/PWA polish), 08, 12, 11 … keep 07 if you can.
- Split the critical path across everyone (use the task list) so foundation + MVP land fast, then
  regroup on whatever stretch slice is worth it. Don't gold-plate anything.

---

## Stage 0 — Foundation · do this FIRST, together · cards 01–03

The only sequential, blocking work. It scaffolds the monorepo and defines the **contracts** every
other card builds against. Until all three are merged to `dev`, nothing else can really start.
Fastest path: one or two people sprint these (they're mostly scaffolding); everyone else reads their
card and drafts their migration + schema against the contracts so they can move the moment it lands.

| Card | Delivers | Owns (top level) |
| --- | --- | --- |
| [01 — Scaffold + shared contracts](tasks/01-foundation-scaffold-and-shared.md) | pnpm monorepo; the shared package = the contract surface (zod schemas, unit/date helpers, `scoreFor()`+POINTS, the event-name catalog, tool-schema stub) | root config, `packages/shared/**` |
| [02 — API skeleton + DB foundation](tasks/02-foundation-api-and-database.md) | Hono skeleton, two Supabase clients, auth, the **event bus**, no-op-safe **`broadcast()`**, the append-only **route + subscriber registries**, migration `0001_foundation.sql` (profiles + auth trigger + the **`shares_group_with()`** RLS helper) | `apps/api/src/lib,routes,subscribers/**`, `supabase/migrations/0001_*` |
| [03 — Web shell + auth + theme](tasks/03-foundation-web-shell-auth-theme.md) | React 19 + Vite chassis, the **single theme-token file**, 5-route shell (bottom tabs / sidebar), custom Toggle/Segmented/Select, the **section-slot** pattern, Google sign-in + handle claim | `apps/web/src/{theme,app,components/ui,routes,lib}/**`, `apps/web/src/features/auth/**` |

---

## Stage 1 — MVP · the minimum usable product · cards 04–05

After these, **Pacer is a real, usable product**: sign in → log runs/workouts → check daily habits →
see your score, streak, records, calendar, and trends. A complete solo tracker. **Ship 01–05 to
staging, then production — that's v1.0.** Everything after this is additive.

> **No realtime in the MVP.** Live updates (leaderboards/feeds reordering on the fly) are *not* part of
> v1.0 — they're built entirely in Groups (card 07). The foundation ships a no-op `broadcast()` seam so
> Groups can light it up later, but the MVP subscribes to nothing and just refreshes the normal way.

| Card | Delivers | Owns (top level) |
| --- | --- | --- |
| [04 — Logging: runs & workouts](tasks/04-mvp-logging-runs-workouts.md) | the hero action: Log sheet (run + workout forms), History + Trends; emits `run.logged`/`workout.logged` | `…/schemas/{run,workout}.ts`, `apps/api/src/routes/{runs,workouts}.ts`, `apps/web/src/features/logging/**` |
| [05 — Habits, scoring, records & calendar](tasks/05-mvp-habits-scoring-records.md) | daily habit ritual + the scoring engine (subscriber writes `score_events`), score/streak chips, Records, Calendar | `…/schemas/habit.ts`, `apps/api/src/routes/{habits,score}.ts`, `apps/api/src/subscribers/scoring.ts`, `apps/web/src/features/{habits,scoring,progress}/**` |

> 04 and 05 lightly couple through the **event bus** (scoring subscribes to `run.logged`). They can be
> built in parallel: 05 builds against the event payload types from card 01; if logging isn't merged
> yet, a run still saves and points attach as soon as both are on `dev`. No file is shared.

---

## Stage 2 — Post-MVP slices · parallel, any order, merge when ready · cards 06–14

Each is an independent vertical slice that depends only on the foundation contracts (+ MVP data).
Different owners, different speeds, merge whenever each is done.

| Card | Value | Notes on sequencing |
| --- | --- | --- |
| [07 — Groups, leaderboard & realtime](tasks/07-groups-leaderboard-realtime.md) | **Highest** — this is the social/competitive hook and the retention feature | Do this first among post-MVP. Test with the real family group on staging. |
| [10 — Assistant tool layer (shared)](tasks/10-assistant-tool-layer.md) | Enabler | **Build before 11, 12 & 14** — they all consume `executeTool()`. Small. No UI. |
| [06 — Plans (running ramp + workout template)](tasks/06-plans-running-and-workout.md) | Personal stickiness | Subscribes to `run.logged` to auto-complete scheduled runs. |
| [08 — Platform stats (community card)](tasks/08-platform-stats-community-card.md) | Motivation | Smallest slice (S). Anonymous aggregates only; no new tables. |
| [09 — Challenges](tasks/09-challenges.md) | Engagement | Reads groups via the API only. |
| [11 — Telegram bot](tasks/11-telegram-bot.md) | Effortless logging | Needs card 10. First consumer of the tool layer. |
| [12 — Assistant chat (in-app)](tasks/12-assistant-chat.md) | Delight | Needs card 10. Independent of Telegram. |
| [13 — Onboarding, PWA & polish](tasks/13-onboarding-pwa-polish.md) | First-run + installability | Best once most features exist (it links to them). Each slice owns its own empty states; 13 owns onboarding/PWA only. |
| [14 — Voice (post-v1)](tasks/14-voice-post-v1.md) | Wow | **Last.** Optional. Needs cards 10 + 12. Ships after v1 launch. |

### The only cross-slice dependencies (everything else is fully independent)
```
foundation (01→02→03)  ──blocks──▶  everything
04 logging ──run.logged event──▶ 05 scoring, 06 plans, 07 groups, 09 challenges   (via the event bus; no shared files)
05 scoring ──score_events table──▶ 07 groups, 08 platform, 09 challenges          (read via the API / service client)
10 tool layer ──executeTool()──▶ 11 telegram, 12 chat, 14 voice                   (shared dependency: build 10 first)
12 chat ──assistant-panel mount slot──▶ 14 voice
```
Every arrow is a **contract** (an event, a table read through the API, or an exported function) — never
a shared source file. That's what lets these merge independently. See [`08-CONVENTIONS.md`](08-CONVENTIONS.md).

---

## Run as many people in parallel as possible

The build is gated by only two things: **foundation is a shared prerequisite**, and within a feature the
web normally wants the API. You raise the ceiling by **landing the contracts first**, then **building the
web against those contracts + mock data** so front-end and back-end run at the same time.

**Two rules that unlock everyone:**
1. **Contracts before code.** Merge the shared zod schemas + types + event names (S2, card 01) and the API
   skeleton + registries (S3, card 02) *first and fast*. Once they exist, every other task builds against
   them in parallel — nobody waits for a feature to be "finished" to start theirs.
2. **The web never waits for the API.** A web task imports the shared zod schema and renders against a tiny
   mock response, then swaps to the real `apps/web/src/lib/api.ts` call when the API task merges. So the
   **DB+API half and the web half of a feature are built at the same time** by two people.

**Waves — how many can work at once:**

| Wave | In parallel | Concurrency |
| --- | --- | --- |
| **0** | S1 monorepo skeleton → S2 shared contracts | 1 person, fast — the *only* true bottleneck |
| **1** | S3 API skeleton · S4 DB foundation · S5 web chassis + theme | **3** (all need only S1/S2) |
| **2** | S6 UI primitives · M1 logging API+DB · M3 habits/scoring API+DB | **3** (S6 after S5; M1/M3 after S3/S4) |
| **3** | S7 auth · M2 logging web · M4 habits web | **3+** (web halves build against schemas/mocks) |
| **then** | any Stage-2 slice (Groups first) | **everyone** — fully independent |

After the ~1-person Wave 0, you're at **3–4 people working simultaneously** straight through. More hands?
Split further: S3 → (Hono + clients + auth) vs (event bus + registries); every migration is its own file.

**Railway is independent — wire it whenever.** It never blocks development (the app runs locally the whole
time). One person can connect Railway (`09-DEPLOY.md`) in parallel, or even *after* the MVP is built —
staging just starts deploying once it's hooked up. Only the repo + `dev` branch + protection need to exist
early, so PRs work from task one. Ship to production whenever a verified batch is on staging. **v1.0 = cards 01–05.**
