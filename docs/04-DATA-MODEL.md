# Pacer — Data model

Full schema for the new build (Supabase Postgres, migrations committed to the repo).

Canonical rules:
- **Store meters and seconds; derive every display value** (km/mi, pace, durations) in the shared
  package — never store display values.
- RLS on every table: users read/write their own rows by default; group members read each other
  via additive `shares_group_with()` SELECT policies (backed by `SECURITY DEFINER` helpers to
  avoid RLS recursion).
- Service-role client only for trusted server work: Telegram ingestion, leaderboard/feed
  aggregation. Never in the browser.

## Tables

```
profiles                  -- auto-created on signup (auth trigger)
  id (= auth uid), handle UNIQUE (3-20 chars, case-normalized), display_name,
  units ('km'|'mi'), theme ('light'|'dark'), week_start (0|1), avatar_emoji,
  nudge_pref ('off'|'daily'|'weekly'), created_at

runs
  id, user_id, run_date (yyyy-mm-dd), distance_meters, duration_seconds,
  exertion_rating (1-10, nullable), warm_up, stretched, post_run_food,
  sleep_hours, notes, source ('web'|'telegram'), created_at

workouts
  id, user_id, name, workout_date, kind ('strength'|'mobility'|'swim'|'bike'|'other'),
  duration_seconds (nullable, for non-rep activities), source, created_at

workout_sets
  id, workout_id, exercise_name, sets, reps, weight (nullable)

habits
  id, user_id, name, emoji, sort, archived_at, created_at
  -- two default rows seeded at signup: Stretching, Nutrition

habit_checks
  id, user_id, habit_id, check_date (yyyy-mm-dd), created_at
  UNIQUE (habit_id, check_date)
  -- a row = done; absence = not done; editable for the trailing 7 days (enforced in API)

running_plans
  id, user_id, current_weekly_meters, goal_weekly_meters, runs_per_week (default 2),
  start_date, weeks, active (one active per user), created_at

plan_runs
  id, plan_id, scheduled_date, target_meters, completed_run_id (FK runs, nullable)
  -- logging a run completes the oldest open plan_run in the same week

workout_plans
  id, user_id, name, active (one active per user), created_at

workout_plan_slots
  id, plan_id, weekday (0-6), label ('Strength A'/'Run'/'Rest'), kind

groups
  id, name, join_code UNIQUE (6 chars, no O/0/I/1/L), owner_id, created_at

group_members
  group_id, user_id, joined_at
  -- multiple groups per user supported

challenges
  id, creator_id, audience ('user'|'group'|'everyone'), group_id (nullable),
  metric ('distance'|'run_count'|'reps'|'workout_count'|'habit_days'|'score'|'check_in'),
  target, start_date, end_date, description (nullable), youtube_url (nullable, normalized),
  created_at

challenge_participants
  challenge_id, user_id, status ('invited'|'accepted'|'declined')
  -- progress computed server-side per metric; creator starts 'accepted';
  -- 'group' audience invites all current members at creation

challenge_check_ins        -- for metric = 'check_in' (self-report challenges)
  id, challenge_id, user_id, check_date, UNIQUE (challenge_id, user_id, check_date)

reactions
  id, user_id, target_type ('run'|'workout'|'habit_day'), target_id, emoji, created_at
  UNIQUE (user_id, target_type, target_id, emoji)
  -- RLS: insert/select only when shares_group_with(target owner)

score_events               -- append-only ledger; weekly/lifetime scores are SUMs over it
  id, user_id, points, reason ('run'|'workout'|'habit'|'habit_day_bonus'|'plan_run'|'streak'),
  source_type, source_id, event_date, created_at
  -- written by the API at log time; idempotent per (reason, source_type, source_id);
  -- deleting a run/workout removes its events (trigger or FK-style cleanup)

telegram_links
  user_id, telegram_user_id, telegram_username, linked_at

telegram_link_codes
  code (8 chars), user_id, expires_at (10-min TTL)
```

## Scoring implementation

- Points table as constants + a pure `scoreFor(...)` in the shared package — web shows the preview
  ("+15 pts"), api writes the ledger, bot includes points in replies. One source of truth.
- "Weekly score" = `SUM(points) WHERE event_date in current week` — no stored aggregates, no reset job.
- Streak = consecutive days with ≥1 run/workout/habit_check; computed in shared from fetched dates
  (cheap at family scale); the +10 streak event is written server-side when a 7-multiple is hit.

## Realtime (live updates)

- Supabase Realtime **broadcast channels**: `group:<id>` (API broadcasts after writing runs/
  workouts/habit checks/reactions/score events; membership-gated) and `user:<id>` (Telegram-logged
  activity updates the user's own open tabs).
- Events carry *what changed* (type + ids), not data — clients invalidate TanStack Query keys and
  refetch through the normal API, so RLS and derivation stay in one place.
- Live surfaces: group leaderboard, feed, reactions, challenge progress, Home score/streak chips.

## Stats endpoints

- **Group stats** (`/groups/:id/stats`): leaderboard (score/km/runs), group totals (week/month km,
  most active day, habit rate), per-member week summaries, you-vs-average deltas, head-to-head
  (4-week comparison vs one member). Computed server-side with the service client; only returned
  to members.
- **Platform stats** (`/stats/platform`): anonymous aggregates only — total km this week, runs
  today, habits checked, popular run day/hour, average pace; plus the caller's percentiles
  (distance / score / streak). Never returns other users' names or handles. Cached ~5 min.

## Pacer Assistant (chat + voice)

- **One tool layer, three frontends.** Define assistant tools once (log_run, log_workout,
  check_habit, create_challenge, get_stats, get_leaderboard, navigate) as thin wrappers over the
  existing API handlers, executed with the caller's user client — RLS, scoring, and realtime
  broadcasts apply exactly as if the UI made the call. The Telegram bot, the chat assistant, and
  voice all share this layer.
- **Chat (stage 1)**: `POST /assistant/chat` — streaming endpoint (SSE); OpenAI tool-calling loop
  runs server-side. Write-tools return a *draft* the client renders as a confirm card; only an
  explicit confirm triggers the actual write. Thread history lives client-side (last N messages
  sent with each request) — **no new tables** for v1.
- **Voice (stage 2)**: `POST /assistant/voice-token` mints a short-lived ephemeral token for the
  **OpenAI Realtime API**; the browser connects via WebRTC directly. Function calls from the
  realtime session are executed against the same tool layer through the API. Form-filling is a
  client-side tool (`set_form_field`) so fields populate live as speech is parsed.
- Provider note: OpenAI across the board (matches Telegram parsing + vision). The tool layer is
  provider-agnostic JSON-schema tools, so Gemini (Live API) can be swapped in if ever needed.

## Telegram photo parsing

- Webhook receives photo → download via Telegram file API → vision model (gpt-4o-mini vision or
  Claude) with a JSON schema: `{distance_meters, duration_seconds, pace?, date?, confidence}`.
- Bot replies with parsed values + inline keyboard ✓ Save / ✗ Discard; only ✓ writes the run
  (callback_query handler). On low confidence, save nothing — ask the user to type it instead.
- Only parse photos from linked accounts; cap parses per user per day.

## API surface

```
GET  /health

GET/PATCH /profile/me

GET/POST /runs            PATCH/DELETE /runs/:id
GET/POST /workouts        DELETE /workouts/:id

GET/POST/DELETE /habits
PUT/DELETE      /habits/:id/check?date=     toggle a day

GET  /score/summary       weekly + lifetime + streak (header chips)

GET/POST /plans           running plan (create deactivates previous)
GET      /plans/active
GET/POST /workout-plans   weekly template
GET      /workout-plans/active

GET/POST /groups          POST /groups/join     GET /groups/:id
PATCH    /groups/:id      rename / regenerate code (owner)
DELETE   /groups/:id/members/:userId           (owner)
GET      /groups/:id/feed  recent member activity + reactions
GET      /groups/:id/stats group totals, you-vs-average, member summaries, head-to-head
GET      /stats/platform   anonymous community aggregates + caller percentiles

POST/DELETE /reactions

GET/POST /challenges
POST     /challenges/:id/respond   accept/decline
POST     /challenges/:id/join      open challenges
POST     /challenges/:id/check-in  self-report metric

POST /assistant/chat        streaming chat with tool-calling (SSE)
POST /assistant/voice-token ephemeral OpenAI Realtime token for browser WebRTC

POST /webhook              Telegram (secret-token protected)
POST /nudge                cron: nudges + weekly recaps
POST /telegram/link-code   GET /telegram/status   DELETE /telegram/link
```
