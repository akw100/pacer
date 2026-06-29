# 09 — Challenges

> Stage 2 · independent slice · depends only on the foundation contracts (+ MVP
> activity data). Reads groups + activity **through the API / service client**,
> never another slice's tables. See [`05-ROADMAP.md`](../05-ROADMAP.md) and
> [`08-CONVENTIONS.md`](../08-CONVENTIONS.md).

## What it delivers

Competitive goals between friends and groups (spec [`01-SPECS.md` §5](../01-SPECS.md)):

- **Audience**: a specific person (by handle), a whole group (all members invited
  at creation), or open-to-everyone (anyone can join).
- **Metrics**: `distance · run_count · reps · workout_count · habit_days · score`
  derived from the participant's own logged activity inside the window, plus
  **`check_in`** — a self-report counter for video/text challenges.
- **Content**: free-text description and/or an embedded YouTube video
  (youtu.be / watch / shorts / embed all normalised).
- Date window + target · per-participant leaderboard · invite statuses
  (invited / accepted / declined) · states upcoming / active / finished with a
  🏆 winner banner · one-tap templates.

## Owns (top level)

| Layer | Files |
| --- | --- |
| Shared | `packages/shared/src/schemas/challenge.ts` (+ barrel line, `displayDistanceToMeters` in `units.ts`) |
| DB | `supabase/migrations/0012_challenges.sql` |
| API | `apps/api/src/routes/challenges.ts`, `apps/api/src/lib/challenge-progress.ts`, `apps/api/src/subscribers/challenges.ts` (+ one registry line each) |
| Web | `apps/web/src/features/challenges/**`, mounts on `apps/web/src/screens/Challenges.tsx` |

## API surface

```
GET    /challenges               every challenge the caller can see, enriched
POST   /challenges               create (audience seeds participants)
PATCH  /challenges/:id           edit (creator, while upcoming)
DELETE /challenges/:id           cancel (creator)
POST   /challenges/:id/respond   accept / decline an invite
POST   /challenges/:id/join      join an open / group challenge
POST   /challenges/:id/check-in  self-report a check-in
```

Each challenge is returned as `ChallengeWithProgress` — computed `state`, the
caller's `my_status` / `my_progress`, roster counts, and the full
per-participant `leaderboard`. Progress is computed server-side
(`computeChallengeProgress`) with the service client after a visibility check.

## Data model

`challenges`, `challenge_participants`, `challenge_check_ins` with RLS. A
`SECURITY DEFINER can_see_challenge(cid, viewer)` helper centralises visibility
(creator / participant / open / group member) so the SELECT policies reuse it
without recursive RLS. Participants self-join challenges they can see and update
only their own row; check-ins are self-insert.

## Realtime

The subscriber re-broadcasts `run/workout/habit/score` events as a compact
`challenge.updated` to participating users' channels; every write handler
broadcasts to affected users. Clients invalidate the list and refetch — RLS and
progress derivation stay server-side.

## Design decisions

- Progress counts **all** of a participant's activity in the window, not just
  group-shared rows.
- The open (`everyone`) leaderboard shows **joiners only**.
- Distance targets are stored in **canonical meters**; the UI converts to the
  user's km/mi at display time.
- A challenge is editable only while **upcoming** (audience + participants fixed
  at creation).

## Definition of done

Acceptance criteria pass · `pnpm typecheck` green (shared/api/web) ·
`pnpm test` green · phone **and** desktop · teaching empty state · token-only
styling · no secrets.
