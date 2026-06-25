# 01 — Foundation A — Monorepo scaffold + shared contracts

> **Stage:** Foundation  ·  **Suggested order:** 1  ·  **Size:** L  ·  **One owner builds this end to end.**

**Goal (one sentence).** Stand up the pnpm monorepo (`packages/shared`, `apps/api`, `apps/web`) on Node 22 with TypeScript strict everywhere, and build the `packages/shared` contract surface — zod schemas, domain types, unit/date helpers, the points constants + pure `scoreFor()`, the realtime event-type union + payloads, and the assistant tool-schema stub — that every other card imports as raw TS.

**Why it matters / where it sits in the product.** This is the first merge; nothing else can start until it lands. It defines the canonical-units rule (store meters/seconds, derive km/mi/pace/durations here), the single scoring formula web/api/bot all agree on, and the event-name catalog the in-process bus and realtime layer route through. Get the signatures right once and four developers build in parallel against them without renegotiating contracts.

## Depends on

Nothing — this is the root card. It must be self-contained and correct on its own, because Foundation B (API server + event bus + realtime + route registry) and Foundation C (web shell + theme tokens + API client + section slots) both build directly on top of it.

To stay unblocked: do NOT wait on Supabase being provisioned, the API server existing, or the web shell. `packages/shared` is pure TS with one dependency (`zod`) plus `date-fns` for week math — it compiles and unit-tests in isolation. Foundation B/C consume your exports the moment this merges.

## You own these files (no other card touches them)

```
pnpm-workspace.yaml
package.json                         # root: scripts (incl. "prepare" → activates .githooks) + devDeps; no app code
tsconfig.base.json                   # strict base every package/app extends
.nvmrc                               # 22
.npmrc                               # engine-strict, node-linker if needed
.gitignore

packages/shared/package.json
packages/shared/tsconfig.json
packages/shared/src/index.ts                 # barrel: re-exports everything below
packages/shared/src/schemas/index.ts         # barrel for schemas/
packages/shared/src/schemas/profile.ts       # the FIRST example schema (this card)
packages/shared/src/types/index.ts           # domain types not derived from zod
packages/shared/src/units.ts                 # m/s -> km/mi/pace, durations
packages/shared/src/dates.ts                 # week math via date-fns, configurable week-start
packages/shared/src/scoring.ts               # POINTS constants + pure scoreFor()
packages/shared/src/events.ts                # event-name union + payload types
packages/shared/src/assistant-tools.ts       # tool-schema location STUB (names + JSON-schema shape only)
packages/shared/src/*.test.ts                # unit tests for units/dates/scoring
```

Future entity schemas (`runs.ts`, `workouts.ts`, `habits.ts`, ...) are owned by their respective slice cards and dropped into `packages/shared/src/schemas/` — you only ship `profile.ts` as the worked example plus the `schemas/index.ts` barrel pattern. Other cards append their own export line to that barrel; do not pre-author their schemas.

## Foundation contracts you CONSUME (never modify)

You DEFINE these contracts; you do not consume any. Concretely you are the author of:

- The `schemas/` folder pattern: one file per entity, `export const XSchema = z.object({...})` + `export type X = z.infer<typeof XSchema>`, re-exported from `schemas/index.ts`.
- The unit/date helper signatures (below) — every display value in the product flows through them.
- `POINTS` + `scoreFor()` — the single scoring source of truth (web preview, api ledger, bot reply).
- The `RealtimeEventName` union + payload map — Foundation B's `broadcast()` and event bus type against this.
- The assistant tool-name catalog stub — the assistant card fills in the executors later.

## Build order (do these in this sequence)

### 1. Migration
None in this card. Foundation A ships zero SQL — schema migrations belong to each slice (timestamp-prefixed `supabase/migrations/<ts>__<slice>.sql`, owned by Foundation B for the `profiles` auth-trigger table and by each feature card for its own tables). You only model `profiles` here as a **zod schema** so other cards have the shape; the actual `profiles` table + RLS is Foundation B's migration. Do not write SQL.

### 2. Shared (the heart of this card)

Set canonical-units rule in code: **store meters & seconds; derive everything else here.**

**`schemas/profile.ts`** — worked example mirroring the `profiles` table:
```ts
export const ProfileSchema = z.object({
  id: z.string().uuid(),
  handle: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/), // case-normalized
  displayName: z.string().min(1),
  units: z.enum(['km', 'mi']),
  theme: z.enum(['light', 'dark']),
  weekStart: z.union([z.literal(0), z.literal(1)]),  // Sun | Mon
  avatarEmoji: z.string().optional(),
  nudgePref: z.enum(['off', 'daily', 'weekly']),
  createdAt: z.string().datetime(),
});
export type Profile = z.infer<typeof ProfileSchema>;
```
Also export `ProfileUpdateSchema` (partial of the user-editable fields) for the `PATCH /profile/me` validator other cards reuse.

**`units.ts`** — pure, no date-fns:
```ts
type Units = 'km' | 'mi';
metersToKm(m: number): number
metersToDisplayDistance(m: number, units: Units): { value: number; unit: 'km' | 'mi' }
paceSecondsPerUnit(distanceMeters: number, durationSeconds: number, units: Units): number  // s per km|mi
formatPace(secondsPerUnit: number): string         // "5:30" mm:ss, guards 0/Infinity
formatDuration(seconds: number): string            // "28:30" or "1:05:00"
```
Never round-trip through display values; callers pass canonical meters/seconds.

**`dates.ts`** — date-fns only, week-start configurable (`0 = Sunday`, `1 = Monday`, matching the `profiles.week_start` column):
```ts
type WeekStart = 0 | 1;
weekRange(date: Date, weekStart: WeekStart): { start: Date; end: Date }
isInCurrentWeek(date: Date, weekStart: WeekStart, now?: Date): boolean
toDateKey(date: Date): string          // 'yyyy-MM-dd' for run_date / check_date
streakLength(activeDateKeys: string[], now?: Date): number  // consecutive days w/ activity, today inclusive
```
`streakLength` powers the streak flame and the +10 streak event; keep it pure (caller fetches the date list).

**`scoring.ts`** — the §6 points table verbatim:
```ts
export const POINTS = {
  RUN_BASE: 10, RUN_PER_KM: 1,
  WORKOUT: 10,
  HABIT_PER_DAY: 3, ALL_HABITS_BONUS: 2,
  PLAN_RUN_ON_SCHEDULE: 5,
  STREAK_7DAY: 10,
} as const;

type ScoreReason = 'run'|'workout'|'habit'|'habit_day_bonus'|'plan_run'|'streak';
scoreFor(input):  // discriminated union by reason; for 'run' takes distanceMeters
  // run => RUN_BASE + floor(km) * RUN_PER_KM ; workout => WORKOUT ; etc.
  : number
```
Mirror the `score_events.reason` enum exactly. Pure function, fully unit-tested with the spec's examples.

**`events.ts`** — the in-process bus event catalog AND the realtime catalog (Foundation B types both against this):
```ts
// Domain events emitted on the in-process bus (apps/api/src/lib/events.ts):
export type DomainEventName =
  | 'run.logged' | 'workout.logged' | 'habit.checked'
  | 'reaction.added' | 'score.awarded' | 'challenge.updated';

export type DomainEventPayloads = {
  'run.logged':       { userId: string; runId: string; runDate: string };
  'workout.logged':   { userId: string; workoutId: string; workoutDate: string };
  'habit.checked':    { userId: string; habitId: string; checkDate: string };
  'reaction.added':   { userId: string; targetType: 'run'|'workout'|'habit_day'; targetId: string };
  'score.awarded':    { userId: string; points: number; reason: ScoreReason; eventDate: string };
  'challenge.updated':{ challengeId: string; userId?: string };
};

// Realtime broadcast: channels 'group:<id>' | 'user:<id>'; events carry WHAT changed, not data.
export type RealtimeChannel = `group:${string}` | `user:${string}`;
export type RealtimeEvent = { type: DomainEventName; ids: Record<string, string> };
```
Keep payloads to ids + dates + scalars — clients refetch via the API. Adding a future event = appending one union member here (append-only).

**`assistant-tools.ts`** — STUB only. Export the tool-name catalog and the JSON-schema-shaped type; do NOT implement executors (that's the assistant card):
```ts
export type AssistantToolName =
  | 'log_run' | 'log_workout' | 'check_habit'
  | 'create_challenge' | 'get_stats' | 'get_leaderboard' | 'navigate';
export type AssistantToolDef = { name: AssistantToolName; description: string; parameters: object }; // JSON Schema
export const ASSISTANT_TOOLS: AssistantToolDef[] = []; // filled by the assistant card
```
The full tool definitions + executor are built later by the Assistant tool-layer card (card 10) under `packages/shared/src/assistant/`; THIS stub file is replaced there — do not build the real tools here. Keep the stub minimal (the `AssistantToolName` union is fine).

**`index.ts`** — barrel re-exporting schemas, types, units, dates, scoring, events, assistant-tools so consumers write `import { scoreFor, metersToKm, ProfileSchema } from '@pacer/shared'`.

### 3. API
None in this card beyond making the workspace resolvable. Create `apps/api/package.json` + `apps/api/tsconfig.json` (extends base, references `@pacer/shared`) with a minimal `src/index.ts` placeholder so `pnpm typecheck` passes workspace-wide — Foundation B replaces the placeholder with Hono, the event bus, realtime, and the route registry. Do NOT build routes, the event bus, or `broadcast()` here.

### 4. Web
None in this card beyond scaffolding. Create `apps/web/package.json` + `apps/web/tsconfig.json` (extends base) with a minimal placeholder so typecheck passes — Foundation C builds the Vite/React/Tailwind shell, theme tokens, API client, and section slots. Do NOT add components, theme tokens, or pages here. (Theme-token file is owned by Foundation C; this card hardcodes nothing visual because it ships no UI.)

## Packages (ONLY these — all from the stack)

- **typescript** — strict types everywhere
- **zod** — schema-per-entity contract
- **date-fns** — week math, tree-shakeable
- **tsx** — typecheck/test runner (no build step)

(`@pacer/shared` is the internal workspace package, not a dependency to install. No runtime framework, no Supabase, no React in this card.)

## Acceptance criteria — the PR gate (copy this checklist into your PR description)

- [ ] `pnpm install` clean from repo root; `.nvmrc` = 22, `pnpm typecheck` runs across all three workspaces and passes with **zero** errors.
- [ ] Root `package.json` has `"prepare": "git config core.hooksPath .githooks || true"` so the committed `.githooks/` (secret-block + no-push-to-main) self-activate on `pnpm install` — no manual setup step.
- [ ] TS strict on in `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`); every workspace extends it.
- [ ] `@pacer/shared` is consumed as **raw TS** (no build/dist step) and imports resolve from both `apps/api` and `apps/web` placeholders.
- [ ] `ProfileSchema` fields match the `profiles` table 1:1 (handle 3–20, units km|mi, week_start 0|1, nudge_pref off|daily|weekly).
- [ ] `units.ts` / `dates.ts` take canonical meters/seconds + date keys and **derive** display values — no stored/invented display values anywhere.
- [ ] `POINTS` + `scoreFor()` match §6 exactly; `scoreFor` reasons match the `score_events.reason` enum; unit tests cover run (base + per-km floor), workout, habit, all-habits bonus, plan-run, streak.
- [ ] `dates.streakLength` and `weekRange` are pure and tested for both week-start values.
- [ ] `events.ts` exports all six canonical domain events with id/scalar-only payloads and the `RealtimeChannel`/`RealtimeEvent` types.
- [ ] `assistant-tools.ts` exports the 7-name `AssistantToolName` catalog as a stub (no executors).
- [ ] No hardcoded theme values (this card ships no UI). No secrets, no `.env` committed.
- [ ] Unit-test files run via `tsx` and pass; PR opened into `dev`.

## How to verify locally

1. `nvm use` (picks up `.nvmrc` → Node 22), then `pnpm install` from repo root.
2. `pnpm typecheck` → passes across `packages/shared`, `apps/api`, `apps/web`.
3. `pnpm --filter @pacer/shared test` → unit tests green. Spot-check expected values:
   - `scoreFor({ reason: 'run', distanceMeters: 5000 })` → `15` (10 + floor(5)·1).
   - `formatPace(paceSecondsPerUnit(5000, 1680, 'km'))` → `"5:36"`.
   - `formatDuration(1680)` → `"28:00"`.
   - `streakLength([...today, yesterday, 2-days-ago])` → `3`.
   - `weekRange(d, 1)` starts Monday; `weekRange(d, 0)` starts Sunday.
4. In a scratch file inside `apps/api`, `import { scoreFor } from '@pacer/shared'` and confirm it type-checks — proves cross-workspace raw-TS resolution.

## Out of scope for this card

- Any SQL / migrations, including the `profiles` table + auth trigger (Foundation B).
- The Hono server, in-process event bus, `broadcast()`/realtime helper, route registry (Foundation B).
- The Vite/React shell, Tailwind theme tokens, API client, TanStack Query setup, Home/Progress section slots (Foundation C).
- Entity schemas other than `profile.ts` (each owned by its slice card; they append to the `schemas/` barrel).
- Implementing assistant tool executors, OpenAI/Telegram/Supabase wiring, Railway config.
- Any UI, components, or theme values.

## Copy-paste kickoff prompt for Claude

```
You are building ONE slice of Pacer, a greenfield fitness PWA (pnpm monorepo). This is
Foundation A: the monorepo scaffold + the shared contracts package. Greenfield — no prior
build exists. Use ONLY these packages: typescript, zod, date-fns, tsx. No theme/UI here.

You OWN exactly these files (touch nothing else):
  pnpm-workspace.yaml, root package.json, tsconfig.base.json, .nvmrc (=22), .npmrc, .gitignore
  packages/shared/{package.json,tsconfig.json}
  packages/shared/src/index.ts
  packages/shared/src/schemas/{index.ts, profile.ts}
  packages/shared/src/types/index.ts
  packages/shared/src/{units.ts, dates.ts, scoring.ts, events.ts, assistant-tools.ts}
  packages/shared/src/*.test.ts
  apps/api/{package.json,tsconfig.json,src/index.ts}      <- minimal placeholder only
  apps/web/{package.json,tsconfig.json}                   <- minimal placeholder only

Build order:
1. pnpm workspace (packages/shared, apps/api, apps/web), Node 22, tsconfig.base.json with
   TS strict (strict, noUncheckedIndexedAccess, noImplicitOverride). Root `pnpm typecheck`
   script runs across all workspaces. `@pacer/shared` consumed as RAW TS — no build step.
   Add a root "prepare" script: "git config core.hooksPath .githooks || true" so the committed
   .githooks/ (secret-block + no-push-to-main) activate automatically on pnpm install — no setup script.
2. packages/shared:
   - schemas/profile.ts: ProfileSchema (id uuid, handle 3-20 [a-z0-9_], displayName, units
     km|mi, theme light|dark, weekStart 0|1, avatarEmoji?, nudgePref off|daily|weekly,
     createdAt) + Profile type + ProfileUpdateSchema (partial editable fields). schemas/index.ts barrel.
   - units.ts: CANONICAL = meters & seconds; derive everything. metersToKm,
     metersToDisplayDistance(m, 'km'|'mi'), paceSecondsPerUnit, formatPace ("5:30"),
     formatDuration ("28:00"/"1:05:00"). Pure.
   - dates.ts (date-fns, weekStart 0|1 configurable): weekRange, isInCurrentWeek, toDateKey
     ('yyyy-MM-dd'), streakLength(activeDateKeys, now?). Pure.
   - scoring.ts: POINTS { RUN_BASE 10, RUN_PER_KM 1, WORKOUT 10, HABIT_PER_DAY 3,
     ALL_HABITS_BONUS 2, PLAN_RUN_ON_SCHEDULE 5, STREAK_7DAY 10 } + pure scoreFor() keyed by
     reason ('run'|'workout'|'habit'|'habit_day_bonus'|'plan_run'|'streak'); run = base +
     floor(km)*per_km. Matches score_events.reason exactly.
   - events.ts: DomainEventName union (run.logged, workout.logged, habit.checked,
     reaction.added, score.awarded, challenge.updated) + DomainEventPayloads (ids/dates/scalars
     only) + RealtimeChannel `group:${id}`|`user:${id}` + RealtimeEvent { type, ids }.
   - assistant-tools.ts: STUB. AssistantToolName (log_run, log_workout, check_habit,
     create_challenge, get_stats, get_leaderboard, navigate) + AssistantToolDef + empty
     ASSISTANT_TOOLS. No executors.
   - index.ts barrel re-exports all of the above so `import { scoreFor } from '@pacer/shared'` works.
   - *.test.ts: unit-test units, dates, scoring (run with concrete spec numbers).
3. apps/api + apps/web: minimal package.json/tsconfig.json (extend base, reference @pacer/shared)
   + a placeholder src so `pnpm typecheck` passes workspace-wide. Do NOT build the server or the
   web shell — those are Foundation B and C.

Do NOT write SQL, the Hono server, the event bus, broadcast(), routes, the Vite/React shell,
theme tokens, or any UI. Store meters/seconds only; never store display values. Open a PR into
`dev` once every acceptance-criteria checkbox passes (pnpm typecheck clean across all workspaces,
shared unit tests green).
```
