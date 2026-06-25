# 05 — MVP: Habits, scoring, records & calendar

> **Stage:** MVP  ·  **Suggested order:** 5  ·  **Size:** L  ·  **One owner builds this end to end.**

**Goal (one sentence).** Ship the daily habit ritual and the scoring engine that turns every logged run/workout/habit into transparent, idempotent points — plus the Progress Records and Calendar sub-tabs — so the `<=10s` daily check-in works and weekly competition feels right.

**Why it matters / where it sits in the product.** Habits are the low-friction daily layer that keeps non-runners engaged, and the score is the competitive glue every other surface (group leaderboard, Telegram recap, challenges) reads. This slice owns the `score_events` ledger and the `scoring` subscriber — the single place points are written — so it is a load-bearing dependency for the whole product.

## Depends on

- **Foundation `packages/shared` (cards 01-03).** Build against the shared unit/date helpers (m/s -> km/mi/pace, week math via `date-fns`), the `scoreFor()` function, and the `POINTS` constants — all already live in shared per the foundation contract. You only ADD the `habit` zod schema here. If a helper name differs at merge time, you import the real one; you never redefine scoring math locally.
- **Foundation event bus `apps/api/src/lib/events.ts` (card 02).** Subscribe to `run.logged`, `workout.logged`, `habit.checked`; emit `score.awarded`. If the runs/workouts slices are not merged yet, your habit toggle still writes a `habit_checked` row and your subscriber still fires on `habit.checked` — runs/workouts simply emit nothing until they land. No blocking.
- **Foundation `broadcast()` `apps/api/src/lib/realtime.ts` (card 03).** Safe no-op from day one; call it with `user:<id>` after a check/score write so an open tab refreshes. Works before Realtime is wired.
- **Foundation route registry & web section slots (cards 01-03).** You append ONE line each to `apps/api/src/routes/index.ts`, `apps/api/src/subscribers/index.ts`, and the Home/Log/Progress section-slot files. Build your route module and section components standalone; the append-only line is the only shared touch.
- **Shared `Run`/`Workout` schemas + `run.logged`/`workout.logged` payload types (card 04).** Your subscriber reads these payloads to score runs/workouts. Build against the shared payload types; if those slices are unmerged, the subscriber compiles and simply receives no such events yet.

## You own these files (no other card touches them)

- `supabase/migrations/<ts>_habits_score_events.sql` — habits, habit_checks, score_events (timestamp-prefixed).
- `supabase/migrations/<ts>_seed_default_habits.sql` — NEW migration extending the signup trigger to seed Stretching + Nutrition (does NOT edit the foundation auth-trigger migration).
- `packages/shared/src/schemas/habit.ts` — `habit` zod schema + inferred types.
- `apps/api/src/routes/habits.ts` — `/habits` CRUD + `/habits/:id/check`.
- `apps/api/src/routes/score.ts` — `/score/summary`.
- `apps/api/src/subscribers/scoring.ts` — the scoring subscriber (the ONLY writer of `score_events`).
- `apps/web/src/features/habits/**` — habit toggles, 7-day fix-up grid, Today-card habit block, Log-sheet Habits slot component.
- `apps/web/src/features/scoring/**` — score + streak header chips, "+N pts" toast helper, "how scoring works" explainer sheet.
- `apps/web/src/features/progress/RecordsTab.tsx` and `apps/web/src/features/progress/CalendarTab.tsx` — Records & Calendar sub-tabs (these two files only; the Progress shell/segmented control belongs to another card).

## Foundation contracts you CONSUME (never modify)

- **Shared:** `scoreFor()`, `POINTS`, unit/date helpers, week-math helper, `Run`/`Workout`/`HabitCheck` payload types. You ADD `habit.ts` only.
- **Events emitted:** `score.awarded` (after writing a ledger row). **Events subscribed:** `run.logged`, `workout.logged`, `habit.checked`.
- **Realtime:** `broadcast('user:<id>', { type, ids })` after a check or score write; group broadcast is the groups slice's job — you only broadcast on the user channel.
- **Append-only registry lines:** add `habits` and `score` route modules to `routes/index.ts`; add `import './scoring'` to `subscribers/index.ts`; add the Today habit block to the Home section slot, the Habits slot to the Log sheet, and Records/Calendar to the Progress sub-tab slot.

## Build order (do these in this sequence)

1. **Migration.**
   - `habits`: `id`, `user_id` (FK auth.users), `name`, `emoji`, `sort` (int), `archived_at` (nullable), `created_at`. RLS: own-rows only (select/insert/update where `user_id = auth.uid()`).
   - `habit_checks`: `id`, `user_id`, `habit_id` (FK habits), `check_date` (date), `created_at`. **`UNIQUE (habit_id, check_date)`**; a row = done, absence = not done. RLS own-rows; group reads via the additive `shares_group_with(user_id)` SELECT policy so the group feed can see "completed all habits today". The trailing-7-day edit limit is enforced in the API, NOT the DB.
   - `score_events`: `id`, `user_id`, `points` (int), `reason` (`'run'|'workout'|'habit'|'habit_day_bonus'|'plan_run'|'streak'`), `source_type`, `source_id`, `event_date` (date), `created_at`. Append-only. **Idempotency:** UNIQUE partial/index on `(reason, source_type, source_id)` so re-emitting the same event is a no-op. RLS own-rows + `shares_group_with` SELECT for leaderboards. On run/workout delete, its events are removed (FK `ON DELETE CASCADE` against source rows is owned by those slices; here add a defensive cleanup only for habit-sourced events you own).
   - Second migration: extend the signup trigger to also `INSERT` two `habits` rows (Stretching 🧘, Nutrition 🥗, sort 0/1) for the new user. New file, append-only, never touches the foundation trigger migration.
2. **Shared.** `packages/shared/src/schemas/habit.ts`: `habitSchema` (name 1-40 chars, emoji optional, sort int), `habitCheckSchema` (habit_id uuid, check_date ISO date), plus inferred `Habit`/`HabitCheck` types. Import `scoreFor`/`POINTS`/week-math from existing shared files — do not redefine. Streak is computed by the existing shared streak helper from a list of active dates; if it is not yet present in shared, add a pure `streakFromDates(dates: string[]): number` to shared's date helpers file (consensus utility, append-only).
3. **API.**
   - `routes/habits.ts`: `GET /habits` (own, non-archived), `POST /habits` (validate with `habitSchema`), `DELETE /habits/:id` (soft-delete: set `archived_at`), `PUT /habits/:id/check?date=` (upsert a `habit_checks` row; reject dates older than 7 days or in the future with 422), `DELETE /habits/:id/check?date=` (remove the row). Validate body/query with `@hono/zod-validator`. On a successful check, `emit('habit.checked', { userId, habitId, date })` and `broadcast('user:<id>', { type: 'habit', date })`.
   - `routes/score.ts`: `GET /score/summary` → `{ weekly, lifetime, streak }`. Weekly = `SUM(points) WHERE event_date in current week` (week-start from profile via shared week math); lifetime = `SUM(points)`; streak from the shared streak helper over fetched active dates. No stored aggregates.
   - `subscribers/scoring.ts`: `on('run.logged' | 'workout.logged' | 'habit.checked', ...)`. For each, compute points with shared `scoreFor()`, insert a `score_events` row idempotently (rely on the UNIQUE index — ignore conflicts). Habit checks: write a `habit` event (3 pts) and, when that check completes ALL of the user's active habits for that date, write a `habit_day_bonus` event (+2). After writing, `emit('score.awarded', { userId, points, reason, date })` and `broadcast('user:<id>', { type: 'score' })`. The +10 streak event (when a 7-day-multiple streak is hit) is written here too, idempotent per `(streak, user, date)`. This subscriber is the ONLY writer of `score_events`.
4. **Web.**
   - **Today-card habit block + Log-sheet Habits slot:** custom toggle component (NO native checkbox) per habit, optimistic via TanStack Query mutation hitting `PUT /habits/:id/check`; on success fire the "+N pts" sonner toast. A 7-day mini-grid (today + trailing 6 days) of tappable cells to fix missed days — same component reused in both slots. Loading skeleton; error toast with retry; teaching empty state if a user archived all habits ("Add a habit to start your daily streak").
   - **Header chips:** weekly score + streak flame chips reading `GET /score/summary`; numbers animate with `@number-flow/react` (odometer). Tapping the score opens the **"how scoring works"** explainer sheet (`vaul`) listing the POINTS table sourced from shared `POINTS`. Realtime `score.awarded` / `user:` events invalidate the `score-summary` query key.
   - **Records sub-tab (`RecordsTab.tsx`):** PR cards — fastest pace, longest run, biggest week, longest streak — each with the date achieved, values derived via shared helpers from fetched runs/score data. Teaching empty state: "Your first run sets your first record."
   - **Calendar sub-tab (`CalendarTab.tsx`):** month grid with colored dots per day (run / workout / all-habits-done), tap-a-day opens a bottom sheet (`vaul`) listing that day's entries. Dots use theme tokens (run = coral, workout = green, all-habits = amber per the theme file). Teaching empty state: "Days light up when you log."
   - Both phone (sheets, stacked) and desktop (Calendar + Records in the Progress grid, side-by-side) layouts. All colors/radii/fonts from the single theme-token file — no hardcoded values.

## Packages (ONLY these — all from the stack)

- **zod** — schema at boundary.
- **date-fns** — week/date math.
- **@tanstack/react-query** — server state + optimistic.
- **@hono/zod-validator** — route-boundary validation.
- **Hono** — API routes.
- **@supabase/supabase-js** — DB + realtime.
- **sonner** — "+N pts" toasts.
- **@number-flow/react** — odometer score chips.
- **vaul** — explainer + day sheets.
- **motion** — chip/grid spring motion.
- **lucide-react** — flame/check icons.
- **Tailwind v4** — token styling.
- **shadcn/ui** — Dialog/Popover primitives only.

## Acceptance criteria — the PR gate (copy this checklist into your PR description)

- [ ] New signup auto-seeds Stretching + Nutrition habits (via the new trigger migration, foundation trigger untouched).
- [ ] `PUT /habits/:id/check?date=` toggles a day; `habit_checks` has UNIQUE `(habit_id, check_date)`; dates older than 7 days or in the future are rejected (422).
- [ ] `subscribers/scoring.ts` is the only writer of `score_events`; events are idempotent (re-emitting the same run/workout/habit writes no duplicate row).
- [ ] Points match the table: run 10+1/km, workout 10, habit 3/day, all-habits +2, streak +10; computed via shared `scoreFor()`/`POINTS` (no local math).
- [ ] `GET /score/summary` returns weekly (current-week SUM) + lifetime + streak; week start respects the profile setting.
- [ ] Today card + Log sheet habit toggles work optimistically with a "+N pts" toast; 7-day fix-up grid edits past days.
- [ ] Score/streak header chips animate via number-flow; tapping score opens the "how scoring works" sheet.
- [ ] Records sub-tab shows the 4 PR cards with dates; Calendar sub-tab shows month dots + tap-a-day sheet.
- [ ] Both phone and desktop layouts render correctly.
- [ ] Group members can read each other's `habit_checks`/`score_events` via `shares_group_with` (RLS verified); non-members cannot.
- [ ] `pnpm typecheck` passes; no hardcoded theme values (colors/radii/fonts all from the theme-token file); no secrets committed.

## How to verify locally

1. Run migrations; sign up a fresh user → Profile/Home shows Stretching + Nutrition habits pre-seeded.
2. Home → tap both habit toggles → "+8 pts" toast (3 + 3 + 2 all-habits bonus); score chip odometer rolls up.
3. Open the 7-day grid in the Log sheet → tap a cell two days back → it fills; toggle it off → it clears; try a date 8 days back → blocked.
4. Hit `GET /score/summary` → weekly reflects today's checks, streak = 1.
5. Log a run (if that slice is merged) → a `run` score_event appears once; re-emit the event → no duplicate.
6. Progress → Records: PR cards populate after a run/streak; Calendar: today's day shows the all-habits dot, tapping it opens the day sheet.
7. Tap the score chip → "how scoring works" sheet lists the exact points table.

## Out of scope for this card

- Runs/workouts logging UI, forms, or routes (cards 04/06) — you only SUBSCRIBE to their events.
- The Progress page shell, segmented sub-tab control, Trends and History sub-tabs (other cards) — you own only `RecordsTab.tsx` and `CalendarTab.tsx`.
- Group leaderboard, feed, reactions, `shares_group_with` helper definition, and group-channel broadcasts (groups slice) — you only broadcast on `user:<id>`.
- Plan-run `+5` scoring (the plans slice emits/handles its own plan-run completion) — your subscriber only handles run/workout/habit/streak reasons.
- Telegram bot habit check-ins and the in-app assistant — separate slices reuse `/habits` and `/score` unchanged.

## Copy-paste kickoff prompt for Claude

```
You are building ONE slice of Pacer, a greenfield fitness PWA (pnpm monorepo: packages/shared raw TS, apps/api Hono, apps/web React 19 + Vite). Greenfield — build everything fresh against the foundation contracts. Use ONLY these packages: zod, date-fns, @tanstack/react-query, @hono/zod-validator, Hono, @supabase/supabase-js, sonner, @number-flow/react, vaul, motion, lucide-react, Tailwind v4, shadcn/ui (Dialog/Popover only). If you think you need anything else, STOP and add a "NEEDS TEAM DECISION" note instead.

SLICE: Habits, scoring, records & calendar.

YOU OWN (touch nothing else):
- supabase/migrations/<ts>_habits_score_events.sql
- supabase/migrations/<ts>_seed_default_habits.sql  (NEW trigger-extension migration; do NOT edit the foundation auth-trigger migration)
- packages/shared/src/schemas/habit.ts
- apps/api/src/routes/habits.ts, apps/api/src/routes/score.ts
- apps/api/src/subscribers/scoring.ts
- apps/web/src/features/habits/**, apps/web/src/features/scoring/**
- apps/web/src/features/progress/RecordsTab.tsx, apps/web/src/features/progress/CalendarTab.tsx

CONSUME foundation (never redefine): shared scoreFor()/POINTS, unit + week-math helpers, Run/Workout/HabitCheck payload types; event bus emit/on; broadcast(); route registry; web section slots. Add ONLY append-only lines: habits+score to routes/index.ts, `import './scoring'` to subscribers/index.ts, the Today habit block / Log Habits slot / Progress Records+Calendar tabs to their section-slot files.

CANONICAL DATA: store meters + seconds; derive every display value (km/mi, pace) via shared helpers. THEME: never hardcode colors/radii/fonts — use the single theme-token file. No native checkboxes/selects — custom toggle components.

BUILD ORDER:
1. Migrations: habits; habit_checks (UNIQUE habit_id+check_date, trailing-7-day edit enforced in API not DB); score_events (append-only, idempotent UNIQUE on reason+source_type+source_id). RLS own-rows + shares_group_with SELECT for habit_checks/score_events. Second migration seeds Stretching + Nutrition at signup.
2. Shared: habitSchema + types; reuse scoreFor/POINTS/week-math; add streakFromDates only if absent.
3. API: /habits CRUD + PUT/DELETE /habits/:id/check (validate, enforce 7-day window, emit habit.checked, broadcast user:<id>); /score/summary (weekly SUM current week + lifetime + streak). subscribers/scoring.ts: on run.logged/workout.logged/habit.checked write idempotent score_events via scoreFor(), all-habits +2 bonus, +10 streak on 7-day multiples, emit score.awarded, broadcast user:<id>. This is the ONLY writer of score_events.
4. Web: custom habit toggles + 7-day fix-up grid (Today card + Log slot), +N pts sonner toasts; score/streak header chips with number-flow odometer; "how scoring works" vaul sheet from POINTS; Records sub-tab (4 PR cards) and Calendar sub-tab (month dots + tap-a-day vaul sheet). Phone + desktop layouts, teaching empty states, loading/error states.

Open a PR into `dev` when every acceptance-criteria checkbox passes (typecheck clean, no hardcoded theme values, no secrets).
```
