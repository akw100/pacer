# 11 — Telegram bot — text + photo logging, nudges

> **Stage:** Post-MVP  ·  **Suggested order:** 10  ·  **Size:** L  ·  **One owner builds this end to end.**

**Goal (one sentence).** Let a Pacer user link their Telegram account and log runs/workouts/habits by free text or by photographing their watch — with a ✓/✗ confirm before any write — plus opt-in daily/weekly nudges and a weekly recap, every write going through the assistant tool layer so RLS, scoring, and realtime apply.

**Why it matters / where it sits in the product.** Telegram is Pacer's effortless-capture surface: you text the bot mid-day and your open browser tab updates within a second. It is the **first consumer of the assistant tool layer** (card 10), proving that the same tools serving chat and voice also serve the bot — one write path, three frontends.

## Depends on

- **Assistant tool layer (card 10)** — ALL writes go through it via the single dispatcher `executeTool('log_run' | 'log_workout' | 'check_habit', args, ctx)` (imported from `apps/api/src/lib/assistant/index.ts`), executed with the linked user's client (`ctx`) so RLS + scoring + realtime fire exactly as if the web UI called. *Build against its TypeScript interface:* import `executeTool` and its arg/ctx input types. If card 10 isn't merged yet, stub a local `assistantTools.ts` shim exposing the same single `executeTool(name, args, ctx)` dispatcher that routes the shared zod-validated payloads to the existing `/runs`, `/workouts`, `/habits/:id/check` handlers with a service client scoped to the resolved `user_id` — swap to the real import on merge (signature matches, so it's a one-line change).
- **Shared schemas + helpers (card 01)** — `Run`/`Workout`/`HabitCheck` zod schemas, `m/s → km/mi/pace` and week-math helpers, `scoreFor()` + `POINTS`. *Build against these directly;* never re-derive km or pace locally. If not merged, import from `packages/shared/src/*` paths the foundation card declares — they exist before any feature card starts.
- **Event bus (card 02)** `apps/api/src/lib/events.ts` — you do not emit; the tool layer emits `run.logged`/`workout.logged`/`habit.checked` for you. The nudge cron READS via the score/group stats endpoints; no new events.
- **Realtime helper (card 02)** `apps/api/src/lib/realtime.ts` — `broadcast('user:<id>', …)` so a Telegram-logged run updates the user's open tabs. The tool layer already broadcasts; you do not call `broadcast` directly. Safe/no-op from day one.
- **Route registry (card 02)** `apps/api/src/routes/index.ts` — add ONE append-only registration line for the telegram route module.
- **Profile (card 04)** owns `profiles` incl. `nudge_pref ('off'|'daily'|'weekly')`. You READ it to decide who to nudge; the profile settings screen owns the *toggle UI*. You do not touch the profiles table or its settings page — you only read `nudge_pref` via the service client in the cron.

## You own these files (no other card touches them)

- `supabase/migrations/<ts>_telegram_links.sql` — `telegram_links` + `telegram_link_codes` (timestamp-prefixed, never collides)
- `packages/shared/src/telegram.ts` — link-code/status zod schemas + parse-result types (`RunPhotoParse`, etc.)
- `apps/api/src/routes/telegram.ts` — `/telegram/link-code`, `/telegram/status`, DELETE `/telegram/link`, `/webhook`, `/nudge`
- `apps/api/src/lib/telegram/bot.ts` — grammY bot instance + handlers (text, photo, callback_query)
- `apps/api/src/lib/telegram/parse.ts` — OpenAI text + vision parsing (structured outputs)
- `apps/api/src/lib/telegram/nudges.ts` — nudge + weekly-recap message builders
- `apps/api/src/lib/telegram/linkCode.ts` — 8-char code gen + resolve-user-from-telegram-id
- `apps/web/src/features/telegram/LinkTelegramCard.tsx` — settings card: generate code, show status, unlink
- `apps/web/src/features/telegram/telegram.api.ts` — typed client calls for the three telegram endpoints

You do NOT add a `subscribers/<slice>.ts` — Telegram is a *producer of writes via the tool layer*, not a cross-slice reactor.

## Foundation contracts you CONSUME (never modify)

- **Shared types/helpers:** `Run`, `Workout`, `HabitCheck` zod schemas; `formatPace`, `metersToDisplay`, `currentWeekBounds` (date-fns); `scoreFor`, `POINTS`. Import only.
- **Assistant tool layer (card 10):** the single dispatcher `executeTool('log_run' | 'log_workout' | 'check_habit', args, ctx)` from `apps/api/src/lib/assistant/index.ts` — the only write path. Telegram resolves a `user_id` from `telegram_user_id`, then calls `executeTool` with that user's scoped client as `ctx`.
- **Events:** emit NONE directly. The tool layer emits `run.logged` / `workout.logged` / `habit.checked` on your behalf, which scoring + plans + groups already subscribe to.
- **Realtime:** the tool layer broadcasts `user:<id>` + `group:<id>`; you rely on it, no direct calls.
- **Registry append-only lines you add:** ONE line in `apps/api/src/routes/index.ts` registering the telegram module. (No web section-slot line — the link UI lives inside the Settings page, which imports `LinkTelegramCard` via the profile/settings slot owned by card 04; you only export the component.)

## Build order (do these in this sequence)

1. **Migration** — `supabase/migrations/<ts>_telegram_links.sql`:
   - `telegram_links (user_id uuid PK references profiles(id) on delete cascade, telegram_user_id bigint unique not null, telegram_username text, linked_at timestamptz default now())`
   - `telegram_link_codes (code text PK, user_id uuid references profiles(id) on delete cascade, expires_at timestamptz not null)` — 8-char code, 10-min TTL set by the API.
   - **RLS:** own-rows only. On `telegram_links`: user can `select`/`delete` where `user_id = auth.uid()` (status + unlink). On `telegram_link_codes`: `insert`/`select` where `user_id = auth.uid()`. The webhook + nudge cron use the **service-role client** (trusted server work) to resolve `telegram_user_id → user_id` and to read `nudge_pref` — these bypass RLS by design and are never reachable from the browser.

2. **Shared** — `packages/shared/src/telegram.ts`:
   - `linkCodeResponseSchema` (`{ code: string, expiresAt: string }`), `telegramStatusSchema` (`{ linked: boolean, telegramUsername?: string, linkedAt?: string }`).
   - `runPhotoParseSchema` — `{ distanceMeters: number, durationSeconds: number, pace?: number, date?: string, confidence: number }` (canonical meters/seconds only; `pace` is derived-not-stored, kept only to echo back to the user). Reused as the OpenAI structured-output JSON schema AND to validate the model's reply.
   - `textParseSchema` — discriminated union over `{ kind: 'run' | 'workout' | 'habit' | 'unknown', … }` matching the shared `Run`/`Workout` payload shapes (meters/seconds).

3. **API** — routes + grammY + OpenAI:
   - `POST /telegram/link-code` (user JWT) → generate 8-char code (alphabet excludes ambiguous chars), 10-min TTL, upsert into `telegram_link_codes`, return via `linkCodeResponseSchema`. Validate at boundary with `@hono/zod-validator`.
   - `GET /telegram/status` (user JWT) → look up `telegram_links` for `auth.uid()`, return `telegramStatusSchema`.
   - `DELETE /telegram/link` (user JWT) → delete the user's `telegram_links` row.
   - `POST /webhook` — **secret-token protected**: reject unless the `x-telegram-bot-api-secret-token` header equals `TELEGRAM_WEBHOOK_SECRET`. Hand the update to the grammY bot in `lib/telegram/bot.ts`.
   - `POST /nudge` — cron entry (also secret-token / shared-secret gated). Iterate users by `nudge_pref` and send daily/weekly messages + the weekly recap.
   - **grammY bot (`lib/telegram/bot.ts`):**
     - `/start <code>` and bare-code messages → look up unexpired `telegram_link_codes`, create `telegram_links`, delete the code, reply "Linked ✓".
     - **Text logging:** resolve `user_id` from `telegram_user_id`; if unlinked, reply "Open Pacer → Settings → Link Telegram." Parse free text via `parse.ts` (`"ran 5k in 28 minutes"`, `"3x10 squats at 60kg"`, `"stretched today"`). Call the dispatcher with the matching tool name (`executeTool('log_run' | 'log_workout' | 'check_habit', args, ctx)`). Reply with derived display (`formatPace`, km/mi) + the `scoreFor()` points ("+15 pts").
     - **Photo logging:** linked-only. **Per-user cap 10 parses/day** (count today's parses from `score_events`/a lightweight in-memory+DB guard keyed on `telegram_user_id`); over cap → ask the user to type it. Download the photo via Telegram file API (grammY `getFile` + file URL), send to the vision model, validate against `runPhotoParseSchema`. **Low confidence (< 0.6) → save nothing, ask the user to type it.** Otherwise reply with parsed distance/time/pace + an **inline keyboard `✓ Save` / `✗ Discard`** (callback data carries the parsed payload or a short-lived cache key).
     - **callback_query handler:** `✓` → call `executeTool('log_run', args, ctx)` via the tool layer, edit the message to "Saved ✓ +N pts"; `✗` → edit to "Discarded."
   - **OpenAI (`parse.ts`):** `gpt-4o-mini` structured outputs for text (JSON schema from `textParseSchema`); `gpt-4o-mini` vision for photos (JSON schema from `runPhotoParseSchema`). One `OpenAI` client, `OPENAI_API_KEY`.
   - **Events / broadcast:** none direct — the tool layer emits + broadcasts. Add the ONE append-only route registration line in `routes/index.ts`.

4. **Web** — `apps/web/src/features/telegram/`:
   - `LinkTelegramCard.tsx` — a settings card (rendered inside the Settings page via card 04's slot; you export the component, card 04 imports it once). States:
     - **Not linked / empty state (teaches the feature):** short copy "Log runs by texting Pacer on Telegram — even a photo of your watch." + a **Generate link code** button.
     - **Code shown:** big code in the display font (theme token), a live 10-min countdown, deep-link `https://t.me/<bot>?start=<code>`, and "Open Telegram" button. Use `@tanstack/react-query` to fetch; **loading** = skeleton card, **error** = inline retry.
     - **Linked:** show `@username` + linked date (derived via shared date helper) and an **Unlink** button (custom, not a native control) with a confirm.
   - **Both form factors:** phone = full-width card in the Settings stack; desktop = card in the settings two-column grid. No native checkboxes/dropdowns. All color/radius/font via the single theme-token file — no hardcoded values.
   - Realtime: nothing to wire here; the rest of the app already invalidates on `user:<id>` events when a Telegram log lands.

## Packages (ONLY these — all from the stack)

- **grammY** — typed bot, inline keyboards
- **openai** — text parse, photo vision
- **zod** — boundary + parse validation
- **@hono/zod-validator** — route boundary validation
- **Hono** — webhook + telegram routes
- **@supabase/supabase-js** — service + user clients
- **date-fns** — week bounds, countdown (via shared)
- **@tanstack/react-query** — link card fetch/cache
- **lucide-react** — settings card icons

## Acceptance criteria — the PR gate (copy this checklist into your PR description)

- [ ] Migration applies cleanly; `telegram_links` + `telegram_link_codes` exist with own-rows RLS; service client can resolve `telegram_user_id → user_id`.
- [ ] `/telegram/link-code` returns an 8-char code with 10-min TTL; `/telegram/status` reflects linked state; `DELETE /telegram/link` unlinks.
- [ ] Bare-code / `/start <code>` in Telegram links the account; expired codes are rejected.
- [ ] Free text logs a run, a workout, and a habit check **through the assistant tool layer** (RLS + scoring + realtime fire); reply shows derived pace/km + `scoreFor()` points.
- [ ] Photo → vision parse → ✓/✗ inline keyboard; **only ✓ writes**; ✗ discards; low confidence asks the user to type it.
- [ ] Abuse guard: photo parsing is linked-only and capped at **10/user/day**; over cap asks the user to type it.
- [ ] `/webhook` and `/nudge` reject requests without the correct secret token.
- [ ] Opt-in daily/weekly nudges + weekly recap (km, score, group rank, streak) send only to users by `nudge_pref`.
- [ ] `LinkTelegramCard` renders on phone + desktop with empty/loading/error/linked states; custom controls only.
- [ ] All display values derived via shared helpers (no stored/invented km/pace/duration).
- [ ] `pnpm typecheck` passes; no hardcoded theme values; no secrets in code (env only); ONE append-only line added to `routes/index.ts`.

## How to verify locally

1. `pnpm dev`; set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `OPENAI_API_KEY` in `apps/api/.env`. Expose the API (tunnel) and `setWebhook` with the secret token, or post a sample update to `/webhook` with the header.
2. App → **Settings → Link Telegram** → Generate code; open `t.me/<bot>?start=<code>` and confirm "Linked ✓"; status card flips to linked.
3. Text the bot **"ran 5k in 28 minutes"** → reply shows pace + "+15 pts"; open Home in the browser → score/streak chips update live (no refresh).
4. Text **"3x10 squats at 60kg"** and **"stretched today"** → workout + habit appear via the tool layer.
5. Send a watch photo → bot replies with parsed values + ✓/✗; tap ✓ → "Saved ✓"; the run appears in the app. Send 11 photos in a day → the 11th asks you to type it.
6. Set `nudge_pref = 'weekly'`, POST `/nudge` with the secret → receive the recap (km, score, group rank, streak).

## Out of scope for this card

- The assistant chat/voice endpoints and the tool-layer *definitions* (card 10) — you only **consume** the tools.
- Scoring math, score_events writes, streak logic (shared + scoring slice) — points come from `scoreFor()` and the tool layer.
- Group leaderboard / feed / stats endpoints — the recap **reads** group rank via the existing stats endpoint; it does not compute it.
- The Settings page shell + the `nudge_pref` toggle UI (card 04 / profile) — you export `LinkTelegramCard` and read `nudge_pref`, nothing more.
- Editing runs/workouts from Telegram, voice, and any new tables for assistant threads.

## Copy-paste kickoff prompt for Claude

```
You are building the "Telegram bot — text + photo logging, nudges" slice of Pacer, a greenfield
fitness PWA (pnpm monorepo: packages/shared, apps/api, apps/web). Build everything fresh; the only
things to build against are the foundation contracts in this repo.

OWN ONLY THESE FILES (touch nothing else):
- supabase/migrations/<timestamp>_telegram_links.sql
- packages/shared/src/telegram.ts
- apps/api/src/routes/telegram.ts
- apps/api/src/lib/telegram/{bot,parse,nudges,linkCode}.ts
- apps/web/src/features/telegram/{LinkTelegramCard.tsx,telegram.api.ts}
Plus ONE append-only registration line in apps/api/src/routes/index.ts.

CONSUME (never modify):
- Assistant TOOL LAYER (card 10): a SINGLE dispatcher executeTool('log_run'|'log_workout'|'check_habit',
  args, ctx) from apps/api/src/lib/assistant/index.ts — the ONLY write path; call with the linked
  user's scoped client as ctx so RLS, scoring, and realtime apply. If card 10 isn't merged, stub a
  local shim exposing the same single executeTool(name, args, ctx) dispatcher over the existing
  /runs,/workouts,/habits handlers and swap later.
- shared schemas/helpers: Run/Workout/HabitCheck zod, formatPace, km/mi + week helpers, scoreFor,
  POINTS. Never re-derive km or pace.
- realtime + event bus: the tool layer emits run.logged/workout.logged/habit.checked and broadcasts
  user:<id>/group:<id> for you — do NOT emit or broadcast directly.
- profiles.nudge_pref: READ ONLY via service client in the cron.

BUILD ORDER:
1. Migration: telegram_links + telegram_link_codes (8-char code, 10-min TTL), own-rows RLS;
   service client resolves telegram_user_id -> user_id.
2. shared/telegram.ts: link-code/status schemas + runPhotoParseSchema {distanceMeters,
   durationSeconds, pace?, date?, confidence} (canonical meters/seconds) + textParseSchema.
3. API: /telegram/link-code, /telegram/status, DELETE /telegram/link (user JWT, zod-validated);
   grammY /webhook (secret-token header check); /nudge cron (secret-gated). Text parse via openai
   gpt-4o-mini structured output -> executeTool('log_run'|'log_workout'|'check_habit', args, ctx).
   Photo: linked-only, 10/user/day cap, download via
   Telegram file API -> gpt-4o-mini vision -> ✓/✗ inline keyboard, only ✓ writes, low confidence
   (<0.6) asks to type it. Reply with derived pace/km + scoreFor points.
4. Web: LinkTelegramCard (generate code + countdown deep-link, status, unlink) — phone + desktop,
   custom controls only, empty/loading/error/linked states, theme tokens only.

RULES: greenfield only; ONLY these packages — grammY, openai, zod, @hono/zod-validator, Hono,
@supabase/supabase-js, date-fns, @tanstack/react-query, lucide-react; store meters & seconds, derive
all display via shared helpers; theme tokens only (no hardcoded colors/radii/fonts); secrets via env
only. Open a PR into dev when every acceptance-criteria box passes.
```
