# Telegram bot (P4) — design

**Task:** P4 / card `11-telegram-bot` (card file was removed in `be8d96d`; source of
truth is `docs/01-SPECS.md §3`, `docs/04-DATA-MODEL.md`, the Google Sheet row).
**Branch:** `feat/11-telegram-bot` → PR into `dev`.
**Date:** 2026-06-25.

## Goal

A linked user logs a run by texting the bot ("ran 5k in 28 minutes") or sending a photo
of a watch/treadmill screen. The bot parses it with OpenAI, shows what it understood, and
saves only after the user taps ✓.

## Constraint that shapes the design

The bot's intended save path is the **assistant tool layer** (`executeTool(name, args, ctx)`
in `apps/api/src/lib/assistant/index.ts`), per `docs/08-CONVENTIONS.md:50`. That layer is
card 10 (P3) and is **not built** — `packages/shared/src/assistant-tools.ts` is an empty
stub and `ASSISTANT_TOOLS = []`. Run persistence (M1) is also unbuilt; the API has no
`/runs` route. Therefore this card builds **everything the bot owns up to the save
boundary**, and stops at a single seam function that P3/M1 will fill. No run is faked.

## Architecture

grammY bot as a module **inside `apps/api`** (matches the already-reserved
`POST /webhook` at `apps/api/src/app.ts:8`; shares the service-role Supabase client, env,
and the future `executeTool`). One Railway service.

- **Production:** webhook — `POST /webhook` validates Telegram's
  `X-Telegram-Bot-Api-Secret-Token` header, hands the update to grammY's `webhookCallback`.
- **Local dev:** long-polling (`bot.start()`), so no public tunnel is needed.
- Both are guarded by env. If `TELEGRAM_BOT_TOKEN` is absent, the bot is disabled and the
  API still boots (logs a warning) — the rest of the API is unaffected.

### Message flow

```
update → resolve telegram_user_id → telegram_links lookup
  ├─ unlinked → reply: "link first — open Settings, get an 8-char code, send /start <code>"
  └─ linked:
       text  → parseText(message)  ┐
       photo → parsePhoto(fileUrl) ┘→ RunDraft {distance_meters, duration_seconds, pace?, date?, confidence}
         ├─ confidence < 0.6 → reply: "couldn't read that — type it instead"
         └─ ok → store draft (keyed) + reply parsed values + inline [✓ Save] [✗ Discard]
                   callback ✓ → logRunForUser(userId, draft)   ← THE SEAM (stubbed)
                   callback ✗ → drop draft, reply "discarded"
```

## In scope (fully built)

1. **Account linking**
   - `POST /telegram/link-code` (authed, user JWT) → generate 8-char code (no ambiguous
     chars), insert into `telegram_link_codes` with 10-min TTL, return it.
   - Bot `/start <code>` → validate code (exists, unexpired), upsert `telegram_links`
     (`user_id`, `telegram_user_id`, `telegram_username`), delete the code. Reply confirms.
   - `GET /telegram/status` (authed) → `{ linked: boolean, telegram_username? }`.
   - `DELETE /telegram/link` (authed) → remove the row.
2. **Text logging** — `parseText`: OpenAI `gpt-4o-mini` structured output → `RunDraft`.
3. **Photo logging** — `parsePhoto`: grammY `getFile` + download → `gpt-4o-mini` vision →
   `RunDraft`. **Linked accounts only.** **Per-user 10/day cap** (`dailyCap`). Over cap or
   low confidence → ask the user to type instead.
4. **Confirm UX** — inline keyboard ✓/✗ via `callback_query`; only ✓ commits; drafts held
   in an in-memory store keyed by `(chat_id, message_id)`.

## The boundary (stubbed, not faked)

`apps/api/src/telegram/save.ts` exports `logRunForUser(userId, draft)`. Until P3/M1 land it
returns `{ ok: false, reason: 'backend-pending' }` and the bot replies "Got it — saving
isn't wired up yet (waiting on the runs backend)." When `executeTool` ships, this function
becomes a one-line delegate to `executeTool('log_run', draft, ctx)`; no handler changes.

## Out of scope (depend on unbuilt M3 / cron)

- Text habit check-ins, nudges / weekly recap (`POST /nudge` cron), realtime broadcast to
  `user:<id>` (that fires inside the stubbed save). Noted as follow-ups.

## Files (all bot-owned, new unless noted)

```
apps/api/src/telegram/bot.ts          grammY Bot build + handler wiring + start/stop
apps/api/src/telegram/parse.ts        parseText + parsePhoto (OpenAI)
apps/api/src/telegram/draft.ts        RunDraft zod schema + in-memory draft store
apps/api/src/telegram/save.ts         logRunForUser seam (stub → executeTool later)
apps/api/src/telegram/dailyCap.ts     per-user photo cap
apps/api/src/telegram/handlers/text.ts
apps/api/src/telegram/handlers/photo.ts
apps/api/src/telegram/handlers/confirm.ts
apps/api/src/telegram/handlers/link.ts
apps/api/src/routes/telegram.ts       /telegram/link-code, /status, /link (authed)
apps/api/src/routes/webhook.ts        POST /webhook (secret-token + webhookCallback)
apps/api/src/lib/openai.ts            OpenAI client (env-guarded)
apps/api/src/routes/index.ts          (edit) mount telegram + webhook routes
apps/api/src/index.ts                 (edit) start dev polling when enabled
apps/api/.env.example                 (edit) += TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, OPENAI_API_KEY
supabase/migrations/<ts>_telegram.sql telegram_links + telegram_link_codes + RLS
```

## Data model (from `04-DATA-MODEL.md`, this card's migration)

```
telegram_links       user_id, telegram_user_id, telegram_username, linked_at
telegram_link_codes  code (8 chars), user_id, expires_at (10-min TTL)
```

RLS: both tables are written only by the service-role client (bot ingestion + authed link
routes); no direct browser access. `link-code`/`status`/`link` routes run under the user
JWT and scope to `userId` from the token, never a body-supplied id.

## Packages (all already in `06-TECH-STACK.md`)

`grammY` (bot), `openai` (LLM text + vision), `@supabase/supabase-js` (service-role),
`zod` (RunDraft), `@hono/zod-validator` (route bodies). No new dependencies.

## Testing

Pure units via `tsx` + node test runner, no network:
- `RunDraft` schema accept/reject (units are meters & seconds; rejects display values).
- link-code generation (charset, length) + TTL expiry logic.
- `dailyCap` increment / reset / over-cap.
- prompt builders return the expected JSON-schema shape.
OpenAI and grammY are mocked; tests never hit the network or Telegram.

## Error handling

- Missing bot/OpenAI env → bot disabled, API boots, warning logged.
- OpenAI error/timeout → "couldn't read that, try typing it".
- Low confidence (`< 0.6`) / over daily cap (`10/day`) → ask user to type the run.
- Unlinked user → link instructions.
- Webhook with bad/absent secret token → 401, no processing.

## Done = mergeable

`pnpm typecheck` passes; unit tests pass; bot builds and (with a token) boots in polling
mode; linking + parse + ✓/✗ work end to end except the final save, which replies
"backend pending" by design until P3/M1.
