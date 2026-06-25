# 09 — Challenges — all audiences, metrics, YouTube

> **Stage:** Post-MVP  ·  **Suggested order:** 9  ·  **Size:** L  ·  **One owner builds this end to end.**

**Goal (one sentence).** Ship the full Challenges slice — create challenges for a person / a group / everyone, with any of seven metrics (including self-report check-ins) plus an embeddable YouTube video, server-computed live progress, and the Challenges tab (Active, Invitations, Upcoming/Finished) with a 3-step create flow and a challenge detail page.

**Why it matters / where it sits in the product.** Challenges are the playful competitive layer that turns solo logging into a family game ("everyone do this 10-min ab video 3×", "most km this week"). It sits on top of groups, runs/workouts/habits, and scoring — it never owns those, it only reads their data and reacts to their events. It is the last big social surface before Telegram and the assistant.

## Depends on

- **`packages/shared` (foundation 01)** — consume the unit/date helpers (`metersToDisplay`, `paceFor`, week math) and `POINTS`/`scoreFor()` if a metric preview is shown. If shared isn't merged yet, import against the documented helper signatures and the `Run`/`Workout`/`Habit` zod schemas; your code compiles the moment shared lands. You ADD the challenge schema + YouTube normalizer to shared (your own files — see "You own").
- **Event bus `apps/api/src/lib/events.ts` (foundation 02)** — you `emit('challenge.updated', …)` and you SUBSCRIBE to `run.logged` / `workout.logged` / `habit.checked` / `score.awarded` to recompute progress. Build against the `emit`/`on` signatures; if a producer slice (runs/groups/scoring) isn't merged, your subscriber simply never fires yet — your routes still work and progress can be computed on read.
- **`broadcast()` `apps/api/src/lib/realtime.ts` (foundation 03)** — call it for live progress; it is a safe no-op from day one, so it never blocks you.
- **Groups slice (audience='group')** — you read group membership **via the API only** (`GET /groups/:id` returns members). Do not query `group_members` from challenge code and do not import groups' files. If groups isn't merged yet, stub the member fetch behind one function and the 'group' fan-out fills in once `GET /groups/:id` exists; 'user' and 'everyone' audiences work without it.
- **Route registry `apps/api/src/routes/index.ts` & web section/nav slots** — append-only registration lines only (see contracts).

## You own these files (no other card touches them)

```
supabase/migrations/<ts>_challenges.sql                  # challenges + challenge_participants + challenge_check_ins + RLS
packages/shared/src/schemas/challenge.ts                 # zod schema + types
packages/shared/src/youtube.ts                           # YouTube URL normalizer (pure)
apps/api/src/routes/challenges.ts                        # all /challenges routes
apps/api/src/lib/challenge-progress.ts                   # per-metric progress computation
apps/api/src/subscribers/challenges.ts                   # reacts to run/workout/habit/score events
apps/web/src/features/challenges/**                      # tab, sections, detail, 3-step create, hooks
```

You add **append-only single lines** to these shared registries (you do not rewrite them):
`apps/api/src/routes/index.ts`, `apps/api/src/subscribers/index.ts`, the web tab/nav registry, and the relevant web section slot if a Home "active challenges" teaser exists.

## Foundation contracts you CONSUME (never modify)

- **Shared helpers/constants:** `metersToDisplay` / `paceFor` / week-math, `POINTS`, `scoreFor()`. Canonical storage is meters & seconds — `distance` targets are stored as **meters**; the create form collects km/mi per profile and converts via the shared helper before sending.
- **Events emitted:** `challenge.updated` (payload: `{ challengeId, groupId? }`).
- **Events subscribed:** `run.logged`, `workout.logged`, `habit.checked`, `score.awarded` — each handler recomputes affected participants' progress and broadcasts.
- **Realtime:** `broadcast('group:<id>', { type: 'challenge.updated', challengeId })` and `broadcast('user:<id>', …)` for the participant. Events carry ids only; the web client invalidates the challenge query keys and refetches.
- **Append-only registry lines:** one route registration in `routes/index.ts`; one subscriber import line in `subscribers/index.ts`; one nav/section line for the Challenges tab.

## Build order (do these in this sequence)

1. **Migration** (`<ts>_challenges.sql`, timestamp-prefixed so it never collides):
   - `challenges` — `id, creator_id, audience ('user'|'group'|'everyone'), group_id (nullable, FK groups), metric ('distance'|'run_count'|'reps'|'workout_count'|'habit_days'|'score'|'check_in'), target numeric, start_date date, end_date date, description text null, youtube_url text null (stored already-normalized to embeddable), created_at`.
   - `challenge_participants` — `challenge_id FK, user_id FK, status ('invited'|'accepted'|'declined'), PRIMARY KEY (challenge_id, user_id)`. Creator row inserted as `'accepted'` at creation. For `audience='group'`, insert one `'invited'` row per **current** group member at creation time. For `'everyone'`, participants are created lazily on `join`.
   - `challenge_check_ins` — `id, challenge_id FK, user_id FK, check_date date, created_at, UNIQUE (challenge_id, user_id, check_date)`. Used only when `metric='check_in'`.
   - **RLS:** creator read/write own `challenges`; participants may SELECT challenges they're a row in; `audience='group'` members SELECT via `shares_group_with(group_id)`; `audience='everyone'` is SELECT-able by any authenticated user. `challenge_participants`/`challenge_check_ins`: a user reads/writes only their **own** row, but may SELECT all participant rows of a challenge they belong to (for the leaderboard) — group reads via `shares_group_with`. No display values stored.

2. **Shared** (`packages/shared`):
   - `schemas/challenge.ts` — zod schemas: `challengeCreateSchema` (audience + conditional `group_id` / target handle, metric enum, `target`, `startDate`, `endDate`, optional `description`, optional `youtubeUrl`), `challengeRespondSchema` (`'accept'|'decline'`), `challengeCheckInSchema`; plus inferred `Challenge`, `ChallengeParticipant`, `ChallengeMetric` types. Reuse shared metric enum; do not redefine units.
   - `youtube.ts` — pure `normalizeYouTubeUrl(input): { embedUrl, videoId } | null`. Accept `youtu.be/<id>`, `watch?v=<id>`, `shorts/<id>`, and already-embed forms; strip extra params; return `https://www.youtube.com/embed/<id>`. Null on anything not parseable (the API rejects null with a 422).

3. **API** (`routes/challenges.ts`, validated with `@hono/zod-validator` at every boundary):
   - `GET /challenges` — caller's challenges bucketed by computed state: `invitations` (status invited & not started/finished), `active` (now within window & accepted), `upcoming`, `finished` (+ winner). Each row includes the caller's progress and a mini leaderboard (top participants).
   - `POST /challenges` — validate body; normalize `youtubeUrl` (reject 422 if non-null & unparseable); create challenge; insert creator as `accepted`; if `audience='group'` fan out `invited` rows to current members fetched via the groups service (API/service client) ; if `audience='user'` resolve the handle to a user_id and insert one `invited` row. Emit `challenge.updated`; broadcast to `group:<id>` (group) or each `user:<id>`.
   - `POST /challenges/:id/respond` — body `accept`/`decline`; updates the caller's participant row; emit + broadcast.
   - `POST /challenges/:id/join` — only for `audience='everyone'`; upserts the caller as `accepted`; emit + broadcast.
   - `POST /challenges/:id/check-in` — only `metric='check_in'`; insert today's row (idempotent via UNIQUE); recompute progress; emit + broadcast.
   - `lib/challenge-progress.ts` — pure-ish per-metric computation over the date window: `distance` (SUM run meters), `run_count`, `reps` (SUM workout_sets reps), `workout_count`, `habit_days` (distinct habit-check days), `score` (SUM score_events points in window), `check_in` (COUNT challenge_check_ins). Read source tables via the data layer; never store the derived number.
   - `subscribers/challenges.ts` — `on('run.logged' | 'workout.logged' | 'habit.checked' | 'score.awarded', …)` → find that user's active challenges whose metric is affected, recompute, `broadcast` `challenge.updated`. Add ONE append-only import line to `subscribers/index.ts`. Add ONE route line to `routes/index.ts`.

4. **Web** (`apps/web/src/features/challenges/**`, TanStack Query + the shared API client; custom controls only):
   - **Challenges tab** — sections **Active** (each card: title, days-left ring, your progress vs target, mini leaderboard with `@number-flow/react` values, live reorder via `motion`), **Invitations** (accept/decline cards; a **badge** on the Challenges nav icon counts pending invites), **Upcoming / Finished** (finished cards show a 🏆 winner banner with `canvas-confetti` on first view). Realtime: subscribe to channels, invalidate query keys on `challenge.updated`.
   - **Challenge detail** — description, embedded YouTube (`<iframe>` from the normalized `embedUrl`) if present, date range + **days-left ring**, full **leaderboard**, your progress vs target; for `metric='check_in'` a big **"Mark done today"** button (disabled once today is checked).
   - **3-step create flow** — step 1 **who** (segmented: a person by handle / a group / everyone; group list & handle lookup via the API), step 2 **what** (template gallery: "Most km this week", "7-day stretch streak", "Do this video 3×" — or custom: metric select, target, date range, description, YouTube URL with live embed preview using the normalizer), step 3 **confirm preview** (renders the final card exactly as it will appear).
   - **Empty / loading / error states** — teaching empty state on the tab ("Challenge your group to anything — even a YouTube workout video"), skeletons while loading, retry on error.
   - **Both form factors** — phone: bottom-tab section list, create as a `vaul` sheet, detail full-screen. Desktop: card grid (2–3 across), detail as a right-side panel with the video embedded large, create as a centered dialog. No hardcoded colors/radii/fonts — theme tokens only.

## Packages (ONLY these — all from the stack)

- **zod** — schema + validation.
- **@hono/zod-validator** — validate at API boundary.
- **@supabase/supabase-js** — DB reads/writes + RLS clients.
- **date-fns** — date-window & days-left math.
- **@tanstack/react-query** — challenge data + invalidation on realtime events.
- **react-hook-form** + **@hookform/resolvers** — 3-step create form via shared zod schema.
- **motion** — leaderboard reorder + card transitions.
- **@number-flow/react** — animated progress / leaderboard numbers.
- **vaul** — create sheet on mobile.
- **sonner** — "invitation sent" / "marked done" toasts.
- **canvas-confetti** — winner-banner celebration (finished only).
- **lucide-react** — trophy / calendar / check icons.

## Acceptance criteria — the PR gate (copy this checklist into your PR description)

- [ ] Migration creates `challenges`, `challenge_participants`, `challenge_check_ins` with RLS: own-row write, group SELECT via `shares_group_with`, `everyone` SELECT-able by authenticated users; no display values stored.
- [ ] `POST /challenges` works for all three audiences; `group` fans out `invited` rows to **current** members (fetched via groups API/service, not by importing groups' files); `user` resolves a handle; creator is `accepted`.
- [ ] All seven metrics compute correct progress server-side over the date window from canonical data; nothing derived is stored.
- [ ] YouTube normalizer handles youtu.be / watch?v= / shorts / embed forms and returns an embeddable URL; bad URLs are rejected 422 and never embedded.
- [ ] `respond` (accept/decline), `join` (everyone), and `check-in` (check_in metric, idempotent per day) all work and update progress.
- [ ] `challenge.updated` is emitted and broadcast on create/respond/join/check-in; the subscriber recomputes & broadcasts on `run.logged`/`workout.logged`/`habit.checked`/`score.awarded`; open tabs update live.
- [ ] Challenges tab shows Active (progress + mini leaderboard), Invitations (accept/decline + **nav badge** on pending), Upcoming/Finished (🏆 winner banner); detail shows embedded video, days-left ring, leaderboard, and "Mark done today" for check-ins.
- [ ] 3-step create flow (who → what+templates → confirm preview) works end to end on **phone and desktop**.
- [ ] `pnpm typecheck` passes; no hardcoded theme values (colors/radii/fonts via tokens only); no secrets; only the listed packages added.

## How to verify locally

1. Run the create flow from the Challenges tab `+`: pick **a group**, template **"Do this video 3×"**, paste `https://youtu.be/<id>` → step 2 shows a live embed preview → confirm. Expect every current group member to get an **Invitation** card and a nav badge.
2. As another member, **Accept** the invitation → it moves to **Active**; open the detail, tap **"Mark done today"** → progress ring advances 1/3; tapping again the same day is a no-op.
3. Create a **"Most km this week"** (metric `distance`) challenge, log a run from the Log sheet → the open Challenges tab's leaderboard reorders live (no refresh) and your distance rolls up via number-flow.
4. Set a challenge `end_date` in the past (seed) → it appears under **Finished** with the 🏆 winner banner and a one-time confetti burst.
5. Resize to desktop: card grid (2–3 across), detail opens as a right-side panel with the video large.

## Out of scope for this card

- Groups CRUD, membership, leaderboard, feed, reactions, or stats — **read groups via the API only**; never edit groups' files or query `group_members` directly.
- The scoring formula / `score_events` writes — you only **read** `score_events` for the `score` metric and **react** to `score.awarded`.
- Runs/workouts/habits logging, schemas, or routes — you only read their tables for progress.
- The Telegram bot and the in-app assistant's `create_challenge` tool (later cards wrap your existing routes).
- Theme tokens, nav shell, custom Toggle/Segmented/Select primitives (foundation) — you consume them.

## Copy-paste kickoff prompt for Claude

```
Build the Challenges slice for Pacer (greenfield fitness PWA — pnpm monorepo: packages/shared,
apps/api [Hono], apps/web [React 19 + Vite + Tailwind v4]). This is a fresh build; no prior
version exists.

OWN ONLY these files (disjoint from every other slice — never edit another slice's files):
  supabase/migrations/<timestamp>_challenges.sql
  packages/shared/src/schemas/challenge.ts
  packages/shared/src/youtube.ts
  apps/api/src/routes/challenges.ts
  apps/api/src/lib/challenge-progress.ts
  apps/api/src/subscribers/challenges.ts
  apps/web/src/features/challenges/**
Append-only single lines: apps/api/src/routes/index.ts, apps/api/src/subscribers/index.ts,
the web nav/section registry.

CONSUME (never modify): shared unit/date helpers + POINTS/scoreFor (store meters & seconds, derive
display); event bus emit/on; broadcast() (safe no-op); the API client + TanStack Query. Read GROUPS
DATA VIA THE API ONLY (GET /groups/:id) — do not import groups' files or query group_members.

BUILD IN ORDER:
1. Migration: challenges / challenge_participants / challenge_check_ins + RLS (own-row write;
   group SELECT via shares_group_with; 'everyone' SELECT-able by authed users). No stored display
   values; targets in meters for the distance metric.
2. Shared: zod challenge schemas + types; pure normalizeYouTubeUrl (youtu.be/watch?v=/shorts/embed
   -> https://www.youtube.com/embed/<id>, null otherwise).
3. API: GET/POST /challenges, POST /challenges/:id/respond, /join, /check-in. 'group' audience
   invites all CURRENT members at creation; creator starts accepted. Per-metric progress computed
   server-side (distance/run_count/reps/workout_count/habit_days/score/check_in) in
   lib/challenge-progress.ts — never stored. Emit 'challenge.updated' + broadcast on every write.
   subscribers/challenges.ts: on run.logged/workout.logged/habit.checked/score.awarded -> recompute
   + broadcast. Validate every body with @hono/zod-validator.
4. Web (apps/web/src/features/challenges): Challenges tab (Active w/ progress + mini leaderboard,
   Invitations accept/decline + nav badge on pending, Upcoming/Finished w/ winner banner + confetti),
   detail (description, embedded YouTube, days-left ring, leaderboard, "Mark done today" for
   check-ins), 3-step create (who -> what+template gallery -> confirm preview). Phone (vaul sheets,
   full-screen detail) AND desktop (card grid, right-side detail panel, centered create dialog).
   Teaching empty state + loading/error states. Realtime events invalidate query keys.

Packages — ONLY: zod, @hono/zod-validator, @supabase/supabase-js, date-fns, @tanstack/react-query,
react-hook-form, @hookform/resolvers, motion, @number-flow/react, vaul, sonner, canvas-confetti,
lucide-react. If you think you need anything else, STOP and flag it — do not add it.

Theme tokens only (no hardcoded colors/radii/fonts). Make `pnpm typecheck` pass. Open a PR into
`dev` when the acceptance criteria pass.
```
