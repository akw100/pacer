# Telegram bot (P4) — design

**Task:** P4 / card `11-telegram-bot` (card file was removed in `be8d96d`; source of
truth is `docs/01-SPECS.md §3`, `docs/04-DATA-MODEL.md`, the Google Sheet row).
**Branch:** `feat/11-telegram-bot` → PR into `dev`.
**Date:** 2026-06-25.

## Goal

A linked user logs a run by texting the bot ("ran 5k in 28 minutes") or sending a photo
of a watch/treadmill screen. The bot parses it with OpenAI, shows what it understood, and
saves only after the user taps ✓.

## State of dependencies (verified on `origin/dev` @ PR #17)

- **M1 (run persistence) is MERGED.** `POST /runs` exists (`apps/api/src/routes/runs.ts`):
  it inserts into the `runs` table, then `emit('run.logged', …)` and broadcasts to the
  user's + groups' realtime channels. The shared `RunCreateSchema` already carries
  `source: 'web' | 'telegram'`. The `runs` table exists in the live Supabase project.
- **P3 (assistant tool layer) is NOT built.** `packages/shared/src/assistant-tools.ts` is a
  stub (`ASSISTANT_TOOLS = []`); `apps/api/src/lib/assistant/` does not exist. Convention
  (`08-CONVENTIONS.md:50`) wants Telegram/chat/voice to save via `executeTool('log_run', …)`.

**Consequence:** the bot can save runs **for real today**. The save path mirrors what
`runs.ts` does, using the **service-role** client (data model line 11 explicitly sanctions
"Telegram ingestion" as service-role work — the bot has no per-user JWT). It is isolated in
one seam function, `logRunForUser`, so that when P3's `executeTool` lands the body collapses
to a single `executeTool('log_run', draft, ctx)` call with no handler changes.

## Architecture

grammY bot as a module **inside `apps/api`** (matches the reserved `POST /webhook` at
`apps/api/src/app.ts:8`; shares the service-role Supabase client, env, `emit`, `broadcast`).
One Railway service.

- **Production:** webhook — `POST /webhook` validates the
  `X-Telegram-Bot-Api-Secret-Token` header, hands the update to grammY's `webhookCallback`.
- **Local dev:** long-polling (`bot.start()`), so no public tunnel is needed.
- Both guarded by env. If `TELEGRAM_BOT_TOKEN` is absent the bot is disabled and the API
  still boots (logs a warning) — the rest of the API is unaffected.

### Message flow

```
update → telegram_user_id → telegram_links lookup
  ├─ unlinked → "link first — open Settings, get an 8-char code, send /start <code>"
  └─ linked:
       text  → parseText(message)  ┐
       photo → parsePhoto(fileUrl) ┘→ RunDraft {distance_meters, duration_seconds, run_date?, pace?, confidence}
         ├─ confidence < 0.6 → "couldn't read that — type it instead"
         └─ ok → store draft (keyed by chat_id+message_id) + reply parsed values + [✓ Save] [✗ Discard]
                   callback ✓ → logRunForUser(userId, draft)   → insert + emit + broadcast
                   callback ✗ → drop draft, reply "discarded"
```

## In scope (fully built)

1. **Account linking**
   - `POST /telegram/link-code` (authed, user JWT) → generate 8-char code (no ambiguous
     chars), insert into `telegram_link_codes` with 10-min TTL, return it.
   - Bot `/start <code>` → validate (exists, unexpired), upsert `telegram_links`
     (`user_id`, `telegram_user_id`, `telegram_username`), delete the code. Reply confirms.
   - `GET /telegram/status` (authed) → `{ linked: boolean, telegram_username?: string }`.
   - `DELETE /telegram/link` (authed) → remove the row.
2. **Text logging** — `parseText`: OpenAI `gpt-4o-mini` structured output → `RunDraft`.
3. **Photo logging** — `parsePhoto`: grammY `getFile` + download → `gpt-4o-mini` vision →
   `RunDraft`. **Linked accounts only.** **Per-user 10/day cap.** Over cap or confidence
   `< 0.6` → ask the user to type instead.
4. **Confirm UX** — inline keyboard ✓/✗ via `callback_query`; only ✓ commits; drafts held
   in an in-memory store keyed by `(chat_id, message_id)`.
5. **Save** — `logRunForUser(userId, draft)`: map `RunDraft` → `RunCreate`
   (`source: 'telegram'`), service-role insert into `runs`, then `emit('run.logged', …)` and
   broadcast to `user:<id>` + the user's group channels (mirrors `runs.ts` `fanOut`). The
   single seam to swap for `executeTool('log_run', …)` once P3 ships.

## Out of scope (depend on unbuilt M3 / cron)

- Text habit check-ins, nudges / weekly recap (`POST /nudge` cron). Noted as follow-ups.

## Files (all bot-owned, new unless noted)

```
apps/api/src/telegram/bot.ts          grammY Bot build + handler wiring + start/stop
apps/api/src/telegram/parse.ts        parseText + parsePhoto (OpenAI)
apps/api/src/telegram/draft.ts        RunDraft zod schema + in-memory draft store
apps/api/src/telegram/save.ts         logRunForUser (insert + emit + broadcast; seam for executeTool)
apps/api/src/telegram/dailyCap.ts     per-user photo cap
apps/api/src/telegram/linkCode.ts     8-char code generation
apps/api/src/telegram/handlers/start.ts     /start <code> link handler
apps/api/src/telegram/handlers/message.ts   text + photo message handler
apps/api/src/telegram/handlers/confirm.ts   ✓/✗ callback_query handler
apps/api/src/routes/telegram.ts       /telegram/link-code, /status, /link (authed)
apps/api/src/routes/webhook.ts        POST /webhook (secret-token + webhookCallback)
apps/api/src/lib/openai.ts            OpenAI client (env-guarded)
apps/api/src/routes/index.ts          (edit) mount telegram + webhook routes (append one line each)
apps/api/src/app.ts                   no edit — /webhook + /telegram already covered? see note
apps/api/src/index.ts                 (edit) start dev polling when enabled
apps/api/package.json                 (edit) += grammy, openai deps; add test script
apps/api/.env.example                 (edit) += TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, OPENAI_API_KEY
supabase/migrations/<ts>_telegram.sql telegram_links + telegram_link_codes + RLS
```

> **Auth note:** `app.ts` already lists `/webhook` as a public prefix. `/telegram/*` link
> routes are authed (they need the user JWT), so they stay behind the global guard — no
> `app.ts` edit needed.

## Data model (from `04-DATA-MODEL.md`, this card's migration)

```
telegram_links       user_id, telegram_user_id, telegram_username, linked_at
telegram_link_codes  code (8 chars), user_id, expires_at (10-min TTL)
```

RLS: both tables are accessed only by the service-role client (bot ingestion) and the authed
link routes; no direct browser access (deny-all policy for `anon`/`authenticated`). The
`link-code`/`status`/`link` routes scope to `userId` from the verified token, never a
body-supplied id.

## RunDraft → RunCreate mapping

`RunDraft` (bot-local) = `{ distance_meters, duration_seconds, run_date?, pace?, confidence }`.
`pace` and `confidence` are bot-only (not stored). Map to `RunCreate`:
`{ run_date: draft.run_date ?? <today>, distance_meters, duration_seconds, source: 'telegram' }`.
`today` is computed in the API's timezone via `new Date().toISOString().slice(0,10)`.

## Packages (all already in `06-TECH-STACK.md`)

`grammy` (bot), `openai` (LLM text + vision), `@supabase/supabase-js` (service-role, present),
`zod` (RunDraft, present), `@hono/zod-validator` (route bodies, present). New installs in
`apps/api`: `grammy`, `openai`. No packages outside the stack.

## Testing

`apps/api` gains a test script mirroring `packages/shared`:
`node --import tsx --test src/**/*.test.ts`. Pure units, no network:
- `RunDraft` schema accept/reject (units are meters & seconds; rejects non-positive / display values).
- `RunDraft` → `RunCreate` mapping (defaults run_date to today, sets source telegram).
- `linkCode` generation (length 8, charset excludes ambiguous chars).
- `dailyCap` increment / reset-after-day / over-cap.
OpenAI and grammY are mocked; tests never hit the network or Telegram.

## Error handling

- Missing bot/OpenAI env → bot disabled, API boots, warning logged.
- OpenAI error/timeout → "couldn't read that, try typing it".
- Confidence `< 0.6` / over daily cap (`10/day`) → ask user to type the run.
- Unlinked user → link instructions.
- Webhook with bad/absent secret token → 401, no processing.
- `logRunForUser` insert error → reply "couldn't save, try again"; realtime failures are
  already swallowed by `broadcast`.

## Done = mergeable

`pnpm typecheck` passes; `apps/api` unit tests pass; with a token the bot boots in polling
mode; linking + text/photo parse + ✓/✗ + **save** work end to end against the live `runs`
table. The only deferred item is folding `logRunForUser` into P3's `executeTool`.
