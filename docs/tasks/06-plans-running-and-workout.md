# 06 — Plans: running ramp & workout template

> **Stage:** Post-MVP  ·  **Suggested order:** 6  ·  **Size:** M  ·  **One owner builds this end to end.**

**Goal (one sentence).** Let a user generate a progressive running ramp (current km → goal, over N weeks, split across runs/week) and a 7-day workout template, have logged runs auto-complete the next scheduled plan run, and surface today's slot + this-week progress on Home.

**Why it matters / where it sits in the product.** Plans turn Pacer from a passive log into a coach: the Home "Today" and "This week" cards answer *what do I do right now* and *am I on track*, and the ramp gives runners a concrete path to a goal. It is the only slice that reacts to logging by completing scheduled runs, so the daily loop (log → plan advances → Home updates) closes here.

## Depends on

- **`packages/shared` (foundation 01)** — consume the `Run` zod schema, the unit/date helpers (`metersToKm`, week-math via date-fns: `weekStart`/`weekRange`), and `POINTS`. Build against these as imports; they are merged before any Post-MVP card starts. Your own plan schemas live in your own files (below).
- **Event bus `apps/api/src/lib/events.ts` (foundation 02)** — subscribe to `run.logged`. If the logging card (Runs) is not merged yet, your plan still saves and reads fine; the auto-complete subscriber simply has no events to react to until runs exist. Build the subscriber against the documented `run.logged` payload type from `packages/shared` (the realtime event-type union), never against the logging slice's internals.
- **`broadcast()` `apps/api/src/lib/realtime.ts` (foundation 03)** — no-op safe from day one; call it after auto-completing a plan run so the user's open tabs refetch.
- **Route registry `apps/api/src/routes/index.ts` & subscriber registry `apps/api/src/subscribers/index.ts` (foundation 02/03)** — you add ONE append-only line to each. If they don't exist yet, create them with your single line; the foundation card's version is additive and will merge cleanly.
- **Web aggregate Home page (foundation 03)** — consume its append-only section-slot pattern; you add section component FILES + one import/render line each. The Profile page shell exists from foundation; you add your plan sub-pages under your own feature folder and one nav/route line.
- **API client `apps/web/src/lib/api.ts` + TanStack Query (foundation 03)** — call through it; realtime events invalidate your query keys.

## You own these files (no other card touches them)

```
supabase/migrations/20260624T1200__plans.sql        # timestamp-prefixed, yours alone
packages/shared/src/schemas/running-plan.ts
packages/shared/src/schemas/workout-plan.ts
packages/shared/src/plans/ramp.ts                    # pure ramp generator + types
apps/api/src/routes/plans.ts                         # /plans, /plans/active
apps/api/src/routes/workout-plans.ts                 # /workout-plans, /workout-plans/active
apps/api/src/subscribers/plans.ts                    # run.logged -> auto-complete
apps/web/src/features/plans/**                        # all running-plan + workout-plan UI
apps/web/src/features/plans/home-sections/TodaySlotSection.tsx
apps/web/src/features/plans/home-sections/ThisWeekSection.tsx
```

Append-only single lines you add (shared registry files — never rewrite, only append):
- `apps/api/src/routes/index.ts` — register plans + workout-plans route modules.
- `apps/api/src/subscribers/index.ts` — register `plans` subscriber.
- `apps/web/src/app/home/sections.ts` (or the foundation's Home slot index) — import + render `TodaySlotSection` and `ThisWeekSection`.
- The Profile nav/route index — link the Running-plan and Workout-plan sub-pages.

## Foundation contracts you CONSUME (never modify)

- **Schemas/helpers:** `Run` schema, `metersToKm`/`kmToMeters`, pace + week-range date helpers, `POINTS` — all from `packages/shared`.
- **Events:** SUBSCRIBE to `run.logged` (read its payload type from shared). You do NOT emit a plan-specific event in v1; scoring's `+5 plan_run` is the scoring slice's concern (it subscribes to `run.logged` itself and checks plan state via its own read). Do not write `score_events` here.
- **Realtime:** call `broadcast('user:<id>', { type: 'plan_run.completed', planRunId, planId })` after auto-completing — payload carries ids only, client refetches.
- **Registry lines:** the four append-only lines listed above.

## Build order (do these in this sequence)

1. **Migration** — `supabase/migrations/20260624T1200__plans.sql`. Create exactly:
   - `running_plans(id, user_id, current_weekly_meters int, goal_weekly_meters int, runs_per_week int default 2, start_date date, weeks int, active bool, created_at timestamptz default now())`. Partial unique index `where active` per `user_id` (one active plan per user).
   - `plan_runs(id, plan_id fk running_plans on delete cascade, scheduled_date date, target_meters int, completed_run_id uuid null references runs(id) on delete set null)`.
   - `workout_plans(id, user_id, name text, active bool, created_at)`. Partial unique index `where active` per `user_id`.
   - `workout_plan_slots(id, plan_id fk workout_plans on delete cascade, weekday int check 0..6, label text, kind text)`.
   - **RLS:** enable on all four. Own-rows only: `user_id = auth.uid()` for `running_plans`/`workout_plans`; `plan_runs`/`workout_plan_slots` gated through their parent plan's `user_id` (subquery). No group-read policy needed — plans are private. Store meters only; never store km.
2. **Shared** — `running-plan.ts` + `workout-plan.ts`: zod schemas for create payloads (current/goal **meters**, runs_per_week 1–7, weeks 2–24, weekday 0–6, label/kind enums matching slots) and row types. `plans/ramp.ts`: the **pure** ramp generator — input `{currentWeeklyMeters, goalWeeklyMeters, runsPerWeek, weeks, startDate, weekStartDay}`, output `{week, scheduledDate, targetMeters}[]`. Rules: ~10%/week progressive overload, **final week's weekly total lands exactly on `goalWeeklyMeters`**, each week's total split as evenly as possible across `runsPerWeek` scheduled dates (remainder meters distributed to earliest runs). Pure, deterministic, unit-tested by inputs/outputs only — no I/O.
3. **API** — `routes/plans.ts`: `GET /plans` (list user's plans), `POST /plans` (zod-validate body at boundary, run `ramp.ts`, insert `running_plans` + generated `plan_runs` in a tx, **deactivate any previous active plan** for the user), `GET /plans/active` (active plan + its plan_runs). `routes/workout-plans.ts`: `GET /workout-plans`, `POST /workout-plans` (insert plan + 7 slot rows, deactivate previous active), `GET /workout-plans/active`. All use the caller's user client so RLS applies. `subscribers/plans.ts`: on `run.logged`, find the user's active plan, complete the **oldest open `plan_run` (completed_run_id null) whose `scheduled_date` is in the run's week** by setting `completed_run_id`; if none open this week, do nothing. Then `broadcast('user:<id>', {type:'plan_run.completed', ...})`. Emit no new events.
4. **Web** — `apps/web/src/features/plans/**`:
   - **Running-plan create flow** (Profile → Running plan): inputs current weekly distance → goal → weeks → runs/week (units from profile preference, convert to meters on submit via shared helper). Live **preview the generated ramp** by calling `ramp.ts` client-side and rendering a **recharts** bar/line chart of weekly target km **before** saving; Save posts to `/plans`. Plan summary view with Edit.
   - **Repeat-week adaptive nudge:** if the current scheduled week has open plan_runs and the week is ending/past, show a dismissable "Behind this week? Repeat the week" action (shifts remaining schedule — re-post a plan that starts the missed week again). Keep it a nudge, not auto-behavior.
   - **Workout-plan template editor** (Profile → Workout plan): a **7-day row**; tap a day to assign a slot (custom segmented control: Strength / Run / Rest + label). Save posts the 7 slots to `/workout-plans`.
   - **Home sections via slot pattern:** `TodaySlotSection.tsx` — today's planned slot ("Run · 4 km" from active plan_runs / today's workout slot) with a check state. `ThisWeekSection.tsx` — progress **ring**, "1 run left · 4.2 km to go", scheduled-run **pills** (done/upcoming). Both fetch via TanStack Query keys that the `user:<id>` realtime event invalidates.
   - **Teaching empty state:** no plan yet → "No running plan yet — set a goal and we'll build your weekly ramp" with a Create button. Loading skeletons + error retry on every fetch. Both phone (sheets, single column) and desktop (Profile two-column form; Home sections in the left/this-week column) layouts. Theme tokens only.

## Packages (ONLY these — all from the stack)

- **zod** — boundary + payload validation.
- **date-fns** — week ranges, scheduled-date math (via shared helpers).
- **recharts** — ramp preview chart, progress ring/pills visuals.
- **@tanstack/react-query** — plan fetching + realtime invalidation.
- **@supabase/supabase-js** — user-client DB access under RLS.
- **hono** — `/plans` + `/workout-plans` route modules.

## Acceptance criteria — the PR gate (copy this checklist into your PR description)

- [ ] Migration creates all four tables with RLS enabled, own-rows policies, and a partial-unique active index per user on `running_plans` and `workout_plans`; timestamp-prefixed filename, no collision.
- [ ] `ramp.ts` is pure: 10%/week overload, **final week total === goal_weekly_meters exactly**, weekly total split across `runs_per_week` dates with remainder to earliest runs; covered by unit tests on input/output.
- [ ] `POST /plans` deactivates the previous active plan and writes plan + plan_runs in one transaction; `GET /plans/active` returns the active plan with its runs. Same active-swap behavior for `/workout-plans`.
- [ ] `subscribers/plans.ts` completes the oldest open plan_run in the run's week on `run.logged` and broadcasts to `user:<id>`; does nothing if no open run that week. No `score_events` written here.
- [ ] Create flow previews the generated ramp as a recharts chart **before** saving; units honor profile preference; meters stored canonically.
- [ ] Home shows Today slot + This-week ring/pills via the section-slot pattern (append-only Home line only); both update live after a run is logged.
- [ ] Workout-plan 7-day editor saves 7 slots; repeat-week nudge appears when behind and is dismissable.
- [ ] Teaching empty state, loading + error states present on every screen; phone + desktop layouts both designed.
- [ ] `pnpm typecheck` passes; no hardcoded colors/radii/fonts (theme tokens only); no secrets committed; only the listed packages used.

## How to verify locally

1. Run the migration; confirm the four tables and the partial-unique active indexes exist.
2. Profile → Running plan → enter current 10 km, goal 25 km, 6 weeks, 2 runs/week → the preview chart shows a 6-week ramp where week 6 totals exactly 25 km → Save. `GET /plans/active` returns 12 plan_runs (2/week × 6).
3. Log a run for today (via the Runs slice or a direct insert that emits `run.logged`) → the oldest open plan_run this week gets `completed_run_id` set → Home "This week" ring advances and a scheduled pill flips to done within a second (realtime).
4. Profile → Workout plan → assign Mon Strength A, Wed Run, Fri Strength B, others Rest → Save → Home "Today" shows the slot matching today's weekday.
5. With an open plan_run and the week over, the "Repeat the week" nudge appears and is dismissable. Resize to phone + desktop; both layouts hold.

## Out of scope for this card

- Writing `score_events` or the `+5 plan_run` point (scoring slice owns it via its own `run.logged` subscriber).
- Editing the Runs/Workouts/Habits logging forms or their tables (you only SUBSCRIBE to `run.logged`).
- Group/challenge surfaces, Progress charts, Telegram/assistant tool wiring.
- Any non-Home aggregate page section beyond Today + This-week.
- Auto-shifting the schedule on a missed week without the explicit "repeat week" tap.

## Copy-paste kickoff prompt for Claude

```
Build the Pacer "Plans" slice (running ramp + 7-day workout template) END TO END. Pacer is greenfield — build everything fresh against the foundation contracts. Use ONLY these packages: zod, date-fns, recharts, @tanstack/react-query, @supabase/supabase-js, hono. Use theme tokens only — never hardcode colors, radii, or fonts.

Files you OWN (touch nothing else except the four append-only registry lines):
- supabase/migrations/20260624T1200__plans.sql
- packages/shared/src/schemas/running-plan.ts, workout-plan.ts
- packages/shared/src/plans/ramp.ts (pure generator)
- apps/api/src/routes/plans.ts, workout-plans.ts
- apps/api/src/subscribers/plans.ts
- apps/web/src/features/plans/** (incl. home-sections/TodaySlotSection.tsx, ThisWeekSection.tsx)

CONSUME foundation contracts, never modify them: shared Run schema + unit/date helpers + POINTS; the in-process event bus (subscribe to run.logged); broadcast() to user:<id>; the route + subscriber registries (append ONE line each); the Home section-slot pattern (append import/render lines); the api.ts client + TanStack Query.

Build order:
1. Migration: running_plans, plan_runs, workout_plans, workout_plan_slots. RLS own-rows; plan_runs/slots gated via parent plan's user_id. Partial-unique active index per user. Store meters only.
2. Shared: zod create-schemas + types; ramp.ts pure generator — 10%/week overload, final week total === goal exactly, weekly total split across runs/week (remainder to earliest runs). Unit-test it.
3. API: GET/POST /plans (+ /plans/active), GET/POST /workout-plans (+ active), each POST deactivates previous active and writes children in a tx. subscribers/plans.ts: on run.logged complete the oldest open plan_run in that week, then broadcast to user:<id>. Do NOT write score_events.
4. Web: running-plan create flow with a recharts ramp PREVIEW before saving (units from profile); repeat-week nudge; 7-day workout-plan editor (custom segmented control); Home Today slot + This-week progress ring/pills via section slots. Teaching empty states, loading + error states, phone + desktop layouts.

Store meters/seconds canonically; derive all display values via shared helpers. Open a PR into `dev` when every acceptance-criteria checkbox passes.
```
