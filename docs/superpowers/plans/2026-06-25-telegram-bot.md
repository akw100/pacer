# Telegram bot (P4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A grammY Telegram bot inside `apps/api` that logs a run from free text or a watch/treadmill photo, parsed by OpenAI, saved only after the user confirms ✓.

**Architecture:** Bot module under `apps/api/src/telegram/`. Pure logic (draft schema, mapping, link-code, daily cap, model-JSON validation) is unit-tested; OpenAI/grammY are never hit in tests. Saving mirrors `runs.ts` (service-role insert + `emit('run.logged')` + realtime `broadcast`), isolated in `logRunForUser` as the future `executeTool('log_run')` seam. Prod uses a secret-token webhook; dev uses long-polling. Missing env disables the bot without breaking the API.

**Tech Stack:** TypeScript (strict), Hono, grammY, openai, @supabase/supabase-js (service-role), zod. Tests via `node --import tsx --test`.

---

## File structure

```
apps/api/src/telegram/env.ts              telegram/openai env getters + botEnabled()/botMode()
apps/api/src/telegram/draft.ts            RunDraftSchema, RunDraft, draftToRunCreate, in-memory draft store
apps/api/src/telegram/linkCode.ts         generateLinkCode()
apps/api/src/telegram/dailyCap.ts         tryConsumePhoto(), DAILY_PHOTO_CAP, _resetCaps()
apps/api/src/lib/openai.ts                openai() client + openaiEnabled()
apps/api/src/telegram/parse.ts            parseRunDraftJson(), parseText(), parsePhoto()
apps/api/src/telegram/save.ts             logRunForUser()
apps/api/src/telegram/handlers/start.ts   /start <code> link
apps/api/src/telegram/handlers/message.ts text + photo → draft → confirm keyboard
apps/api/src/telegram/handlers/confirm.ts ✓/✗ callback_query
apps/api/src/telegram/bot.ts              Bot build, handler wiring, startPolling/stop
apps/api/src/routes/telegram.ts           /telegram/link-code, /status, /link (authed)
apps/api/src/routes/webhook.ts            POST /webhook (secret-token + webhookCallback)
apps/api/src/routes/index.ts              (edit) mount telegram + webhook (append two lines)
apps/api/src/index.ts                     (edit) start dev polling when enabled
apps/api/package.json                     (edit) += grammy, openai; add test script
apps/api/.env.example                     (edit) += bot/openai vars
supabase/migrations/<ts>_telegram.sql     telegram_links + telegram_link_codes + RLS
```

Tests live next to source: `*.test.ts` under `apps/api/src/telegram/`.

---

## Task 1: Dependencies, env example, test script

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/.env.example`

- [ ] **Step 1: Add deps + test script to `apps/api/package.json`**

Add to `dependencies` (keep alphabetical-ish, match existing version style):
```json
"grammy": "^1.30.0",
"openai": "^4.73.0"
```
Add to `scripts`:
```json
"test": "node --import tsx --test src/**/*.test.ts"
```

- [ ] **Step 2: Install**

Run: `cd ~/pacer && pnpm install`
Expected: lockfile updates, `grammy` + `openai` resolved under `apps/api`. (If pnpm needs Node 22 and the shell is on 20, run the local binaries as elsewhere in this repo; installation itself must use pnpm.)

- [ ] **Step 3: Append vars to `apps/api/.env.example`** (names only, no values)

```
# Telegram bot (grammY). Bot is disabled if TELEGRAM_BOT_TOKEN is unset.
TELEGRAM_BOT_TOKEN=
# Shared secret echoed by Telegram in the X-Telegram-Bot-Api-Secret-Token header (webhook mode).
TELEGRAM_WEBHOOK_SECRET=
# 'polling' (default, local dev) or 'webhook' (production).
TELEGRAM_MODE=

# OpenAI — text + vision parsing for the bot (and later the assistant).
OPENAI_API_KEY=
```

- [ ] **Step 4: Verify typecheck still passes (no source yet)**

Run: `cd ~/pacer && pnpm -C apps/api typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/.env.example pnpm-lock.yaml
git commit -m "chore(telegram): add grammy + openai deps, env names, test script"
```

---

## Task 2: Database migration (telegram tables + RLS)

**Files:**
- Create: `supabase/migrations/<ts>_telegram.sql` (use a real timestamp, e.g. `20260625120000_telegram.sql`)

- [ ] **Step 1: Write the migration**

```sql
-- Telegram account linking + short-lived link codes. Accessed only by the
-- service-role client (bot ingestion) and the authed /telegram/* routes.
-- Deny-all to anon/authenticated; service-role bypasses RLS.

create table if not exists public.telegram_links (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  telegram_user_id  bigint not null unique,
  telegram_username text,
  linked_at         timestamptz not null default now()
);

create table if not exists public.telegram_link_codes (
  code        text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz not null
);
create index if not exists telegram_link_codes_user_idx
  on public.telegram_link_codes (user_id);

alter table public.telegram_links       enable row level security;
alter table public.telegram_link_codes  enable row level security;
-- No policies => no access for anon/authenticated. Service-role bypasses RLS.
```

- [ ] **Step 2: Apply to the staging Supabase project**

The runs table already lives in the project, so apply via the team's normal migration path (Supabase dashboard SQL editor or CLI per `docs/09-DEPLOY.md`). Applying to the live DB is a maintainer action — note in the PR that this migration must be run. Do NOT run a destructive command against prod from here.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(telegram): migration for telegram_links + telegram_link_codes"
```

---

## Task 3: RunDraft schema, mapping, draft store (TDD)

**Files:**
- Create: `apps/api/src/telegram/draft.ts`
- Test: `apps/api/src/telegram/draft.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RunDraftSchema, draftToRunCreate, putDraft, takeDraft } from './draft';

test('RunDraftSchema accepts a valid draft', () => {
  const d = RunDraftSchema.parse({ distance_meters: 5000, duration_seconds: 1680, confidence: 0.9 });
  assert.equal(d.distance_meters, 5000);
});

test('RunDraftSchema rejects non-positive distance', () => {
  assert.throws(() => RunDraftSchema.parse({ distance_meters: 0, duration_seconds: 1680, confidence: 0.9 }));
});

test('draftToRunCreate defaults run_date to today and sets telegram source', () => {
  const body = draftToRunCreate(
    { distance_meters: 5000, duration_seconds: 1680, confidence: 0.9 },
    '2026-06-25',
  );
  assert.equal(body.run_date, '2026-06-25');
  assert.equal(body.source, 'telegram');
  assert.equal(body.distance_meters, 5000);
  assert.equal(body.warm_up, false);
});

test('draftToRunCreate keeps an explicit run_date', () => {
  const body = draftToRunCreate(
    { distance_meters: 3000, duration_seconds: 900, run_date: '2026-06-20', confidence: 1 },
    '2026-06-25',
  );
  assert.equal(body.run_date, '2026-06-20');
});

test('draft store put/take is one-shot', () => {
  putDraft('chat:1', { distance_meters: 5000, duration_seconds: 1680, confidence: 0.9 });
  assert.ok(takeDraft('chat:1'));
  assert.equal(takeDraft('chat:1'), undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/pacer && pnpm -C apps/api exec node --import tsx --test src/telegram/draft.test.ts`
Expected: FAIL — cannot find module `./draft`.

- [ ] **Step 3: Write the implementation**

```ts
import { z } from 'zod';
import type { RunCreate } from '@pacer/shared';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// What the model returns. Canonical units: meters & seconds (see CLAUDE.md).
// `pace` and `confidence` are bot-only signals, never stored.
export const RunDraftSchema = z.object({
  distance_meters:  z.number().positive(),
  duration_seconds: z.number().int().positive(),
  run_date:         z.string().regex(dateRegex).nullish(),
  pace:             z.string().nullish(),
  confidence:       z.number().min(0).max(1),
});
export type RunDraft = z.infer<typeof RunDraftSchema>;

/** Map a confirmed draft to the shared RunCreate shape. `today` is yyyy-mm-dd. */
export function draftToRunCreate(draft: RunDraft, today: string): RunCreate {
  return {
    run_date: draft.run_date ?? today,
    distance_meters: draft.distance_meters,
    duration_seconds: draft.duration_seconds,
    warm_up: false,
    stretched: false,
    post_run_food: false,
    source: 'telegram',
  };
}

// In-memory pending drafts, keyed by `${chat_id}:${message_id}`. A draft is
// taken exactly once (on ✓ or ✗); process restart drops pending drafts, which
// is fine — the user just re-sends.
const drafts = new Map<string, RunDraft>();
export function putDraft(key: string, draft: RunDraft): void {
  drafts.set(key, draft);
}
export function takeDraft(key: string): RunDraft | undefined {
  const d = drafts.get(key);
  drafts.delete(key);
  return d;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/pacer && pnpm -C apps/api exec node --import tsx --test src/telegram/draft.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/telegram/draft.ts apps/api/src/telegram/draft.test.ts
git commit -m "feat(telegram): RunDraft schema, RunCreate mapping, draft store"
```

---

## Task 4: Link-code generation (TDD)

**Files:**
- Create: `apps/api/src/telegram/linkCode.ts`
- Test: `apps/api/src/telegram/linkCode.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLinkCode, LINK_CODE_ALPHABET } from './linkCode';

test('generateLinkCode is 8 chars from the unambiguous alphabet', () => {
  for (let i = 0; i < 200; i++) {
    const code = generateLinkCode();
    assert.equal(code.length, 8);
    for (const ch of code) assert.ok(LINK_CODE_ALPHABET.includes(ch), `bad char ${ch}`);
  }
});

test('alphabet excludes ambiguous characters', () => {
  for (const ch of ['I', 'L', 'O', '0', '1']) {
    assert.ok(!LINK_CODE_ALPHABET.includes(ch));
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/pacer && pnpm -C apps/api exec node --import tsx --test src/telegram/linkCode.test.ts`
Expected: FAIL — cannot find module `./linkCode`.

- [ ] **Step 3: Write the implementation**

```ts
// 8-char human-readable codes, excluding I/L/O/0/1 to avoid misreads when a
// user types the code from the app into Telegram.
export const LINK_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateLinkCode(): string {
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += LINK_CODE_ALPHABET[Math.floor(Math.random() * LINK_CODE_ALPHABET.length)];
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/pacer && pnpm -C apps/api exec node --import tsx --test src/telegram/linkCode.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/telegram/linkCode.ts apps/api/src/telegram/linkCode.test.ts
git commit -m "feat(telegram): 8-char link-code generator"
```

---

## Task 5: Per-user daily photo cap (TDD)

**Files:**
- Create: `apps/api/src/telegram/dailyCap.ts`
- Test: `apps/api/src/telegram/dailyCap.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tryConsumePhoto, DAILY_PHOTO_CAP, _resetCaps } from './dailyCap';

test('allows up to the cap then blocks, same day', () => {
  _resetCaps();
  for (let i = 0; i < DAILY_PHOTO_CAP; i++) {
    assert.equal(tryConsumePhoto('u1', '2026-06-25'), true, `parse ${i + 1}`);
  }
  assert.equal(tryConsumePhoto('u1', '2026-06-25'), false);
});

test('resets on a new day', () => {
  _resetCaps();
  for (let i = 0; i < DAILY_PHOTO_CAP; i++) tryConsumePhoto('u1', '2026-06-25');
  assert.equal(tryConsumePhoto('u1', '2026-06-26'), true);
});

test('caps are per user', () => {
  _resetCaps();
  for (let i = 0; i < DAILY_PHOTO_CAP; i++) tryConsumePhoto('u1', '2026-06-25');
  assert.equal(tryConsumePhoto('u2', '2026-06-25'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/pacer && pnpm -C apps/api exec node --import tsx --test src/telegram/dailyCap.test.ts`
Expected: FAIL — cannot find module `./dailyCap`.

- [ ] **Step 3: Write the implementation**

```ts
// In-memory per-user photo-parse cap, reset each calendar day. In-process only;
// a restart resets counts, which is acceptable for an abuse guard.
export const DAILY_PHOTO_CAP = 10;

const counts = new Map<string, { day: string; n: number }>();

/** Returns true and counts one parse if under the cap for `today` (yyyy-mm-dd). */
export function tryConsumePhoto(userId: string, today: string): boolean {
  const cur = counts.get(userId);
  if (!cur || cur.day !== today) {
    counts.set(userId, { day: today, n: 1 });
    return true;
  }
  if (cur.n >= DAILY_PHOTO_CAP) return false;
  cur.n += 1;
  return true;
}

/** Test helper — clears all counts. */
export function _resetCaps(): void {
  counts.clear();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/pacer && pnpm -C apps/api exec node --import tsx --test src/telegram/dailyCap.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/telegram/dailyCap.ts apps/api/src/telegram/dailyCap.test.ts
git commit -m "feat(telegram): per-user daily photo cap"
```

---

## Task 6: Telegram/OpenAI env + OpenAI client

**Files:**
- Create: `apps/api/src/telegram/env.ts`
- Create: `apps/api/src/lib/openai.ts`

- [ ] **Step 1: Write `apps/api/src/telegram/env.ts`**

```ts
// Telegram/bot-specific env. Kept out of lib/env.ts (Foundation B's file) to
// respect slice ownership. Missing token => bot disabled (never throws at boot).

export function botEnabled(): boolean {
  return Boolean(process.env['TELEGRAM_BOT_TOKEN']);
}

export function botToken(): string {
  const t = process.env['TELEGRAM_BOT_TOKEN'];
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  return t;
}

export function webhookSecret(): string | undefined {
  return process.env['TELEGRAM_WEBHOOK_SECRET'] || undefined;
}

/** 'webhook' only when explicitly selected; otherwise polling (local dev). */
export function botMode(): 'webhook' | 'polling' {
  return process.env['TELEGRAM_MODE'] === 'webhook' ? 'webhook' : 'polling';
}
```

- [ ] **Step 2: Write `apps/api/src/lib/openai.ts`**

```ts
import OpenAI from 'openai';

// Single OpenAI client for the platform (bot now; assistant later). Lazily
// constructed so the API boots without a key — callers gate on openaiEnabled().
let _client: OpenAI | null = null;

export function openaiEnabled(): boolean {
  return Boolean(process.env['OPENAI_API_KEY']);
}

export function openai(): OpenAI {
  if (!_client) {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
    _client = new OpenAI({ apiKey });
  }
  return _client;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd ~/pacer && pnpm -C apps/api typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/telegram/env.ts apps/api/src/lib/openai.ts
git commit -m "feat(telegram): bot env helpers + lazy OpenAI client"
```

---

## Task 7: Parsing — model-JSON validation (TDD) + text/photo callers

**Files:**
- Create: `apps/api/src/telegram/parse.ts`
- Test: `apps/api/src/telegram/parse.test.ts`

- [ ] **Step 1: Write the failing test** (pure validator only — no network)

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRunDraftJson } from './parse';

test('parseRunDraftJson validates a good model payload', () => {
  const d = parseRunDraftJson('{"distance_meters":5000,"duration_seconds":1680,"confidence":0.88}');
  assert.equal(d.distance_meters, 5000);
  assert.equal(d.confidence, 0.88);
});

test('parseRunDraftJson throws on malformed json', () => {
  assert.throws(() => parseRunDraftJson('not json'));
});

test('parseRunDraftJson throws when units are wrong (negative)', () => {
  assert.throws(() => parseRunDraftJson('{"distance_meters":-1,"duration_seconds":10,"confidence":0.5}'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/pacer && pnpm -C apps/api exec node --import tsx --test src/telegram/parse.test.ts`
Expected: FAIL — cannot find module `./parse`.

- [ ] **Step 3: Write the implementation**

```ts
import { RunDraftSchema, type RunDraft } from './draft';
import { openai } from '../lib/openai';

const MODEL = 'gpt-4o-mini';

// JSON-schema the model must satisfy. Units are explicit so the model returns
// canonical meters & seconds, never display values.
const RUN_JSON_SCHEMA = {
  name: 'run_draft',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      distance_meters:  { type: 'number', description: 'total distance in METERS' },
      duration_seconds: { type: 'integer', description: 'total duration in SECONDS' },
      run_date:         { type: ['string', 'null'], description: 'yyyy-mm-dd if stated, else null' },
      pace:             { type: ['string', 'null'], description: 'pace text if shown, else null' },
      confidence:       { type: 'number', description: '0..1 confidence in the extraction' },
    },
    required: ['distance_meters', 'duration_seconds', 'run_date', 'pace', 'confidence'],
  },
} as const;

const SYSTEM =
  'Extract a single run from the input. Distance in METERS, duration in SECONDS. ' +
  'If the input is not a run, set confidence to 0. Use null for unknown fields.';

/** Validate the model's JSON string against RunDraftSchema. Throws on bad shape. */
export function parseRunDraftJson(raw: string): RunDraft {
  return RunDraftSchema.parse(JSON.parse(raw));
}

/** Parse free text into a RunDraft via OpenAI structured output. */
export async function parseText(message: string): Promise<RunDraft> {
  const res = await openai().chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_schema', json_schema: RUN_JSON_SCHEMA },
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: message },
    ],
  });
  return parseRunDraftJson(res.choices[0]?.message.content ?? '');
}

/** Parse a watch/treadmill photo into a RunDraft via OpenAI vision. */
export async function parsePhoto(imageUrl: string): Promise<RunDraft> {
  const res = await openai().chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_schema', json_schema: RUN_JSON_SCHEMA },
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract the run shown on this screen.' },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
  });
  return parseRunDraftJson(res.choices[0]?.message.content ?? '');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/pacer && pnpm -C apps/api exec node --import tsx --test src/telegram/parse.test.ts`
Expected: PASS (3 tests). No network calls (only `parseRunDraftJson` is exercised).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/telegram/parse.ts apps/api/src/telegram/parse.test.ts
git commit -m "feat(telegram): OpenAI text + vision run parsing"
```

---

## Task 8: Save seam — logRunForUser

**Files:**
- Create: `apps/api/src/telegram/save.ts`

- [ ] **Step 1: Write the implementation** (mirrors `routes/runs.ts` insert + fanOut)

```ts
import type { RealtimeEvent } from '@pacer/shared';
import { emit } from '../lib/events';
import { broadcast } from '../lib/realtime';
import { serviceClient } from '../lib/supabase';
import { draftToRunCreate, type RunDraft } from './draft';

export type SaveResult =
  | { ok: true; runId: string }
  | { ok: false; error: string };

/**
 * SEAM: the bot's single save path. Today it mirrors POST /runs using the
 * service-role client (the bot has no per-user JWT; data-model sanctions
 * Telegram ingestion as service-role work). When the assistant tool layer
 * (card 10 / P3) lands, replace this body with:
 *   return executeTool('log_run', draftToRunCreate(draft, today), { userId });
 */
export async function logRunForUser(
  userId: string,
  draft: RunDraft,
  today: string,
): Promise<SaveResult> {
  const body = draftToRunCreate(draft, today);
  const { data, error } = await serviceClient()
    .from('runs')
    .insert({ ...body, user_id: userId })
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'insert failed' };

  emit('run.logged', {
    userId,
    runId: data.id as string,
    runDate: data.run_date as string,
    distanceMeters: Number(data.distance_meters),
  });
  await fanOut(userId, { type: 'run.logged', ids: { runId: data.id as string } });
  return { ok: true, runId: data.id as string };
}

// Same best-effort fan-out as routes/runs.ts: user channel + each group.
async function fanOut(userId: string, event: RealtimeEvent): Promise<void> {
  void broadcast(`user:${userId}`, event);
  const { data } = await serviceClient()
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);
  for (const row of data ?? []) {
    void broadcast(`group:${row.group_id as string}`, event);
  }
}
```

- [ ] **Step 2: Typecheck** (confirms emit/broadcast/RealtimeEvent shapes match)

Run: `cd ~/pacer && pnpm -C apps/api typecheck`
Expected: PASS. If `run.logged` payload or `RealtimeEvent` shape mismatches, align with `routes/runs.ts:35-36`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/telegram/save.ts
git commit -m "feat(telegram): logRunForUser save seam (insert + emit + broadcast)"
```

---

## Task 9: Authed link routes (/telegram/link-code, /status, /link)

**Files:**
- Create: `apps/api/src/routes/telegram.ts`
- Modify: `apps/api/src/routes/index.ts`

- [ ] **Step 1: Write `apps/api/src/routes/telegram.ts`**

```ts
import { Hono } from 'hono';
import type { AppEnv } from '../lib/auth';
import { serviceClient } from '../lib/supabase';
import { generateLinkCode } from '../telegram/linkCode';

const LINK_CODE_TTL_MS = 10 * 60 * 1000;

// Account-linking endpoints. Authed by the global guard. The telegram_* tables
// are service-role only (deny-all RLS), so these use the service client but
// always scope to the verified userId from the token — never a body id.
export const telegram = new Hono<AppEnv>()
  .post('/link-code', async (c) => {
    const userId = c.get('userId');
    const code = generateLinkCode();
    const expires_at = new Date(Date.now() + LINK_CODE_TTL_MS).toISOString();
    const { error } = await serviceClient()
      .from('telegram_link_codes')
      .insert({ code, user_id: userId, expires_at });
    if (error) return c.json({ error: error.message }, 400);
    return c.json({ code, expires_at });
  })
  .get('/status', async (c) => {
    const userId = c.get('userId');
    const { data } = await serviceClient()
      .from('telegram_links')
      .select('telegram_username')
      .eq('user_id', userId)
      .maybeSingle();
    return c.json({ linked: Boolean(data), telegram_username: data?.telegram_username ?? null });
  })
  .delete('/link', async (c) => {
    const userId = c.get('userId');
    const { error } = await serviceClient()
      .from('telegram_links')
      .delete()
      .eq('user_id', userId);
    if (error) return c.json({ error: error.message }, 400);
    return c.body(null, 204);
  });
```

- [ ] **Step 2: Mount it in `apps/api/src/routes/index.ts`** (append one line in the registry + the import)

Add import near the others:
```ts
import { telegram } from './telegram';
```
Add inside `registerRoutes`, after the `workouts` line:
```ts
  app.route('/telegram', telegram); // authed
```

- [ ] **Step 3: Typecheck**

Run: `cd ~/pacer && pnpm -C apps/api typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/telegram.ts apps/api/src/routes/index.ts
git commit -m "feat(telegram): authed link-code/status/link routes"
```

---

## Task 10: Bot handlers (start, message, confirm)

**Files:**
- Create: `apps/api/src/telegram/handlers/start.ts`
- Create: `apps/api/src/telegram/handlers/message.ts`
- Create: `apps/api/src/telegram/handlers/confirm.ts`

- [ ] **Step 1: Write `handlers/start.ts`** — consume an 8-char link code

```ts
import type { Context } from 'grammy';
import { serviceClient } from '../../lib/supabase';

// /start <code> — validate an unexpired link code, link this Telegram user to
// the owning account, and delete the one-time code.
export async function handleStart(ctx: Context): Promise<void> {
  const from = ctx.from;
  const code = (ctx.match?.toString() ?? '').trim().toUpperCase();
  if (!from) return;
  if (!code) {
    await ctx.reply('To link, open Pacer → Settings, get your 8-char code, then send: /start <code>');
    return;
  }
  const db = serviceClient();
  const { data: row } = await db
    .from('telegram_link_codes')
    .select('user_id, expires_at')
    .eq('code', code)
    .maybeSingle();
  if (!row || new Date(row.expires_at as string).getTime() < Date.now()) {
    await ctx.reply('That code is invalid or expired. Generate a fresh one in Pacer → Settings.');
    return;
  }
  const { error } = await db.from('telegram_links').upsert({
    user_id: row.user_id as string,
    telegram_user_id: from.id,
    telegram_username: from.username ?? null,
    linked_at: new Date().toISOString(),
  });
  if (error) {
    await ctx.reply('Could not link your account, please try again.');
    return;
  }
  await db.from('telegram_link_codes').delete().eq('code', code);
  await ctx.reply('Linked! Send me a run like "ran 5k in 28 min" or a photo of your watch.');
}
```

- [ ] **Step 2: Write `handlers/message.ts`** — text/photo → draft → confirm keyboard

```ts
import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { serviceClient } from '../../lib/supabase';
import { metersToKm, formatDuration } from '@pacer/shared';
import { parseText, parsePhoto } from '../parse';
import { putDraft, type RunDraft } from '../draft';
import { tryConsumePhoto } from '../dailyCap';

const CONFIDENCE_FLOOR = 0.6;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function linkedUserId(telegramUserId: number): Promise<string | null> {
  const { data } = await serviceClient()
    .from('telegram_links')
    .select('user_id')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle();
  return (data?.user_id as string) ?? null;
}

async function offerConfirm(ctx: Context, userId: string, draft: RunDraft): Promise<void> {
  const km = metersToKm(draft.distance_meters).toFixed(2);
  const dur = formatDuration(draft.duration_seconds);
  const sent = await ctx.reply(
    `Got: ${km} km in ${dur}${draft.run_date ? ` on ${draft.run_date}` : ''}. Save it?`,
    { reply_markup: new InlineKeyboard().text('✓ Save', 'save').text('✗ Discard', 'discard') },
  );
  // Key the pending draft by the CONFIRM message so the callback can find it.
  putDraft(`${sent.chat.id}:${sent.message_id}:${userId}`, draft);
}

export async function handleMessage(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const userId = await linkedUserId(from.id);
  if (!userId) {
    await ctx.reply('Link your account first: Pacer → Settings → copy code → send /start <code>.');
    return;
  }

  const photos = ctx.message?.photo;
  try {
    if (photos && photos.length > 0) {
      if (!tryConsumePhoto(userId, today())) {
        await ctx.reply("You've hit today's photo limit (10). Please type the run instead.");
        return;
      }
      const file = await ctx.getFile(); // largest size for the message's photo
      const url = `https://api.telegram.org/file/bot${process.env['TELEGRAM_BOT_TOKEN']}/${file.file_path}`;
      const draft = await parsePhoto(url);
      if (draft.confidence < CONFIDENCE_FLOOR) {
        await ctx.reply("I couldn't read that clearly — please type the run (e.g. \"5k in 28 min\").");
        return;
      }
      await offerConfirm(ctx, userId, draft);
      return;
    }

    const text = ctx.message?.text;
    if (text) {
      const draft = await parseText(text);
      if (draft.confidence < CONFIDENCE_FLOOR) {
        await ctx.reply("I didn't catch a run there. Try \"ran 5k in 28 minutes\".");
        return;
      }
      await offerConfirm(ctx, userId, draft);
    }
  } catch {
    await ctx.reply('Something went wrong reading that — please try again.');
  }
}
```

> Note: confirm the helper names exist in `@pacer/shared` (`metersToKm`, `formatDuration` are in `packages/shared/src/units.ts`). If a name differs, use the actual export.

- [ ] **Step 3: Write `handlers/confirm.ts`** — ✓/✗ callback

```ts
import type { Context } from 'grammy';
import { serviceClient } from '../../lib/supabase';
import { takeDraft } from '../draft';
import { logRunForUser } from '../save';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function linkedUserId(telegramUserId: number): Promise<string | null> {
  const { data } = await serviceClient()
    .from('telegram_links')
    .select('user_id')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle();
  return (data?.user_id as string) ?? null;
}

export async function handleConfirm(ctx: Context): Promise<void> {
  const from = ctx.from;
  const msg = ctx.callbackQuery?.message;
  const action = ctx.callbackQuery?.data;
  if (!from || !msg) {
    await ctx.answerCallbackQuery();
    return;
  }
  const userId = await linkedUserId(from.id);
  if (!userId) {
    await ctx.answerCallbackQuery('Account not linked.');
    return;
  }
  const key = `${msg.chat.id}:${msg.message_id}:${userId}`;
  const draft = takeDraft(key);
  if (!draft) {
    await ctx.answerCallbackQuery('This run is no longer pending.');
    return;
  }
  if (action === 'discard') {
    await ctx.answerCallbackQuery('Discarded.');
    await ctx.editMessageText('Discarded — nothing saved.');
    return;
  }
  const result = await logRunForUser(userId, draft, today());
  if (result.ok) {
    await ctx.answerCallbackQuery('Saved!');
    await ctx.editMessageText('✅ Run saved to Pacer.');
  } else {
    await ctx.answerCallbackQuery('Save failed.');
    await ctx.editMessageText('Could not save that run — please try again.');
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `cd ~/pacer && pnpm -C apps/api typecheck`
Expected: PASS. Fix any grammY `Context` type mismatches (e.g. `ctx.match` requires the command middleware; it does in `bot.command('start', ...)`).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/telegram/handlers/
git commit -m "feat(telegram): start/link, message (text+photo), and confirm handlers"
```

---

## Task 11: Bot wiring + webhook route + dev polling

**Files:**
- Create: `apps/api/src/telegram/bot.ts`
- Create: `apps/api/src/routes/webhook.ts`
- Modify: `apps/api/src/routes/index.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write `apps/api/src/telegram/bot.ts`**

```ts
import { Bot } from 'grammy';
import { botEnabled, botToken } from './env';
import { handleStart } from './handlers/start';
import { handleMessage } from './handlers/message';
import { handleConfirm } from './handlers/confirm';

// Lazily built so importing this module never throws when the token is absent.
let _bot: Bot | null = null;

export function getBot(): Bot {
  if (!_bot) {
    const bot = new Bot(botToken());
    bot.command('start', handleStart);
    bot.on('callback_query:data', handleConfirm);
    bot.on('message', handleMessage); // text + photo
    _bot = bot;
  }
  return _bot;
}

/** Start long-polling (local dev). No-op if the bot is disabled. */
export async function startPolling(): Promise<void> {
  if (!botEnabled()) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN not set — bot disabled.');
    return;
  }
  const bot = getBot();
  void bot.start(); // resolves only when the bot stops; fire-and-forget
  console.log('[telegram] bot started (long-polling).');
}
```

- [ ] **Step 2: Write `apps/api/src/routes/webhook.ts`**

```ts
import { Hono } from 'hono';
import { webhookCallback } from 'grammy';
import { getBot } from '../telegram/bot';
import { botEnabled, webhookSecret } from '../telegram/env';

// Public route (see PUBLIC_PATH_PREFIXES in app.ts). Telegram echoes our secret
// in this header; reject anything else before handing the update to grammY.
export const webhook = new Hono().post('/', async (c) => {
  if (!botEnabled()) return c.text('bot disabled', 503);
  const secret = webhookSecret();
  if (secret && c.req.header('X-Telegram-Bot-Api-Secret-Token') !== secret) {
    return c.json({ error: 'bad secret token' }, 401);
  }
  return webhookCallback(getBot(), 'hono')(c);
});
```

- [ ] **Step 3: Mount the webhook in `apps/api/src/routes/index.ts`**

Add import:
```ts
import { webhook } from './webhook';
```
Add inside `registerRoutes` (place near `/health`, with a public comment):
```ts
  app.route('/webhook', webhook); // public (see PUBLIC_PATH_PREFIXES)
```

- [ ] **Step 4: Start polling in dev from `apps/api/src/index.ts`**

After the `serve(...)` call, append:
```ts
import { botMode, botEnabled } from './telegram/env';
import { startPolling } from './telegram/bot';

if (botEnabled() && botMode() === 'polling') {
  void startPolling();
}
```
(Place the imports at the top with the others; the `if` block goes after `serve`.)

- [ ] **Step 5: Typecheck the whole workspace**

Run: `cd ~/pacer && pnpm typecheck`
Expected: PASS across all workspaces.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/telegram/bot.ts apps/api/src/routes/webhook.ts apps/api/src/routes/index.ts apps/api/src/index.ts
git commit -m "feat(telegram): bot wiring, secret-token webhook, dev polling"
```

---

## Task 12: Full verification + PR

- [ ] **Step 1: Run all tests**

Run: `cd ~/pacer && pnpm test`
Expected: shared tests PASS; `apps/api` telegram tests PASS (draft, linkCode, dailyCap, parse).

- [ ] **Step 2: Typecheck gate**

Run: `cd ~/pacer && pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Manual boot smoke test (no token needed)**

Run the API (`node --env-file=apps/api/.env apps/api/src/index.ts` via tsx, as the repo does). With no `TELEGRAM_BOT_TOKEN`, expect the log `[telegram] TELEGRAM_BOT_TOKEN not set — bot disabled.` and the server still listening on 8787.

- [ ] **Step 4: Manual end-to-end (optional, needs real tokens)**

Set `TELEGRAM_BOT_TOKEN` (BotFather) + `OPENAI_API_KEY` in `apps/api/.env`, run the migration against the staging DB, boot in polling mode, generate a link code (`POST /telegram/link-code` with a user JWT), `/start <code>` in Telegram, then text "ran 5k in 28 min" → confirm ✓ → verify a `runs` row with `source='telegram'`.

- [ ] **Step 5: Push + open PR into dev**

```bash
git push -u origin feat/11-telegram-bot
gh pr create --base dev --head feat/11-telegram-bot \
  --title "feat(telegram): run logging bot (text + photo, ✓/✗ confirm)" \
  --body "Implements P4. Linking, OpenAI text+vision parsing, confirm UX, save via logRunForUser (executeTool seam). Requires the telegram migration to be applied and TELEGRAM_BOT_TOKEN + OPENAI_API_KEY set. Out of scope: habit check-ins, nudges (depend on M3/cron)."
```

---

## Self-review notes

- **Spec coverage:** linking (T2,T9,T10), text parse (T7,T10), photo parse + cap + low-confidence (T5,T7,T10), confirm ✓/✗ (T10,T11), save+emit+broadcast (T8,T11), webhook+polling+env-guard (T6,T11), tests (T3–T7,T12), migration+RLS (T2). All spec sections map to a task.
- **Type consistency:** `RunDraft` (draft.ts) used identically in parse/save/handlers; `logRunForUser(userId, draft, today)` signature matches its single call site in confirm.ts; `getBot()` used by both bot.ts polling and webhook.ts.
- **Unverified-at-write-time:** exact `@pacer/shared` display-helper names (`metersToKm`, `formatDuration`) and grammY `webhookCallback(bot,'hono')` adapter signature — Task 10/11 typecheck steps catch any mismatch; fix to the real export if tsc complains.
```
