# 10 — Assistant tool layer (shared — powers Telegram, chat & voice)

> **Stage:** Post-MVP  ·  **Suggested order:** right after the MVP — build this BEFORE cards 11, 12 & 14, which all consume it.  ·  **Size:** M  ·  **One owner builds this end to end.**

**Goal (one sentence).** Define the provider-agnostic JSON-schema assistant TOOLS once in `packages/shared` and build the API-side EXECUTOR that runs each tool as a thin wrapper over the existing route handler with the caller's own user client — so RLS, scoring (via the event bus), and realtime broadcasts apply exactly as if the UI made the call.

**Canonical export surface (single source of truth).** Tool SCHEMAS live at `packages/shared/src/assistant/tools.ts`; the API executor is `executeTool(name, rawArgs, ctx)` at `apps/api/src/lib/assistant/index.ts`. This card replaces the placeholder `packages/shared/src/assistant-tools.ts` stub from card 01 — delete that stub (or re-export from `packages/shared/src/assistant/`) and point the shared barrel at `packages/shared/src/assistant/`. Downstream cards (11, 12, 14) consume `executeTool` from `apps/api/src/lib/assistant/index.ts`.

**Why it matters / where it sits in the product.** Three frontends (Telegram bot, in-app chat, realtime voice) all act on Pacer through one shared tool surface. Building that surface once — before the Telegram and Assistant-chat cards — prevents two slices from each inventing their own tool definitions and colliding. This card delivers schemas + executor framework only; it builds no user-facing surface.

## Depends on

- **`packages/shared` foundation (card 01)** — you ADD files here; consume the existing entity zod schemas (`Run`, `Workout`, `HabitCheck`, `Challenge`) and the unit/date helpers. If a schema you reference isn't merged yet, build against the field list in `04-DATA-MODEL.md` and import the real schema name the moment it lands; your tool schemas reference shared field shapes, not raw column names.
- **`apps/api` foundation (card 02)** — the event bus (`lib/events.ts`), `broadcast()` (`lib/realtime.ts`), and the route registry (`routes/index.ts`). The executor calls route handlers, which already `emit()` events and `broadcast()`; you add NOTHING to scoring or realtime — you just invoke the same handlers.
- **The underlying route slices (runs, workouts, habits, stats/leaderboard, challenges).** Build against whichever already exist; for routes that have NOT merged, register the tool in the schema but make its executor throw a typed `ToolNotAvailableError` so callers degrade gracefully. **`create_challenge` becomes real only once the Challenges card merges** — until then it is a registered-but-unavailable tool. You are never blocked: implement executors for the merged routes today, leave a one-line plug-in point per pending route.
- **No DB dependency.** No tables, no migration — this card touches the database only transitively through the route handlers it calls.

## You own these files (no other card touches them)

The canonical, single export surface: tool SCHEMAS live at `packages/shared/src/assistant/tools.ts`; the API executor is `executeTool(name, rawArgs, ctx)` at `apps/api/src/lib/assistant/index.ts`. **This card replaces the placeholder `packages/shared/src/assistant-tools.ts` stub from card 01 — delete that stub (or re-export from `packages/shared/src/assistant/`) and point the shared barrel at `packages/shared/src/assistant/`.** Downstream cards (11, 12, 14) consume `executeTool` from `apps/api/src/lib/assistant/index.ts`.

```
packages/shared/src/assistant/tools.ts            # the 7 tool definitions (name, description, zod params)
packages/shared/src/assistant/tool-schema.ts      # zod -> JSON-schema conversion + ToolDef type
packages/shared/src/assistant/index.ts            # re-exports for shared consumers

apps/api/src/lib/assistant/index.ts               # executeTool() dispatcher + registry
apps/api/src/lib/assistant/types.ts               # ToolContext, ToolResult, ToolNotAvailableError, DraftResult
apps/api/src/lib/assistant/executors/log-run.ts
apps/api/src/lib/assistant/executors/log-workout.ts
apps/api/src/lib/assistant/executors/check-habit.ts
apps/api/src/lib/assistant/executors/create-challenge.ts
apps/api/src/lib/assistant/executors/get-stats.ts
apps/api/src/lib/assistant/executors/get-leaderboard.ts
apps/api/src/lib/assistant/executors/navigate.ts
apps/api/src/lib/assistant/__tests__/executors.test.ts
```

No web files: this card ships no UI. The chat/voice cards own `apps/web/src/features/assistant/**`; the Telegram card owns its bot files. Both import FROM `packages/shared/src/assistant` and call `executeTool()`.

## Foundation contracts you CONSUME (never modify)

- **Shared entity zod schemas + helpers** (card 01): reference `Run`/`Workout`/`HabitCheck`/`Challenge` field shapes; reuse unit/date helpers so tool params speak canonical **meters & seconds** (an LLM that says "5k / 28 min" is normalized to meters/seconds by the chat/voice caller before tool execution — your params type accepts and validates meters & seconds, never display values).
- **Event bus** (card 02): you emit NOTHING new. The route handlers your executors call already `emit('run.logged' | 'workout.logged' | 'habit.checked' | 'challenge.updated', …)`; scoring and downstream subscribers fire automatically. Do not subscribe to events — this slice is a caller, not a reactor, so there is **no `subscribers/assistant.ts`** and no line in `subscribers/index.ts`.
- **`broadcast()`** (card 02): you call NOTHING directly; the underlying handlers broadcast on `group:<id>` / `user:<id>` exactly as a UI write would.
- **Route registry** (card 02): you add NO registration line — the executor is a library, not a route module. (The `POST /assistant/chat` and `/assistant/voice-token` routes belong to the Assistant-chat card.)
- **Append-only registry lines you add:** none. This is a pure library slice — its only public surface is the `packages/shared/src/assistant` exports and the `executeTool()` function.

## Build order (do these in this sequence)

1. **Migration** — **none.** No new tables, no columns, no RLS. The executor reuses every existing table's RLS by running through the caller's user client. (Stated explicitly so the owner does not create a stray migration.)

2. **Shared — tool definitions.** In `tool-schema.ts` define `ToolDef = { name; description; parameters: ZodSchema }` and a pure `toJsonSchema(tool)` that emits OpenAI-/Gemini-compatible JSON-schema (provider-agnostic). In `tools.ts` define the seven tools, each `parameters` built from / aligned with the shared entity schemas:
   - `log_run` — `{ distance_meters, duration_seconds, run_date, exertion_rating?, warm_up?, stretched?, post_run_food?, sleep_hours?, notes? }`
   - `log_workout` — `{ name, workout_date, kind, duration_seconds?, sets?: [{exercise_name, sets, reps, weight?}] }`
   - `check_habit` — `{ habit_id, check_date }` (toggle a day; matches `PUT /habits/:id/check`)
   - `create_challenge` — `{ audience, group_id?, metric, target, start_date, end_date, description?, youtube_url? }`
   - `get_stats` — `{ scope: 'personal'|'group'|'platform', group_id?, range?: 'week'|'month'|'all' }`
   - `get_leaderboard` — `{ group_id, sort?: 'score'|'km'|'runs' }`
   - `navigate` — `{ target: 'home'|'progress'|'group'|'plan'|'challenges'|'profile', id? }`
   Mark each tool `kind: 'write' | 'read' | 'client'`: writes (`log_run`, `log_workout`, `check_habit`, `create_challenge`) return a **draft** for confirm-card UX; reads (`get_stats`, `get_leaderboard`) return data; `navigate` is `kind: 'client'` — the executor just echoes a validated target for the frontend to route on (no server effect).

3. **API — executor framework.** In `lib/assistant/types.ts` define `ToolContext = { userClient: SupabaseClient; userId: string; confirm?: boolean }`, `ToolResult` (a union of `{ ok: true; draft: …}` | `{ ok: true; data: … }` | `{ ok:false; error }`), `DraftResult`, and `class ToolNotAvailableError extends Error`. In `index.ts` build `executeTool(name, rawArgs, ctx)` that:
   1. looks up the tool, **validates `rawArgs` with the shared zod `parameters`** (reject at the boundary),
   2. dispatches to the matching executor.
   Each executor is THIN — it calls the existing route handler logic using `ctx.userClient` (so RLS applies) and returns a `ToolResult`:
   - **Write tools** with `ctx.confirm !== true` return `{ ok:true, draft }` (parsed/normalized values + a human summary) and write NOTHING. Only `ctx.confirm === true` performs the real write through the handler — which `emit()`s the event so scoring/realtime fire. This is the same trust model as the Telegram ✓/✗ flow.
   - **Read tools** call `GET /…/stats` / `/groups/:id/stats` / leaderboard handlers via the user client and return data.
   - **`navigate`** validates and echoes `{ target, id }`.
   For routes not yet merged (e.g. `create_challenge` before Challenges lands), the executor throws `ToolNotAvailableError('create_challenge')` and `executeTool` maps it to `{ ok:false, error:'tool_unavailable' }` so the caller can tell the user "challenges aren't available yet." Leave a single clearly-commented plug-in line per pending route.
   No new Hono route is registered here.

4. **Web — none.** This card ships no components or pages. (Recorded explicitly so the owner does not build a chat UI — that is the Assistant-chat card.)

## Packages (ONLY these — all from the stack)

- **zod** — tool param schemas + boundary validation.
- **@supabase/supabase-js** — the per-request user JWT client the executor runs as (RLS).
- **date-fns** — normalize/validate dates in tool params via shared helpers.
- **typescript** — strict types for `ToolDef` / `ToolContext` / `ToolResult`.

(No `openai` here — the tool-calling LOOP lives in the Assistant-chat card; this card is provider-agnostic schemas + executor only. No new HTTP/JSON-schema lib: hand-write the small zod→JSON-schema mapping for the seven tools.)

## Acceptance criteria — the PR gate (copy this checklist into your PR description)

- [ ] Seven tools defined in `packages/shared/src/assistant/tools.ts`, each with a zod `parameters` schema and a `kind` (`write`/`read`/`client`).
- [ ] `toJsonSchema()` emits valid provider-agnostic JSON-schema (snapshot test for all seven).
- [ ] `executeTool()` validates `rawArgs` against the shared zod schema and rejects invalid input at the boundary (test proves a bad `distance_meters` is rejected).
- [ ] Write tools return a **draft** (no DB write) unless `ctx.confirm === true`; a confirmed `log_run` writes through the run handler so scoring fires (a `score_events` row appears) — proven by test against the merged runs route.
- [ ] Executor runs as `ctx.userClient` (user JWT) — never the service-role client — so RLS applies; a tool call cannot read/write another user's rows.
- [ ] Tool params and results are canonical **meters & seconds**; no km/mi/pace stored or invented (display is derived later via shared helpers).
- [ ] Unmerged routes (e.g. `create_challenge` if Challenges hasn't landed) yield `{ ok:false, error:'tool_unavailable' }` via `ToolNotAvailableError`, with a one-line plug-in comment — they never crash the dispatcher.
- [ ] No new tables/migration, no new Hono route, no `subscribers/assistant.ts`, no registry edits.
- [ ] No web/UI files added; no hardcoded theme values (N/A — no UI); no secrets (no API keys read here).
- [ ] `pnpm typecheck` passes across `packages/shared` and `apps/api`; tests pass.

## How to verify locally

1. `pnpm --filter @pacer/shared test` — JSON-schema snapshot test passes for all seven tools; a malformed param is rejected by the zod boundary.
2. `pnpm --filter @pacer/api test` (`__tests__/executors.test.ts`):
   - Call `executeTool('log_run', { distance_meters: 5000, duration_seconds: 1680, run_date: '2026-06-24' }, { userClient, userId, confirm: false })` → expect `{ ok:true, draft }` and assert **no** new `runs` row.
   - Repeat with `confirm: true` → expect a `runs` row AND a `score_events` row (`reason:'run'`) written via the handler/event bus, scoped to `userId`.
   - Call `get_leaderboard` for a group the user belongs to → returns rows; for a group they don't → RLS yields empty/no leak.
   - Call `create_challenge` while Challenges is unmerged → `{ ok:false, error:'tool_unavailable' }`, dispatcher stays up.
3. Confirm no migration file was added and `routes/index.ts` / `subscribers/index.ts` are untouched in your diff.

## Out of scope for this card

- The OpenAI tool-calling LOOP, SSE streaming, `POST /assistant/chat`, thread history, confirm cards, and the voice WebRTC / `voice-token` route — all the **Assistant-chat / voice card**.
- The Telegram webhook, free-text/photo parsing, inline keyboards — the **Telegram card** (it consumes `executeTool()`).
- Any new tables, the `set_form_field` client tool (lives in the voice card), and the actual run/workout/habit/challenge/stats route handlers (their own cards — you call them, you don't build them).
- Provider SDK wiring (OpenAI/Gemini) — your layer is provider-agnostic JSON-schema; the chat card chooses the provider.

## Copy-paste kickoff prompt for Claude

```
Build the Pacer "Assistant tool layer" slice (card 10) — greenfield, one owner, end to end.
Pacer is a fitness-tracking PWA. Build everything fresh; the only things to build against are the
foundation contracts below.

WHAT TO BUILD: provider-agnostic JSON-schema assistant TOOLS in packages/shared, plus the API-side
EXECUTOR that runs each tool as a thin wrapper over the existing route handler, using the CALLER'S
user client so RLS, scoring (event bus), and realtime broadcasts apply as if the UI made the call.
No UI, no new tables, no new HTTP route.

OWN THESE FILES ONLY:
  packages/shared/src/assistant/{tools.ts, tool-schema.ts, index.ts}
  apps/api/src/lib/assistant/{index.ts, types.ts}
  apps/api/src/lib/assistant/executors/{log-run,log-workout,check-habit,create-challenge,get-stats,get-leaderboard,navigate}.ts
  apps/api/src/lib/assistant/__tests__/executors.test.ts

CONSUME (never modify): shared entity zod schemas (Run/Workout/HabitCheck/Challenge) + unit/date
helpers; the event bus lib/events.ts and broadcast() lib/realtime.ts (you call handlers that already
emit/broadcast — you add no subscriber, no registry line, no route).

THE SEVEN TOOLS: log_run, log_workout, check_habit, create_challenge (write), get_stats,
get_leaderboard (read), navigate (client). Params speak canonical METERS & SECONDS — never store or
invent km/mi/pace. Mark each tool kind: write|read|client.

BUILD ORDER:
  1. NO migration (none needed — reuse existing tables' RLS via the user client).
  2. shared: ToolDef type + toJsonSchema() (provider-agnostic) + the 7 tool definitions w/ zod params.
  3. api: executeTool(name, rawArgs, ctx) — validate rawArgs with the shared zod schema at the
     boundary, dispatch to a thin executor per tool. Write tools return a DRAFT (no write) unless
     ctx.confirm === true; confirmed writes go through the real handler so scoring/realtime fire.
     Routes not yet merged throw ToolNotAvailableError -> { ok:false, error:'tool_unavailable' }
     (leave a one-line plug-in comment); create_challenge stays unavailable until the Challenges card.
  4. NO web.

RULES: greenfield only; use ONLY zod, @supabase/supabase-js, date-fns, typescript (no openai here —
the tool-calling loop is the chat card's job); theme tokens only (N/A, no UI); no secrets; pnpm
typecheck must pass. When the acceptance criteria pass, open a PR into `dev`.
```
