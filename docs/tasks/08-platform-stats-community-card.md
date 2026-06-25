# 08 — Platform stats: anonymous community card

> **Stage:** Post-MVP  ·  **Suggested order:** 8  ·  **Size:** S  ·  **One owner builds this end to end.**

**Goal (one sentence).** Ship `GET /stats/platform` — anonymous, platform-wide aggregates plus the caller's own percentiles — and render the **Community card** on Progress → Trends ("Pacer ran 1,240 km this week" + "you're in the top 20% by distance").

**Why it matters / where it sits in the product.** Stats are a headline feature in three layers — personal, group, and platform. This is the *platform* layer: it shows every Pacer user a sense of scale and where they stand, while exposing zero names or handles. It is the lightest, most isolated stats slice: it reads existing `runs` and `score_events`, adds no tables, and slots into Progress through the append-only section slot.

## Depends on
- **`runs` table + `Run` shape** (a logging slice): you read `distance_meters`, `duration_seconds`, `run_date`, `created_at`. If the runs migration is not merged into `dev` yet, build against the shared `Run` zod schema for column names and write your SQL against the documented columns in `04-DATA-MODEL.md`; your query is read-only so it never conflicts with the runs slice's writes.
- **`score_events` ledger** (scoring slice): you read `points` + `event_date` to compute a per-user weekly-score distribution for the score percentile. If scoring isn't merged yet, the score percentile degrades gracefully — return `null` for it and the card hides that line; the distance percentile (from `runs`) still works. Build against the documented `score_events` columns.
- **Shared unit/date helpers** (foundation): `metersToKm`, pace derivation, and `startOfWeekFor(weekStart)` / week-range math. You consume these; you never store km/mi or pace.
- **Web section slot on Progress → Trends** (foundation): a registry of append-only section components. You add one component file and one render line — you never edit another section.
- **API route registry** (foundation): you add your route module and one append-only registration line.

> Nothing here blocks: the endpoint is purely read-only over two existing tables, so you can build and merge independently of the runs/scoring owners as long as those columns exist.

## You own these files (no other card touches them)
- `packages/shared/src/schemas/platform-stats.ts` — zod schema for the `/stats/platform` response (request has no body).
- `apps/api/src/routes/platform-stats.ts` — the route module (`GET /stats/platform`).
- `apps/api/src/lib/platform-stats-cache.ts` — the ~5-min in-process cache for the anonymous aggregate block.
- `apps/web/src/features/platform-stats/CommunityCard.tsx` — the Progress → Trends section component.
- `apps/web/src/features/platform-stats/usePlatformStats.ts` — the TanStack Query hook.
- `apps/web/src/features/platform-stats/CommunityCard.empty.tsx` — teaching empty state (used when the platform has no data yet / caller has no runs).

This slice **adds NO migration** (no new tables) and **subscribes to NO events**.

## Foundation contracts you CONSUME (never modify)
- **Shared types/helpers**: `Run` schema (column names), `score_events` columns, `metersToKm`, pace helper, and week-range helper. Import the response type for the route and the hook from your own `platform-stats.ts` schema so API and web agree.
- **Service-role client** `apps/api/src/lib/supabase.ts` (foundation): the privacy rule requires cross-user aggregation, so this endpoint uses the **service-role client** — never the per-request user client — and it MUST strip all identity (no `user_id`, handle, or name in the response). The caller's identity comes only from the verified JWT, used solely to compute *their* percentiles.
- **Events**: emit none, subscribe to none. This is a pure read slice.
- **Realtime**: none. Stale-by-up-to-5-min is acceptable and intended (cache).
- **API client** `apps/web/src/lib/api.ts` + TanStack Query (foundation): fetch via the shared client; cache key `['platform-stats']`.
- **Append-only registry lines you add**:
  - `apps/api/src/routes/index.ts`: one line registering the platform-stats route module.
  - the Progress → Trends section registry: one import + one `<CommunityCard />` render line in the Trends sections list.

## Build order (do these in this sequence)
1. **Migration** — NONE. This slice creates no tables and no RLS policies. The aggregate query reads `runs` and `score_events` through the **service-role client** (which bypasses RLS by design) and returns only anonymized numbers, so it does not need or add any policy. Do not add a migration file.

2. **Shared** — add `packages/shared/src/schemas/platform-stats.ts`:
   - `PlatformStatsResponse` zod schema:
     - `community`: `{ weekKm: number (derived km), runsToday: number, habitsCheckedToday: number, popularRunWeekday: number (0-6) | null, popularRunHour: number (0-23) | null, avgPaceSecondsPerKm: number | null }` — note `weekKm` is already-derived km computed via `metersToKm` in the API (the response carries display-ready numbers for this anonymous block; canonical meters never leave the server here because there is nothing further to derive client-side).
     - `you`: `{ distancePercentile: number (0-100) | null, scorePercentile: number (0-100) | null, streakPercentile: number (0-100) | null }` — each `null` when there is insufficient data or the source slice (scoring) isn't live.
     - `weekStartIso`: string (the week boundary used, for display/debug).
   - Export the inferred TS type `PlatformStats`.
   - No new helpers; reuse the shared `metersToKm`, pace, and week-range helpers.

3. **API** — `apps/api/src/routes/platform-stats.ts`, mounted as `GET /stats/platform`:
   - Auth: require a valid JWT (caller identity needed for percentiles) but run all aggregation with the **service-role client**.
   - **Anonymous community block (cached ~5 min)** via `platform-stats-cache.ts` (a simple `{ value, expiresAt }` module-level cache keyed by the current week start; recompute on expiry):
     - `weekKm`: `SUM(distance_meters)` of all `runs` in the current week → `metersToKm`.
     - `runsToday`: `COUNT(runs)` with `run_date = today`.
     - `habitsCheckedToday`: `COUNT(habit_checks)` with `check_date = today` (read-only; if `habit_checks` isn't merged yet, return `0` and leave a `// TODO depends on habits slice` — the line in the card hides at 0).
     - `popularRunWeekday` / `popularRunHour`: mode of `run_date` weekday and `created_at` hour across all runs (last ~90 days window to keep it fresh); `null` if no runs.
     - `avgPaceSecondsPerKm`: platform average pace = `SUM(duration_seconds) / SUM(distance_meters_in_km)` over the current week, via the shared pace helper; `null` if no distance.
   - **Caller percentiles (NOT cached — per user, cheap)**, computed with the service client over all users:
     - `distancePercentile`: caller's current-week total meters vs the distribution of all users' current-week meters → percentile rank (0-100). `null` if caller has no runs this week.
     - `scorePercentile`: caller's current-week `SUM(points)` vs all users' weekly sums. `null` if `score_events` empty/not live.
     - `streakPercentile`: caller's current streak (consecutive active days, computed via the shared streak helper from fetched dates) vs all users' streaks. `null` if not computable.
   - Validate the **response** against `PlatformStatsResponse` before returning (boundary safety). No request body to validate.
   - **Privacy assertion (hard requirement):** the response object contains only numbers and the week-start string. Add a tiny guard/test that no `user_id`, `handle`, `display_name`, or array of per-user rows can leak. Never join to `profiles` for output.
   - Emit no events; make no broadcast calls.
   - Add ONE append-only line to `apps/api/src/routes/index.ts` to register the module.

4. **Web** — `apps/web/src/features/platform-stats/`:
   - `usePlatformStats.ts`: `useQuery(['platform-stats'], () => api.get('/stats/platform'))`, `staleTime` ~5 min to match server cache; return typed `PlatformStats`.
   - `CommunityCard.tsx`: a card rendered in the **Progress → Trends** section list, *below* the personal charts (per UX doc). Contents:
     - Headline: "Pacer ran **{weekKm} km** this week" — the km number set in the display face via `@number-flow/react` (odometer roll), units label only ("km" — this anonymous block is platform-wide, not the caller's unit preference; show km consistently for community totals).
     - Secondary line: "**{runsToday}** runs logged today · **{habitsCheckedToday}** habits checked" (hide the habits clause if 0).
     - Your-standing line: "You're in the **top {100 - distancePercentile}%** by distance" — only render when `distancePercentile != null`. Same pattern for score and streak, each its own small pill, omitted when `null`.
     - Fun aggregate: "Most popular run day: **{weekday name}** around **{hour}:00** · platform avg pace **{pace}** vs your **{yourPace}**" — derive weekday name and pace strings via shared helpers; omit clauses whose value is `null`.
     - Strictly anonymous: NO names, handles, or avatars anywhere.
   - `CommunityCard.empty.tsx`: teaching empty state shown when `community.weekKm === 0` and all percentiles are `null` — "Pacer's community stats light up as people log runs. Log your first run to see where you stand." with the consistent illustration style.
   - Loading state: skeleton card (same height) so the Trends layout doesn't jump. Error state: a quiet inline "Couldn't load community stats — tap to retry" (refetch), never a blocking error.
   - **Both form factors**: phone — full-width card at the bottom of the Trends scroll; desktop — the Community card sits in the **right rail** of Progress (per UX doc "Community card in the right rail"). Use the responsive layout the Trends section slot provides; do not introduce new breakpoints.
   - Theme: all colors/radii/fonts from the single theme-token file. The big km number uses the display face token; coral accent for the percentile pill — no hardcoded hex.
   - Add ONE import + ONE `<CommunityCard />` render line to the Progress → Trends section registry.

## Packages (ONLY these — all from the stack)
- **zod** — response schema/type.
- **@supabase/supabase-js** — service-role aggregation queries (API).
- **date-fns** (via shared helpers) — week range + weekday names.
- **@hono/zod-validator** — only if you choose to validate the (empty) request; primary use is the response-type contract.
- **@tanstack/react-query** — `usePlatformStats` caching.
- **@number-flow/react** — odometer roll on the big km number.
- **recharts** — NOT needed here (no chart); listed as out-of-scope below to avoid scope creep.
- **lucide-react** — small icons for the standing pills (e.g. trending-up).
- **motion** — gentle fade/slide-in of the card; optional, springy not ambient.
- **Tailwind v4** — styling via theme tokens only.

## Acceptance criteria — the PR gate (copy this checklist into your PR description)
- [ ] `GET /stats/platform` returns the `PlatformStatsResponse` shape; validated against the zod schema before sending.
- [ ] Aggregates run on the **service-role client**; the response contains zero identity fields (no `user_id`/handle/name/per-user rows) — verified by a guard/test.
- [ ] Caller percentiles use the verified JWT identity ONLY to compute the caller's own rank; degrade to `null` (and the UI hides that line) when a source is missing.
- [ ] Anonymous community block is cached ~5 min (keyed on week start); percentiles are computed fresh per request.
- [ ] Community card renders below the personal Trends charts on **phone** and in the **right rail** on **desktop**; loading skeleton + quiet retry error; teaching empty state when there's no data.
- [ ] Canonical-units rule honored: server derives km/pace via shared helpers; no display values stored/invented; no client-side re-derivation of the anonymous block.
- [ ] Greenfield: built fresh against the foundation contracts. No tables added, no migration file, no events emitted/subscribed.
- [ ] Only the packages above (all from the stack) are used.
- [ ] No hardcoded colors/radii/fonts — theme tokens only. No secrets in client code (service-role key stays server-side).
- [ ] `pnpm typecheck` passes; only the files in "You own these files" + the two append-only registry lines are changed.

## How to verify locally
1. `pnpm dev` (api on 8799, web on 5199). Seed a few runs across users (or use the dev seed) so the platform has data.
2. Sign in, open **Progress → Trends**, scroll past the personal charts → the **Community card** shows "Pacer ran N km this week" with the number rolling up.
3. Log a run for the signed-in user, wait for the 5-min cache to expire (or restart the API to clear cache) → community km increases; your distance percentile line appears/updates.
4. `curl -H "Authorization: Bearer <jwt>" localhost:8799/stats/platform` → JSON with `community`, `you`, `weekStartIso` and **no** user_id/handle/name anywhere.
5. Resize to desktop width → the card moves to the right rail; resize to phone → it returns to the bottom of the Trends scroll.
6. Sign in as a brand-new user with no runs → the teaching empty state shows instead of the populated card.

## Out of scope for this card
- Any new table, column, or RLS policy (this slice adds none).
- Group stats / leaderboard / you-vs-group / head-to-head — that is the groups slice's `GET /groups/:id/stats`.
- Personal Trends charts (distance bars, pace line, score line) and summary stats — those belong to the personal-stats slice; you only add the Community section beneath them.
- Returning any per-user data, names, handles, or avatars — forbidden by the privacy rule.
- Realtime/live updating of the card — intentionally cached; no broadcast wiring.
- Telegram weekly-recap percentiles — a separate consumer; do not build bot output here.

## Copy-paste kickoff prompt for Claude
```
Build the Pacer slice "Platform stats — anonymous community card" end to end. Greenfield project;
build everything fresh against the foundation contracts in this repo.

OWN ONLY these files (do not touch any others except the two append-only registry lines named below):
- packages/shared/src/schemas/platform-stats.ts
- apps/api/src/routes/platform-stats.ts
- apps/api/src/lib/platform-stats-cache.ts
- apps/web/src/features/platform-stats/CommunityCard.tsx
- apps/web/src/features/platform-stats/CommunityCard.empty.tsx
- apps/web/src/features/platform-stats/usePlatformStats.ts

CONSUME these foundation contracts (never modify them): the shared Run schema + unit/date/streak
helpers (metersToKm, pace, week-range, streak), the service-role Supabase client at
apps/api/src/lib/supabase.ts, the API route registry apps/api/src/routes/index.ts, the API client at
apps/web/src/lib/api.ts with TanStack Query, and the Progress -> Trends append-only section slot.

BUILD ORDER:
1. NO migration — this slice adds no tables, columns, or RLS.
2. shared: zod PlatformStatsResponse { community {weekKm, runsToday, habitsCheckedToday,
   popularRunWeekday, popularRunHour, avgPaceSecondsPerKm}, you {distancePercentile, scorePercentile,
   streakPercentile}, weekStartIso } + inferred type.
3. API GET /stats/platform: require JWT for identity, but aggregate with the SERVICE-ROLE client.
   Anonymous community block cached ~5 min (keyed on week start). Caller percentiles computed fresh.
   Validate the response against the schema. The response must contain ONLY numbers + week string —
   NEVER any user_id/handle/name/per-user rows (privacy rule). Add ONE registration line to routes/index.ts.
4. web: usePlatformStats (useQuery ['platform-stats'], staleTime ~5m) + CommunityCard rendered BELOW
   the personal Trends charts (right rail on desktop, bottom of scroll on phone). Big km number via
   @number-flow/react. Show "top X% by distance/score/streak" pills only when the percentile is non-null.
   Loading skeleton + quiet retry error + teaching empty state. Add ONE import + ONE <CommunityCard/>
   render line to the Trends section registry.

RULES: store meters/seconds, derive km/pace via shared helpers only — never store/invent display values.
Theme tokens only (no hardcoded colors/radii/fonts). Use ONLY these packages: zod, @supabase/supabase-js,
date-fns, @hono/zod-validator, @tanstack/react-query, @number-flow/react, lucide-react, motion, Tailwind v4.
Service-role key stays server-side. Ship both phone and desktop layouts.

When `pnpm typecheck` passes and the acceptance criteria are met, open a PR into `dev`.
```
