# Live Race — design

**Feature:** a real-time synchronized footrace. The host opens a race for a target
distance (e.g. 3 km), invites friends/group members into a live lobby, presses **Start**
for a synchronized 3‑2‑1 countdown, and everyone runs their own route at the same time.
Each runner's distance streams live (GPS) to a shared leaderboard; the **first to reach the
target wins**. Finishers' runs are logged and scored; the winner earns a victory bonus.

**Branch:** `feat/race-live` → PR into `dev`. **Date:** 2026-06-30. **Surface:** web/PWA only
(the Telegram bot can't stream GPS).

## Scope note (deliberate exception to SPECS §10)

SPECS §10 lists "GPS / live run tracking" as out of scope ("this is a *log*, not a tracker").
Live Race is a **bounded exception**: GPS is used **only while a race is active**, never for
general run logging. This spec updates §10 to record the exception. Outside a race the app
remains log-only.

## Approach (chosen)

Ephemeral **broadcast** for live positions + **server-authoritative** finish (matches §8b:
realtime carries "what changed", Postgres stays the source of truth). Per-tick positions are
broadcast only, never persisted — cheap. The finish, winner, and result are transactional in
Postgres. Anti-cheat is server-side.

## Data model (new migration)

```
races
  id, creator_id, target_meters, status ('lobby'|'active'|'finished'|'cancelled'),
  start_at (timestamptz, set on Start = now()+COUNTDOWN_MS, the synchronized gun),
  finished_at, winner_id (nullable), rematch_of (nullable race id), created_at

race_participants
  race_id, user_id,
  role ('runner'|'spectator'),
  status ('invited'|'joined'|'ready'|'racing'|'finished'|'dnf'),
  final_meters (nullable), finished_at (nullable), elapsed_seconds (nullable),
  manual_finish (bool, true if the GPS-fallback button was used),
  run_id (nullable, the logged run), joined_at
  PRIMARY KEY (race_id, user_id)
```

RLS: a participant can read a race they're in; writes go through the API (service-role for
finish/winner resolution). The invite/join/start/finish routes scope to the verified userId.

## Lifecycle (state machine)

```
lobby ──(host start)──▶ active ──(first finisher OR all-resolved)──▶ finished
  │                       │
  └──(host cancel)──▶ cancelled   └──(timeout / all DNF)──▶ finished
```

- **lobby**: creator sets `target_meters` (presets 1/3/5/10 km + custom), invites
  friends/group members. Invitees `join` (role runner) or join as `spectator`. Each runner can
  toggle **ready**. Host sees readiness; can Start when ready (or force-start).
- **start**: `POST /races/:id/start` sets `start_at = now() + COUNTDOWN_MS` (e.g. 5 s), status
  `active`. Clients render a synchronized 3‑2‑1 from `start_at`. **Late-join cutoff**: no joins
  after `active`.
- **active**: each runner streams distance; the leaderboard updates live. A runner may
  **abandon** → `dnf`.
- **finished**: set when the first runner reaches the target (winner) OR when every runner has
  resolved (finished/dnf) OR a max-duration timeout elapses.

## Distance capture (web/PWA)

- `navigator.geolocation.watchPosition({enableHighAccuracy:true})`. Accumulate distance via the
  **haversine** formula between consecutive fixes.
- **Quality gates** (drop noisy fixes before accumulating): ignore a fix whose `accuracy` >
  `MAX_ACCURACY_M` (e.g. 35 m); ignore deltas implying speed > `MAX_SPEED_MPS` (≈7 m/s, sprint
  ceiling) as GPS jitter; require a minimum time and distance between accumulated points.
- **Throttled broadcast**: emit a `position` event at most every `BROADCAST_MS` (~2 s) or every
  `BROADCAST_M` (~25 m), whichever first — carrying `{userId, meters, ts}`.
- **Fallback**: if permission is denied or the API is unavailable, show a **🏁 I finished**
  button (honor mode); finishing this way sets `manual_finish = true` so results label it.

## Realtime (channel `race:<id>`)

- `lobby` events: join/leave/ready/spectator changes → clients refetch lobby.
- `position`: live distance per runner → drives the leaderboard (progress %, gap to leader,
  rough ETA from current pace). Ephemeral.
- `started`: carries `start_at` so every client counts down together.
- `reaction`: quick emoji (👏🔥💪) broadcast during the race (reuses the reactions vocabulary).
- `finished`: a runner finished (carries userId, rank) → clients update; on race end, all
  refetch the final result.

## Finish & winner resolution

`POST /races/:id/finish` (the client calls it when its accumulated distance ≥ target, or on the
manual button). Server (service-role), in one transaction:
1. Validate the caller is a `racing` participant of an `active` race.
2. **Anti-cheat**: compute `elapsed = now − start_at`; reject if `target_meters / elapsed >
   MAX_SPEED_MPS` (impossible average) → mark `dnf` with reason, don't crown.
3. Set the participant `finished`, `finished_at`, `elapsed_seconds`, `final_meters`.
4. If `winner_id` is null, set it to this user (**first server write wins** — ties impossible).
5. Compute rank (order of `finished_at`).
6. If all runners resolved → set race `finished`, `finished_at`.
Broadcast `finished`.

## Result → integration with runs & scoring

On each finisher (not DNF): log a `runs` row — `source:'race'`, `distance_meters = target`,
`duration_seconds = elapsed`, `run_date = today` — store its id in `race_participants.run_id`.
This fires the existing `emit('run.logged')` → scoring + group fan-out unchanged. The **winner**
additionally earns a victory bonus: add `POINTS.RACE_WIN` (e.g. 15) to `packages/shared`'s
scoring with a new `ScoreReason 'race_win'`, written to the score ledger.

## Post-race

- **Result screen**: podium (1st/2nd/3rd), each runner's time + pace, DNF/manual labels,
  per-km **splits** (derived from the broadcast position stream the client retained), 🎉
  confetti for the winner (canvas-confetti, already in stack).
- **Share**: one-tap share of the result card to a group (reuses the group-share path).
- **Rematch**: one-tap recreates a `lobby` race with the same participants and target,
  `rematch_of` = the finished race.

## API surface

```
POST   /races                 create (lobby)         body: { target_meters }
GET    /races/:id             race + participants + your role/state
POST   /races/:id/invite      body: { userIds[] }    (friends/group members)
POST   /races/:id/join        join as runner (body { role?: 'spectator' })
POST   /races/:id/ready       toggle ready
POST   /races/:id/start       host only → sets start_at, status active
POST   /races/:id/finish      record finish (or manual)   → may crown winner
POST   /races/:id/abandon     mark self dnf
POST   /races/:id/cancel      host only (lobby) → cancelled
POST   /races/:id/rematch     clone to a new lobby
GET    /races                 my races (active + recent)
```

## Web surfaces (`apps/web`)

- **Create/lobby**: distance presets + custom, invite picker (friends/group), live participant
  list with ready ticks, host Start/Cancel.
- **Race**: big synchronized countdown → your distance ring (% to target, live), live
  leaderboard (rank, gap to leader, ETA), reaction buttons, Abandon. GPS-denied → manual finish.
- **Result**: podium, splits, share, rematch.
- All colors/fonts via `tokens.css` (no raw hex/px), per the theming rule.

## Shared contracts (`packages/shared`)

Append a `schemas/race.ts` (Race, RaceParticipant, CreateRaceInput, race enums) + one barrel
line. Add `POINTS.RACE_WIN` + `'race_win'` to `scoring.ts` and `scoreFor`. Add domain events
`race.started` / `race.finished` and realtime event types to the event catalog (append-only).
Pure helpers (haversine, speed/accuracy gates, winner/rank, splits) live here so web + api agree
and are unit-testable.

## Testing (pure units, no network/GPS)

- `haversineMeters(a, b)` — known coordinate pairs.
- quality gates — rejects low-accuracy fix, rejects super-speed delta, accepts a normal stride.
- `isPlausibleFinish(targetMeters, elapsedSeconds)` — anti-cheat boundary.
- winner/rank resolution — first finisher wins, order by finished_at, ties impossible.
- state-machine transitions — legal vs illegal (`lobby→active→finished`, no join after active).
- splits derivation from a position series.
Realtime + geolocation are mocked; tests never hit the network.

## Error handling

- GPS denied/unavailable → manual fallback (no crash).
- Lost connection mid-race → on reconnect, resubscribe and resume accumulating locally; the
  authoritative finish is server-side so a dropped client can't lose its result.
- Double-finish / late finish → server idempotent (already `finished` → no-op).
- Host leaves → race can still finish; cancel only allowed in `lobby`.

## Out of scope (v1.1+ noted)

Maps/route display, GPS handicaps/staggered starts, web-push notifications (in-app + realtime
only for v1), bot participation, spectator chat threads.

## Done = mergeable

`pnpm typecheck` (3 workspaces) + the new unit tests pass; lobby→countdown→live
leaderboard→finish→result works end-to-end in the PWA with real GPS, and via the manual
fallback when GPS is denied; a finished race logs runs + awards points incl. the winner bonus;
SPECS §10 updated to record the bounded GPS exception.
