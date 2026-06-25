# 12 — Pacer Assistant — in-app chat panel

> **Stage:** Post-MVP  ·  **Suggested order:** 11  ·  **Size:** M  ·  **One owner builds this end to end.**

**Goal (one sentence).** Ship the in-app Pacer Assistant: an SSE-streaming `POST /assistant/chat` endpoint that runs the OpenAI tool-calling loop server-side over the shared assistant tool layer, plus a chat panel (full-height sheet on mobile / right-side panel on desktop) where writes render as Save/Edit/Cancel confirm cards and questions render as inline stat cards.

**Why it matters / where it sits in the product.** The Assistant is the Telegram bot's in-app sibling (SPEC §9 stage 1): type "log a 5k from this morning" or "who's leading the group?" and it acts through the same API the UI uses, so RLS, scoring, and realtime broadcasts apply unchanged. The panel stays beside the live app so the user watches their score/feed update behind the confirm card — the competitive payoff happens in view.

## Depends on

- **Card 10 — shared assistant tool layer** (`apps/api/src/lib/assistant/index.ts`): the JSON-schema tool definitions (`log_run`, `log_workout`, `check_habit`, `create_challenge`, `get_stats`, `get_leaderboard`, `navigate`) live in `packages/shared/src/assistant/tools.ts`, and an `executeTool(name, rawArgs, ctx)` executor that calls the existing route handlers with the caller's user client. **This card consumes that layer and does not define it.** If card 10 is not merged yet: build against a local `import type { ToolName, ToolDef, ToolResult } from '@shared/assistant/tools'` plus a thin stub `executeTool` that returns `{ ok: true, draft: rawArgs }` for write tools and `{ ok: true, data: {} }` for read tools; delete the stub and import the real module the moment card 10 lands. The chat loop only needs the tool *schemas* and one `executeTool` call — keep that seam narrow.
- **Foundation (cards 01/02/03)** — shared zod schemas/types (`Run`, `Workout`, `Challenge`), unit/date helpers, `scoreFor()` + `POINTS`, the event-bus and `broadcast()` helpers, the route registry, the web API client + TanStack Query, and the theme-token file. All already merged before Post-MVP; consume, never redefine.
- **No dependency on the Telegram card (card with `/webhook`).** Both consume card 10 independently; this card never imports Telegram code.

This card creates **no migrations and no new tables** — thread history is client-side (SPEC §9, DATA-MODEL §"Pacer Assistant"). The only persistence is the rows the underlying tools write when a draft is confirmed (runs/workouts/habit_checks/challenges via the existing handlers).

## You own these files (no other card touches them)

```
apps/api/src/routes/assistant.ts              # POST /assistant/chat (SSE) — this card's route module
apps/api/src/assistant/chat-loop.ts           # server-side OpenAI tool-calling loop
apps/api/src/assistant/chat.types.ts          # SSE event shapes, request body, draft/confirm types
apps/web/src/features/assistant/AssistantPanel.tsx       # sheet (mobile) / right panel (desktop)
apps/web/src/features/assistant/AssistantTrigger.tsx     # header sparkle button + Log-sheet chat icon
apps/web/src/features/assistant/ChatThread.tsx           # message list + streaming bubble
apps/web/src/features/assistant/Composer.tsx             # text input + send
apps/web/src/features/assistant/ConfirmCard.tsx          # write-draft Save/Edit/Cancel card
apps/web/src/features/assistant/StatCard.tsx             # inline answer card for read tools
apps/web/src/features/assistant/EmptyState.tsx           # three tappable example prompts
apps/web/src/features/assistant/useAssistantChat.ts      # SSE client + client-side thread state
apps/web/src/features/assistant/assistant.types.ts       # client message/draft view types
```

This card does **not** own `apps/api/src/lib/assistant/index.ts` (card 10), its tool schemas in `packages/shared/src/assistant/tools.ts`, or `/assistant/voice-token` (stage 2, out of scope).

## Foundation contracts you CONSUME (never modify)

- **Shared types/helpers**: `Run`, `Workout`, `Challenge` zod schemas + domain types; unit/date helpers (m/s → km/mi/pace, week math) to format stat-card and confirm-card display values; `scoreFor()` + `POINTS` to show the "+15 pts" preview on a run confirm card. Canonical storage stays meters/seconds — confirm cards display derived values only.
- **Card-10 tool layer**: import `executeTool` from `apps/api/src/lib/assistant/index.ts` and the tool schema list from `packages/shared/src/assistant/tools.ts`; pass the schemas to OpenAI as `tools`, dispatch the model's chosen tool through `executeTool`.
- **Events you EMIT**: none directly — confirmed writes go through the existing tool/route handlers, which already emit `run.logged` / `workout.logged` / `habit.checked` / `challenge.updated` and call `broadcast()`. Do not re-emit or double-broadcast.
- **Events you SUBSCRIBE to**: none. No `apps/api/src/subscribers/assistant.ts`, no line in `subscribers/index.ts`.
- **Append-only registry line**: add exactly one line to `apps/api/src/routes/index.ts` registering the assistant route module. Nothing else in that file.
- **Web aggregate pages**: the panel is an overlay rendered from the app shell, not a Home/Progress section — no section-slot edits. Mount `<AssistantPanel/>` once in the shell and trigger it via shared open-state (e.g. the existing UI store / a context the shell already exposes); add `<AssistantTrigger/>` to the header and reference it from the Log sheet's chat icon. If the shell exposes no open-state hook, keep panel open-state inside this feature (a small context provider wrapping the trigger + panel) so no other file changes.
- **API client + TanStack Query**: after a confirmed write succeeds, invalidate the affected query keys (`score`, `runs`/`workouts`/`habits`, `group`, `challenges`) so the live app behind the panel refetches. Realtime broadcasts from the underlying handler also invalidate — invalidating here covers the same-tab case immediately.
- **Theme tokens**: every color/radius/font from the single theme-token file. No hardcoded values.

## Build order (do these in this sequence)

1. **Migration** — **none.** This card adds no tables. Thread history is client-side (last N messages re-sent each request). Confirm flow writes through existing tool handlers, which own their own rows and RLS. Do not add a `chat_messages` table — that is explicitly out of scope for v1.

2. **Shared** — **no new shared module.** Reuse `Run`/`Workout`/`Challenge` schemas + unit/date helpers + `scoreFor()`/`POINTS`. Define request/SSE/draft contracts locally in `apps/api/src/assistant/chat.types.ts` (and mirror the view types in `apps/web/src/features/assistant/assistant.types.ts`):
   - Request body (zod-validated at the API boundary): `{ messages: {role:'user'|'assistant'|'tool', content:string, toolCallId?:string}[], confirm?: { toolCallId:string, args:unknown } }`. Cap `messages` length server-side (e.g. last 20) — defends token budget regardless of client.
   - SSE event union: `token` (streamed assistant text delta), `tool_draft` (`{toolCallId, tool, args}` for a WRITE tool — client renders a ConfirmCard, **server does not execute**), `tool_result` (`{toolCallId, tool, data}` for a READ tool already executed — client renders a StatCard), `done`, `error`.

3. **API** — `apps/api/src/routes/assistant.ts` + `apps/api/src/assistant/chat-loop.ts`:
   - `POST /assistant/chat`, auth required (caller's user client = caller's RLS). Validate body with zod; reject oversized payloads.
   - Set SSE headers (`text/event-stream`, no buffering). Run the OpenAI tool-calling loop server-side (`stream:true`) with card 10's tool schemas:
     - Stream text deltas as `token` events.
     - When the model calls a **READ** tool (`get_stats`, `get_leaderboard`, `navigate`): execute via `executeTool(...)`, feed the result back into the loop, and emit a `tool_result` SSE event so the client can render a StatCard. These are safe to run without confirmation.
     - When the model calls a **WRITE** tool (`log_run`, `log_workout`, `check_habit`, `create_challenge`): **do not execute.** Emit a `tool_draft` event with the proposed args and end the turn. The actual write happens only when the client re-POSTs with `confirm:{toolCallId, args}` (possibly edited) — that branch runs `executeTool(...)` for the named write tool, then invalidation/broadcast happen inside the existing handler. Emit a final `tool_result`/`done` confirming the write.
   - Same trust model as the Telegram ✓/✗ flow: nothing is written without an explicit confirm.
   - Broadcast: none added here — the underlying handlers already `broadcast()` on `group:<id>`/`user:<id>`.
   - OpenAI key read from server env only; never sent to the client.
   - Register the route with one append-only line in `routes/index.ts`.

4. **Web** — `apps/web/src/features/assistant/*`:
   - **`AssistantTrigger`**: a sparkle button for the app header (present on every screen) and the chat icon used by the Log sheet ("tell me what to log"). Both open the panel. Use the shared icon set / theme tokens.
   - **`AssistantPanel`**: **mobile = full-height sheet**; **desktop = right-side panel** docked so Home/Group/etc. stay visible and update live behind it. Built from the shared sheet/panel primitives + theme tokens — no native dialog chrome.
   - **`useAssistantChat`**: holds the client-side thread (the only history store), POSTs to `/assistant/chat`, parses the SSE stream, appends `token` deltas to the streaming assistant bubble, turns `tool_draft` into a pending ConfirmCard and `tool_result` into a StatCard. On Save, re-POST with `confirm{...}`; on success, invalidate the affected TanStack Query keys.
   - **`ChatThread` + `Composer`**: scrollable message list with a live streaming bubble; text composer with send. Custom controls only (no native inputs/selects per UX §5).
   - **`ConfirmCard`**: renders the WRITE draft as the filled run/workout/habit/challenge using shared display helpers (e.g. run shows km/mi + pace + "+N pts" via `scoreFor`), with **Save / Edit / Cancel**. Edit lets the user adjust fields before confirming; Cancel discards the draft (no write).
   - **`StatCard`**: compact inline answer for READ tools (e.g. leaderboard top-3, "you ran 42 km this month") using shared formatters.
   - **`EmptyState`**: three tappable example prompts that pre-fill/send the composer — "Log a 5k from this morning", "Who's leading the group?", "Challenge the family to a 7-day stretch streak".
   - **Loading/error states**: typing indicator while the stream is open; inline error bubble with retry on an `error` event or dropped stream; disabled Save while a confirm is in flight.

## Packages (ONLY these — all from the stack)

- **openai** — tool-calling loop + streaming.
- **zod** — request-boundary validation.
- **hono** (API framework) — SSE route handler.
- **@tanstack/react-query** — query invalidation after writes.
- **react** — panel + chat components.
- **date-fns** (via shared helpers) — week/date display in stat cards.

If anything else seems required (e.g. a dedicated SSE client lib), do NOT add it — the browser `fetch` + `ReadableStream` reader covers SSE. ⚠️ NEEDS TEAM DECISION: <pkg> only if you genuinely cannot proceed with the above.

## Acceptance criteria — the PR gate (copy this checklist into your PR description)

- [ ] `POST /assistant/chat` streams SSE; text arrives incrementally, not in one blob.
- [ ] READ tools (`get_stats`/`get_leaderboard`/`navigate`) execute server-side and return a `tool_result` rendered as a StatCard.
- [ ] WRITE tools return a `tool_draft` and **write nothing** until an explicit `confirm` re-POST — verified by checking the DB after Cancel (no row) vs after Save (one row).
- [ ] "Log a 5k from this morning" produces a run ConfirmCard with correct km/mi + pace + "+N pts"; Save writes a `runs` row and the Home score chip updates live behind the panel.
- [ ] "Who's leading the group?" returns a leaderboard StatCard with the group's top members.
- [ ] Panel renders as a full-height sheet on phone and a right-side docked panel on desktop; the app behind it stays visible and refetches after a confirmed write.
- [ ] Empty state shows three tappable example prompts; tapping one sends it.
- [ ] Server caps thread length and validates the body with zod; OpenAI key never reaches the client.
- [ ] No new tables / migrations; no `subscribers/assistant.ts`.
- [ ] `pnpm typecheck` passes; no hardcoded colors/radii/fonts (theme tokens only); no secrets committed.

## How to verify locally

1. Set `OPENAI_API_KEY` in the API env; run the API + web dev servers; sign in and join/create a group with one logged run from another member.
2. Click the header sparkle button → panel opens (resize the window to confirm sheet-on-mobile vs right-panel-on-desktop).
3. Empty state shows three prompts; tap **"Who's leading the group?"** → a leaderboard StatCard appears with the group's scores.
4. Type **"log a 5k from this morning, took 28 minutes"** → a run ConfirmCard appears (5.00 km, ~5:36/km, "+15 pts"). Click **Cancel** → confirm no `runs` row was written.
5. Repeat and click **Save** → a `runs` row is written, a success line appears, and the Home score/streak chip updates behind the panel without a manual refresh.
6. Open the Log sheet (＋) → tap the chat icon → the same panel opens.

## Out of scope for this card

- **Stage-2 voice** — `/assistant/voice-token`, OpenAI Realtime/WebRTC, the mic toggle, and live `set_form_field` form-filling. (Separate card.)
- **The shared tool layer itself** (`apps/api/src/lib/assistant/index.ts` + its schemas in `packages/shared/src/assistant/tools.ts`) and the route handlers it wraps — owned by card 10 and the respective slice cards; only consume them.
- **The Telegram bot** (`/webhook`, photo parsing) — sibling consumer of card 10, not touched here.
- **Persisting chat history / a `chat_messages` table** — client-side only for v1.
- **New stats/leaderboard logic** — read tools call existing `/groups/:id/stats`, `/stats/platform`, `/score/summary` handlers.

## Copy-paste kickoff prompt for Claude

```
Build the "Pacer Assistant — in-app chat panel" slice (card 12) for Pacer, a greenfield
fitness PWA. Build everything fresh; the only things to build against are the foundation
contracts in this repo.

OWN ONLY THESE FILES (disjoint from every other card):
  apps/api/src/routes/assistant.ts            (POST /assistant/chat, SSE)
  apps/api/src/assistant/chat-loop.ts         (server-side OpenAI tool-calling loop)
  apps/api/src/assistant/chat.types.ts        (request body + SSE event union + draft types)
  apps/web/src/features/assistant/*.tsx + *.ts (panel, trigger, thread, composer,
                                                confirm card, stat card, empty state,
                                                useAssistantChat, assistant.types.ts)
Add exactly ONE append-only line to apps/api/src/routes/index.ts to register the route.
Do NOT create migrations, tables, or apps/api/src/lib/assistant/index.ts.

CONSUME (never modify): the card-10 tool layer apps/api/src/lib/assistant/index.ts
  (executeTool + tool JSON schemas from packages/shared/src/assistant/tools.ts); shared
  Run/Workout/Challenge zod schemas, unit/date helpers, scoreFor()+POINTS; broadcast()/event
  bus (handlers emit, you don't); the web API client + TanStack Query; the single
  theme-token file.
If card 10 isn't merged, stub executeTool behind a narrow import seam and swap to the real
module when it lands.

BUILD ORDER:
  1. No migration (thread history is client-side; writes go through existing handlers).
  2. Define request/SSE/draft contracts in chat.types.ts; reuse shared schemas/helpers.
  3. API: zod-validate body, cap thread length, set SSE headers, run the OpenAI
     tool-calling loop. READ tools execute server-side -> tool_result. WRITE tools
     return a tool_draft and write NOTHING; only a client confirm re-POST runs the write
     (same trust model as the Telegram confirm flow). OpenAI key server-side only.
  4. Web: header sparkle button + Log-sheet chat icon open the panel
     (full-height sheet on mobile, right-side panel on desktop, app visible behind it).
     Stream tokens into a bubble; render WRITE drafts as Save/Edit/Cancel ConfirmCards
     (km/mi + pace + "+N pts" via shared helpers), READ results as inline StatCards.
     Empty state = three tappable example prompts. After a confirmed write, invalidate
     the affected query keys so the live app refetches.

RULES: greenfield only; ONLY these packages — openai, zod, hono, @tanstack/react-query,
react, date-fns; store meters/seconds, derive display via shared helpers; theme tokens
only (no hardcoded colors/radii/fonts); custom controls (no native inputs); no secrets.

GATE: from the panel, "log a 5k from this morning" produces a run confirm card that Saves
a runs row (Cancel writes nothing), and "who's leading the group?" returns a leaderboard
stat card. Both phone and desktop layouts. Open a PR into `dev` when the acceptance
criteria pass.
```
