# 07 — Groups, leaderboard, feed & realtime (retention feature)

> **Stage:** Post-MVP  ·  **Suggested order:** 7  ·  **Size:** L  ·  **One owner builds this end to end.**

**Goal (one sentence).**
Build the private-group social surface — create/join groups, a live weekly leaderboard, an activity feed with reactions, you-vs-group stats, member drill-downs, owner moderation — and the realtime layer that makes the leaderboard reorder and feed items slide in within a second of any member logging.

**Why it matters / where it sits in the product.**
Groups are Pacer's retention engine: logging is the hero action, but *competing with your family* is why people come back daily. This slice turns solitary tracking into a social loop, and it owns the realtime plumbing (`broadcast()` + web subscriptions) that the whole app's "live by default" promise rides on.

## Depends on
- **`packages/shared` (foundation 01).** Consume the `Group`/`GroupMember`/`Reaction` zod schemas *that you author here*, plus the foundation unit helpers (`metersToDisplay`, `paceFor`, week math) and `scoreFor()`/`POINTS`. If shared isn't fully merged, build against the schema files you add in this card and import helpers by their documented signatures.
- **Event bus `apps/api/src/lib/events.ts` (foundation 02).** You SUBSCRIBE to `run.logged`, `workout.logged`, `habit.checked`, `reaction.added`, `score.awarded`. You EMIT `reaction.added`. If a producing slice (runs/scoring/habits) isn't merged yet, your subscriber simply never fires — groups still create, join, and render. Build against the documented payload types; do not block.
- **`broadcast(channel, event)` `apps/api/src/lib/realtime.ts` (foundation 03).** Safe no-op from day one, so calling it before Supabase Realtime is wired up is harmless.
- **Route registry / web shells (foundation 01–03).** Add one append-only registration line each; never edit another slice's section.
- **`shares_group_with(other_user)` SECURITY DEFINER helper (foundation 02, `0001_foundation.sql`).** This helper is DEFINED ONCE by card 02 and forward-references `group_members`; you CONSUME it here. Your migration creates the `group_members` table that the helper resolves against — but it must NOT re-declare `shares_group_with()`. Your additive RLS policies call that foundation helper.
- **Score data.** The leaderboard reads `score_events` (owned by the scoring slice). Read it via the service client in `/groups/:id/stats`; if scoring hasn't merged, the leaderboard renders with zeros — wire the SUM query against the documented `score_events` columns now.

## You own these files (no other card touches them)
- `supabase/migrations/<TIMESTAMP>_groups_members_reactions.sql` (timestamp-prefixed, e.g. `20260624T1200_…`)
- `packages/shared/src/schemas/group.ts`
- `packages/shared/src/schemas/reaction.ts`
- `packages/shared/src/lib/join-code.ts` (pure 6-char generator + alphabet)
- `apps/api/src/routes/groups.ts`
- `apps/api/src/routes/reactions.ts`
- `apps/api/src/lib/group-stats.ts` (server-side leaderboard/totals/head-to-head computation)
- `apps/api/src/subscribers/groups.ts`
- `apps/web/src/features/groups/**` (Group tab page, switcher, leaderboard, you-vs-group, feed, members + drill-down, invite sheet, empty state, owner actions, hooks)
- `apps/web/src/features/groups/HomeGroupPulseSection.tsx` (the Home top-3 pulse-strip section component)

**Append-only lines you add (shared registry files — one line each, never rewrite):**
- `apps/api/src/routes/index.ts` — register `groups` + `reactions` route modules.
- `apps/api/src/subscribers/index.ts` — register `subscribers/groups.ts`.
- `apps/web/src/app/Home.tsx` (or the Home slot file) — one import + render line for `HomeGroupPulseSection`.

## Foundation contracts you CONSUME (never modify)
- **Shared types/helpers:** unit helpers (m/s → km/mi/pace), week math (date-fns), `scoreFor()`/`POINTS`, `Run`/`Workout`/`HabitCheck` domain types (read-only, for feed item shaping), the realtime event-type union + payload types.
- **Events emitted:** `reaction.added` (payload: `{ reactionId, userId, targetType, targetId, emoji }`).
- **Events subscribed:** `run.logged`, `workout.logged`, `habit.checked`, `reaction.added`, `score.awarded` → resolve affected group(s) and `broadcast('group:<id>', { type, ids })`; also `broadcast('user:<id>', …)` so the actor's own tabs refresh.
- **Realtime helper:** `broadcast(channel, event)` only — never write a websocket directly.
- **Registries:** the three append-only lines above. **API client:** `apps/web/src/lib/api.ts` + TanStack Query; realtime events invalidate query keys, never patch cache by hand.

## Build order (do these in this sequence)
1. **Migration** — three tables, all RLS ADDITIVE (never weaken another table's policy):
   - `groups (id, name, join_code text UNIQUE, owner_id, created_at)` — `join_code` is exactly 6 chars from the no-`O/0/I/1/L` alphabet.
   - `group_members (group_id, user_id, joined_at)` — PK `(group_id, user_id)`; multiple groups per user.
   - `reactions (id, user_id, target_type ('run'|'workout'|'habit_day'), target_id, emoji, created_at)` with `UNIQUE (user_id, target_type, target_id, emoji)`.
   - Do NOT declare `shares_group_with()` — it already exists from card 02's `0001_foundation.sql` (SECURITY DEFINER, forward-references `group_members`). Creating the `group_members` table here is what resolves that helper; your policies just call it.
   - **RLS intent:** `groups` SELECT for members (`shares_group_with` via owner OR own membership); INSERT any authed user (becomes owner); UPDATE/DELETE owner-only; `group_members` SELECT for co-members, INSERT self-join + owner-add, DELETE self-leave + owner-remove; `reactions` SELECT/INSERT/DELETE gated by `shares_group_with(target owner)`. Heavy aggregation uses the service client server-side.
2. **Shared** — `schemas/group.ts` (`Group`, `GroupMember`, `CreateGroupInput`, `JoinGroupInput`, `RenameGroupInput`), `schemas/reaction.ts` (`Reaction`, `AddReactionInput` with the 3-emoji enum 👏🔥💪 and target-type enum), `lib/join-code.ts` (`JOIN_CODE_ALPHABET` + `generateJoinCode()` pure fn, no I/O). Derive every km/pace value via the foundation helpers; store nothing display.
3. **API** —
   - `routes/groups.ts`: `POST /groups` (create + owner membership, generate unique code), `POST /groups/join` (by code), `GET /groups/:id` (members only), `PATCH /groups/:id` (rename / regenerate-code, owner), `DELETE /groups/:id/members/:userId` (owner), `GET /groups/:id/feed` (recent member runs/workouts/habit-days + their reactions), `GET /groups/:id/stats` (leaderboard score/km/runs, group totals week/month, most-active-day, group habit rate, per-member summaries, you-vs-average deltas, head-to-head 4-week vs one member) — stats computed in `lib/group-stats.ts` with the **service client**, returned **only to members** (membership check first).
   - `routes/reactions.ts`: `POST /reactions` (insert, RLS-gated by `shares_group_with`), `DELETE /reactions` (own row). On insert, EMIT `reaction.added`.
   - Validate every request body/params with the shared zod schemas at the boundary.
   - `subscribers/groups.ts`: subscribe to the five events; for each, look up the actor's group(s) (service client) and `broadcast('group:<id>', { type: 'leaderboard'|'feed'|'reaction', ids })` + `broadcast('user:<id>', …)`.
4. **Web** — `features/groups/`:
   - **Group tab page** with group **switcher** (avatar-stack pills when >1 group; hidden for one).
   - **Leaderboard card**: ranked rows, **rank-movement arrows (↑2)**, current-user row highlighted, score/km/runs **segmented toggle** (custom control). On realtime invalidate, rows reorder with a **motion spring** (`motion` layout animation), not a hard re-render.
   - **You-vs-group card**: your week vs group average (km, score, habit rate) + group totals ("the family ran 47 km this week").
   - **Feed**: member activities + habit milestones, each with reaction buttons (👏🔥💪); new items **slide in live**.
   - **Members list** + per-member **drill-down** (week/month stats, streak, recent activity, head-to-head). Owner sees **rename / regenerate-code / remove-member** actions.
   - **Invite** header button → share sheet with the join code (copy button).
   - **"Challenge this group"** shortcut → navigate to challenge-create pre-filled with this group as audience (link only; do not build the challenge flow).
   - **Teaching empty state** (no group): friendly illustration + "enter code / create group" — the feature explains itself.
   - **`HomeGroupPulseSection.tsx`**: top-3 leaderboard strip, taps through to Group tab.
   - Web realtime hook: subscribe to `group:<id>` + `user:<id>`, map events → `queryClient.invalidateQueries` keys (`['group', id, 'stats']`, `['group', id, 'feed']`, `['score','summary']`). Both **phone** (bottom-tab page, sheets) and **desktop** (leaderboard+you-vs-group left, feed right, members table below) layouts. Loading skeletons + error states throughout.

## Packages (ONLY these — all from the stack)
- `zod` — boundary validation.
- `@supabase/supabase-js` — DB + Realtime client.
- `@tanstack/react-query` — fetch + invalidate-on-event.
- `react` / `react-dom` — UI.
- `react-router` — Group tab + drill-down routes.
- `motion` — leaderboard reorder spring, feed slide-in.
- `date-fns` — week boundaries for stats.
- `hono` — route modules.

## Acceptance criteria — the PR gate (copy this checklist into your PR description)
- [ ] Create a group → 6-char code from the restricted alphabet (no O/0/I/1/L); a second user joins by code; one user can belong to multiple groups.
- [ ] `/groups/:id`, `/feed`, `/stats` return data **only to members** (non-member gets 403/empty); leaderboard supports score/km/runs toggles, group totals, you-vs-average, per-member summaries, head-to-head.
- [ ] RLS is **additive**: a member can read co-members and react via `shares_group_with`; a stranger can read/react to neither. `shares_group_with` is `SECURITY DEFINER` (no recursion).
- [ ] Reactions add/remove via `POST/DELETE /reactions`, gated by `shares_group_with`; `reaction.added` is emitted.
- [ ] Realtime works end to end: with two tabs open, one logs a run → the other's leaderboard reorders (spring) and feed item slides in within ~1s, with no manual refresh; Home pulse strip + score chip refresh on `user:<id>`.
- [ ] Owner can rename, regenerate code, remove a member; non-owners cannot.
- [ ] Both phone and desktop layouts ship; teaching empty state present; loading + error states present.
- [ ] All distances/paces derived via shared helpers — nothing display-valued stored.
- [ ] Typecheck passes; **no hardcoded colors/radii/fonts** (theme tokens only); **no secrets** (service client server-side only, never in the browser bundle).

## How to verify locally
1. Run migration; confirm `groups`, `group_members`, `reactions`, and `shares_group_with()` exist.
2. Sign in as user A → Group tab → empty state → **Create group** "Family". Copy the 6-char code.
3. Sign in as user B (second browser/profile) → onboarding/Group → **Join** with the code. Both now see each other in Members.
4. Open A and B side by side. As A, log a run (runs slice). On B, watch the **leaderboard reorder** and a **feed item slide in** within ~1s; tap 🔥 on it → A sees the reaction count rise live.
5. Open `/groups/:id/stats` response: confirm leaderboard, group totals, you-vs-average, head-to-head are present and member-gated (non-member request returns no data).
6. As owner A: rename the group, regenerate the code, remove B — confirm B loses access. Check phone + desktop layouts both render correctly.

## Out of scope for this card
- Challenges (audience/metrics/leaderboard/templates) — you only render the "Challenge this group" link.
- Scoring rules / `score_events` writes — you only READ score data.
- Run/workout/habit logging UIs and their migrations.
- Platform stats (`/stats/platform`) and percentiles.
- Telegram bot and the in-app Assistant.
- The `broadcast()` Supabase wiring internals and the event-bus implementation (foundation cards).
- Chat/comments inside groups — reactions only (per product scope).

## Copy-paste kickoff prompt for Claude
```
You are building ONE slice of Pacer, a greenfield fitness PWA (runs, workouts, habits,
weekly score, private groups, challenges, Telegram bot, assistant). Build everything
fresh; the only things to build against are the foundation contracts in this repo.

SLICE: Groups, leaderboard, feed & realtime (card 07, Post-MVP, size L).

You OWN exactly these files (touch nothing else except the append-only registry lines):
- supabase/migrations/<TIMESTAMP>_groups_members_reactions.sql
- packages/shared/src/schemas/group.ts, packages/shared/src/schemas/reaction.ts,
  packages/shared/src/lib/join-code.ts
- apps/api/src/routes/groups.ts, apps/api/src/routes/reactions.ts,
  apps/api/src/lib/group-stats.ts, apps/api/src/subscribers/groups.ts
- apps/web/src/features/groups/** (incl. HomeGroupPulseSection.tsx)
APPEND-ONLY (one line each, never rewrite): routes/index.ts, subscribers/index.ts,
the Home section slot.

CONSUME, never modify (foundation contracts): shared zod schemas + unit/week helpers +
scoreFor()/POINTS + the realtime event union; the event bus emit/on in
apps/api/src/lib/events.ts; broadcast(channel,event) in apps/api/src/lib/realtime.ts
(safe no-op); the route registry; apps/web/src/lib/api.ts + TanStack Query.

BUILD ORDER:
1. Migration: groups, group_members, reactions. Do NOT declare shares_group_with() — it
   already exists from card 02's 0001_foundation.sql (SECURITY DEFINER, forward-references
   group_members); creating group_members here resolves it. RLS is ADDITIVE — members read
   each other and react via the foundation shares_group_with; strangers read/react to neither.
   Join code = 6 chars, alphabet excludes O/0/I/1/L. Multiple groups per user.
2. Shared: Group/GroupMember/Reaction zod schemas + input schemas; a PURE
   generateJoinCode() + JOIN_CODE_ALPHABET. Store meters/seconds only — derive all
   km/pace via shared helpers.
3. API: /groups (create/join/get/rename/regenerate-code/remove-member), /groups/:id/feed,
   /groups/:id/stats (leaderboard score/km/runs, group totals, you-vs-average,
   per-member summaries, head-to-head — service client, members-only), /reactions
   (RLS-gated, emit reaction.added). Validate every boundary with zod. subscribers/groups.ts
   subscribes to run.logged/workout.logged/habit.checked/reaction.added/score.awarded and
   broadcast()s to group:<id> and user:<id> (what changed: type + ids, no data).
4. Web: Group tab (switcher, leaderboard with rank arrows + current-user highlight +
   score/km/runs segmented toggle, you-vs-group card, live feed with reactions, members
   list + drill-down + head-to-head, Invite share sheet, "Challenge this group" link,
   teaching empty state, owner moderation). Realtime hook subscribes to group:<id> +
   user:<id> and invalidates TanStack query keys — leaderboard reorders with a motion
   spring, feed items slide in, Home pulse strip refreshes. Ship BOTH phone and
   desktop layouts, loading skeletons, and error states.

RULES: greenfield only; ONLY these packages — zod, @supabase/supabase-js,
@tanstack/react-query, react, react-dom, react-router, motion, date-fns, hono
(if you think you need another, STOP and add a "⚠️ NEEDS TEAM DECISION" line instead);
theme tokens only (no hardcoded colors/radii/fonts); no secrets in the browser (service
client server-side only); custom controls only (no native checkboxes/selects).

Open a PR into `dev` when every acceptance-criteria box passes.
```
