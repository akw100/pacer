# 04 — MVP: Logging — runs & workouts

> **Stage:** MVP  ·  **Suggested order:** 4  ·  **Size:** L  ·  **One owner builds this end to end.**

**Goal (one sentence).** Let a signed-in user log runs and workouts from a Log sheet, see them in a History list and a Trends chart, and edit/delete them — emitting `run.logged` / `workout.logged` so other slices react.

**Why it matters / where it sits in the product.** Logging is Pacer's hero action — the "+" that is never more than one tap away. After this card lands, Pacer is a usable solo activity tracker; scoring, plans, and groups bolt on later purely by subscribing to the events this card emits.

## Depends on

- **`packages/shared` (card 01)** — consume the `Run`/`Workout` zod schemas, domain types, and the unit/date helpers (`metersToDisplay`, `paceFor`, `weekBounds`, etc.). If shared isn't merged yet, build against the schema shapes documented here and import from `@pacer/shared`; do not redefine them locally.
- **Event bus + realtime (card 02)** — `emit(name, payload)` from `apps/api/src/lib/events.ts` and `broadcast(channel, event)` from `apps/api/src/lib/realtime.ts`. Both are safe no-ops on day one, so **your run still saves even if scoring/plans/groups are unmerged** — you emit into the void and nobody listens yet. Never import another slice's subscriber.
- **Route registry + API client + Web shells (card 03)** — add your route module via ONE append-only line in `apps/api/src/routes/index.ts`; add Progress sub-tab + Log-sheet sections via append-only slot lines. If the Progress page shell isn't merged, stub a local `<ProgressPage>` route to develop against and delete it at integration.
- **Profile unit preference (card auth/profile)** — read `profile.units` ('km'|'mi') to label inputs. If the profile endpoint isn't ready, default to `'km'` and read from a `useProfile()` hook so the wiring is a one-line swap.

You are never blocked: every dependency is either a pure import or a no-op helper.

## You own these files (no other card touches them)

```
supabase/migrations/<ts>_logging_runs_workouts.sql      # <ts> = timestamp prefix, e.g. 20260624T120000

packages/shared/src/schemas/run.ts                      # if 01 hasn't created it; else extend via PR coordination — prefer owning it
packages/shared/src/schemas/workout.ts

apps/api/src/routes/runs.ts
apps/api/src/routes/workouts.ts

apps/web/src/features/logging/                          # entire folder is yours
  LogSheet.tsx                  # vaul sheet (phone) / dialog (desktop) + Run/Workout/Habits segmented control
  RunForm.tsx
  WorkoutForm.tsx
  HistorySection.tsx            # reverse-chron runs+workouts, edit/delete, swipe
  TrendsSection.tsx             # summary stats + weekly distance bars + pace line
  ActivityRow.tsx
  useLogging.ts                 # TanStack Query hooks for /runs and /workouts
  logging.queries.ts            # query keys + invalidation map
```

> The **Habits** tab inside `LogSheet.tsx` renders an empty `<HabitsTabSlot />` placeholder export that the Habits card fills — you do NOT build habit logic.

## Foundation contracts you CONSUME (never modify)

- **Shared types/helpers:** `Run`, `Workout`, `WorkoutSet` zod schemas + inferred types; `metersToDisplay(m, units)`, `paceFor(m, s, units)`, `formatDuration(s)`, `weekBounds(date, weekStart)` from `@pacer/shared`.
- **Events you EMIT:** `run.logged` (payload `{ runId, userId, distanceMeters, durationSeconds, runDate }`) on run create; `workout.logged` (payload `{ workoutId, userId, kind, workoutDate }`) on workout create. Match the payload types defined in `packages/shared`.
- **Events you SUBSCRIBE to:** none. (Scoring/plans/groups subscribe to YOU.)
- **Realtime:** after each create/update/delete, `broadcast('user:'+userId, { type: 'run' | 'workout', id })` so the user's own open tabs refetch.
- **Append-only registry lines you add:** ONE line in `apps/api/src/routes/index.ts` registering each route module; ONE import/render line in the Progress page for `HistorySection`/`TrendsSection`; ONE line in the Log sheet registry (or the Home "+" trigger) to mount `LogSheet`. No `subscribers/index.ts` line — you have no subscriber.

## Build order (do these in this sequence)

1. **Migration** — `supabase/migrations/<ts>_logging_runs_workouts.sql`:
   - `runs`: `id uuid pk default gen_random_uuid()`, `user_id uuid not null references auth.users`, `run_date date not null`, `distance_meters int not null check (distance_meters > 0)`, `duration_seconds int not null check (duration_seconds > 0)`, `exertion_rating int check (between 1 and 10)` nullable, `warm_up bool`, `stretched bool`, `post_run_food bool`, `sleep_hours numeric` nullable, `notes text` nullable, `source text not null default 'web' check (in 'web','telegram')`, `created_at timestamptz default now()`.
   - `workouts`: `id`, `user_id`, `name text not null`, `workout_date date not null`, `kind text check (in 'strength','mobility','swim','bike','other')`, `duration_seconds int` nullable, `source`, `created_at`.
   - `workout_sets`: `id`, `workout_id uuid not null references workouts on delete cascade`, `exercise_name text not null`, `sets int`, `reps int`, `weight numeric` nullable.
   - **RLS:** enable on all three. Own-rows policy on `runs`/`workouts` (`user_id = auth.uid()` for select/insert/update/delete). `workout_sets` policy scopes via parent: `exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid())`. Group reads come later via additive `shares_group_with()` policies owned by the groups card — **do not add them here.**
   - Indexes: `(user_id, run_date desc)` on runs, `(user_id, workout_date desc)` on workouts, `(workout_id)` on workout_sets.

2. **Shared** — in `packages/shared/src/schemas/run.ts` and `workout.ts`: zod schemas validating canonical units (`distanceMeters`, `durationSeconds` as positive ints) with a `runDate`/`workoutDate` ISO date string, exertion 1–10 optional, wellness booleans, notes. `Workout` schema includes a `sets: WorkoutSet[]` array. Export inferred TS types. Add a `RunInput`/`WorkoutInput` (create payload, no id/createdAt) used by both forms and the API. No helpers beyond what 01 already provides — reuse them.

3. **API** — `apps/api/src/routes/runs.ts` and `workouts.ts` (Hono):
   - `GET /runs` (own rows, reverse-chron, optional `?from&to`), `POST /runs`, `PATCH /runs/:id`, `DELETE /runs/:id`.
   - `GET /workouts`, `POST /workouts` (creates workout + its `workout_sets` in one transaction), `DELETE /workouts/:id`.
   - **Validate every body with the shared zod schema at the boundary** (`schema.parse(body)`); 400 on failure with the zod error.
   - On `POST /runs`: insert, then `emit('run.logged', payload)` and `broadcast('user:'+userId, { type:'run', id })`. On `POST /workouts`: insert + sets, then `emit('workout.logged', payload)` and broadcast.
   - All writes use the **caller's user client** (RLS enforced) — never the service client here.
   - Add the two append-only registration lines in `routes/index.ts`.

4. **Web** — folder `apps/web/src/features/logging/`, custom controls only (no native checkboxes/selects), both form factors, themed via tokens only:
   - **`LogSheet.tsx`** — `vaul` bottom sheet on phone, centered dialog on desktop; segmented control **Run / Workout / Habits**. Habits renders the empty slot.
   - **`RunForm.tsx`** — `react-hook-form` + `@hookform/resolvers/zod` with the shared `Run` schema. Big distance + time inputs **labeled in the profile's unit** (km/mi) but converting to meters/seconds before submit; date defaults to today; custom exertion slider (1–10); wellness toggles (warm_up/stretched/post_run_food/sleep_hours) collapsed under a "details" disclosure. On save: optimistic toast showing points preview via `scoreFor(...)` from shared ("+15 pts").
   - **`WorkoutForm.tsx`** — name field with `cmdk` autocomplete sourced from the user's own prior workout names (from `GET /workouts`); a "repeat last" chip that prefills the most recent workout's name/kind/sets; kind selector; exercise rows (name/sets/reps/optional weight) with an add-row button.
   - **`HistorySection.tsx`** — Progress → History sub-tab: unified reverse-chron list of runs + workouts; each row (`ActivityRow.tsx`) shows derived display (distance in km/mi, pace, duration) via shared helpers; edit opens the relevant form, delete with confirm; swipe-to-delete on mobile.
   - **`TrendsSection.tsx`** — Progress → Trends sub-tab: summary stats (week/month/all-time km, runs, workouts, avg exertion) + a **`recharts`** weekly distance **bar** chart and a pace **line** chart, themed from tokens (stroke/fill = theme colors, never hardcoded).
   - **States:** teaching empty state ("Log your first run — tap +"); loading skeletons; error toast with retry.

## Packages (ONLY these — all from the stack)

- `zod` — schema validation boundary.
- `react-hook-form` — form state.
- `@hookform/resolvers` — zod resolver bridge.
- `vaul` — mobile bottom sheet.
- `cmdk` — workout-name autocomplete.
- `recharts` — Trends charts.
- `@tanstack/react-query` — fetch + cache + realtime invalidation.
- `date-fns` — date defaults / week math (via shared helpers).

## Acceptance criteria — the PR gate (copy this checklist into your PR description)

- [ ] Migration creates `runs`, `workouts`, `workout_sets` with own-rows RLS; user B cannot read/write user A's rows (verified).
- [ ] `workout_sets` cascade-deletes with its workout.
- [ ] `POST /runs` and `POST /workouts` validate with the shared zod schemas and 400 on bad input.
- [ ] Run create emits `run.logged`; workout create emits `workout.logged`; both `broadcast('user:<id>', …)`. App still saves with no subscribers present.
- [ ] Distance/time entered in the profile's unit; **stored as meters/seconds**; all displayed values (km/mi, pace, duration) derived via shared helpers — nothing display-valued is stored.
- [ ] Log sheet works as a vaul sheet on phone and a centered dialog on desktop; Run + Workout forms functional; Habits tab is an empty slot.
- [ ] Workout name autocompletes from the user's own history; "repeat last" prefills.
- [ ] Progress → History lists runs+workouts reverse-chron with working edit/delete (swipe on mobile); Progress → Trends shows summary stats + themed distance-bar + pace-line charts.
- [ ] No hardcoded colors/radii/fonts — theme tokens only. No native checkboxes/selects.
- [ ] `pnpm typecheck` passes; no secrets committed.

## How to verify locally

1. Run the migration (`supabase migration up`) and start api + web.
2. Sign in, tap the floating **+** → Log sheet opens. Choose **Run**, enter 5 (km, if profile=km) and 28:00, leave date as today, set exertion, save → toast "+15 pts".
3. Open **Progress → History** — the run appears with pace shown (e.g. `5:36 /km`). Edit duration, save, confirm it updates; delete it, confirm it's gone.
4. Log a **Workout** ("Strength A", strength, two exercise rows). Re-open the form — the name autocompletes and "repeat last" prefills it.
5. **Progress → Trends** — the weekly distance bar and pace line render with theme colors.
6. With dev tools open, confirm a `broadcast('user:<id>')` fires on save (network/log) and an `emit('run.logged')` is logged by the bus.
7. Resize to desktop width — the Log sheet becomes a centered dialog; History/Trends sit in the Progress layout.

## Out of scope for this card

- Habit logic of any kind (the Habits tab is an empty slot for the Habits card).
- Scoring ledger writes, streaks, plan auto-completion, group feed/broadcast — those slices **subscribe** to your events; you do not write `score_events`, touch `plan_runs`, or broadcast to `group:` channels.
- Telegram/photo ingestion and the assistant tool layer (separate cards) — though your `POST /runs` is the handler they'll wrap; keep it clean.
- Calendar and Records sub-tabs of Progress (other cards).
- Group-read RLS policies (groups card adds them additively).

## Copy-paste kickoff prompt for Claude

```
You are building ONE slice of Pacer, a greenfield fitness PWA: "MVP — Logging: runs & workouts".
Greenfield — build everything fresh against the foundation contracts. Use ONLY these packages: zod, react-hook-form,
@hookform/resolvers, vaul, cmdk, recharts, @tanstack/react-query, date-fns. Theme tokens only —
never hardcode colors/radii/fonts; custom controls only (no native checkboxes/selects).

You OWN exactly these files (touch nothing else's logic):
- supabase/migrations/<timestamp>_logging_runs_workouts.sql
- packages/shared/src/schemas/run.ts, .../workout.ts
- apps/api/src/routes/runs.ts, .../workouts.ts
- apps/web/src/features/logging/** (LogSheet, RunForm, WorkoutForm, HistorySection,
  TrendsSection, ActivityRow, useLogging, logging.queries)

CONSUME (never modify): @pacer/shared Run/Workout schemas + unit/date helpers + scoreFor;
emit() from apps/api/src/lib/events.ts; broadcast() from apps/api/src/lib/realtime.ts. Add ONE
append-only registration line per route in apps/api/src/routes/index.ts, and ONE append-only
slot line each for the Log sheet and the Progress History/Trends sections.

CANONICAL DATA: store meters & seconds only; derive km/mi, pace, durations via shared helpers.

Build in order:
1. Migration: runs, workouts, workout_sets with own-rows RLS (workout_sets via parent); indexes;
   cascade delete on sets. No group-read policies.
2. Shared: Run/Workout/WorkoutSet zod schemas + types + RunInput/WorkoutInput.
3. API: GET/POST/PATCH/DELETE /runs and GET/POST/DELETE /workouts; zod-validate every body;
   on create emit run.logged/workout.logged and broadcast('user:<id>', {type,id}); use the
   caller's user client (RLS). The app must save fine even if no slice subscribes yet.
4. Web: LogSheet (vaul sheet on phone / centered dialog on desktop) with Run/Workout/Habits
   segmented control (Habits = empty slot); RunForm (big unit-aware distance+time, today default,
   exertion slider, wellness under "details", points-preview toast via scoreFor); WorkoutForm
   (cmdk name autocomplete from own history, "repeat last" chip, exercise rows); Progress History
   (reverse-chron runs+workouts, edit/delete, swipe on mobile) and Trends (summary stats +
   recharts distance bars + pace line, themed). Teaching empty state + loading + error states.

When the acceptance criteria pass, open a PR into `dev`.
```
