# Pacer — Product specs

A fitness-tracking platform for individuals and small private groups (family/friends). The core loop:
**log activity effortlessly (web or Telegram) → see progress → compete playfully with your group.**

---

## 1. Accounts & profiles

- Sign in with **Google** (Supabase Auth). Email/password as fallback.
- Profile: unique handle (3–20 chars), display name. Auto-created on signup.
- Profile settings: preferred units (km/mi) stored once on the profile, avatar (Google photo or
  emoji picker), week-start day, theme (light default / dark).
- First-run onboarding flow (see UX doc) — handle setup, join/create group, link Telegram, pick habits.

## 2. Activity logging

### Runs
- Distance, duration, date, exertion (1–10), notes.
- Wellness flags: warmed up, stretched, post-run food, sleep hours.
- Derived display: pace, km/mi — canonical storage is always meters/seconds.
- Edit & delete.

### Workouts (strength / general)
- Name, date, type tag (strength / mobility / swim / bike / other), exercises (name, sets, reps,
  optional weight) or just a duration for non-rep activities.
- Exercise autocomplete from the user's own history (no giant exercise DB needed).
- "Repeat last workout" one-tap prefill.

### Habits (the daily yes/no layer)
- Daily checkable habits tied to fitness: **stretching** and **nutrition** are the defaults; users
  can add custom ones (e.g. "10k steps", "no sugar").
- One tap per habit per day, editable for past days (limit: last 7 days).
- Habits feed the score (see §6) and streaks.

## 3. Telegram bot

- Account linking via short-lived 8-char code generated in app settings.
- Free-text logging: an LLM parses "ran 5k in 28 minutes" or "3x10 squats at 60kg" into structured
  runs/workouts.
- **Photo logging**: send a photo of a watch/treadmill screen after a run; a vision model extracts
  distance/time/pace. Bot replies with what it understood and an inline "✓ correct / ✗ fix"
  confirmation before saving (prevents OCR mistakes silently polluting data).
  - Cost/abuse guard (decided): photos are only parsed from **linked accounts**, with a
    **per-user daily cap** (10/day); over the cap or on low confidence, the bot asks the user to
    type the run instead.
- Habit check-ins by text: "stretched today" → marks the habit.
- Daily/weekly nudge messages (opt-in, per-user preference): "You have 1 run left this week (4 km)".
- Weekly recap message: your km, score, group rank, streak.

## 4. Groups

- Create a group → 6-char join code; join by code; **multiple groups per user**.
- The group screen is a real social surface:
  - Weekly leaderboard by **score** (see §6), with km/runs toggles — so the non-runner family
    member competes too.
  - Activity feed: "Dana logged a 5 km run", "Yuval completed all habits today".
  - Reactions (👏 🔥 💪) on feed items — lightweight kudos, no comments/chat.
- Members see each other's stats (week km, runs, score) — competitiveness by visibility.
- Group-scoped challenges (see §5).
- Owner can rename the group, regenerate the join code, remove members.

## 5. Challenges

- **Audience**: a specific person (by handle), a whole group (all members invited at once), or
  open-to-everyone.
- **Content**: free-text description ("50 push-ups a day for a week") and/or an embedded
  **YouTube video** ("everyone does this 10-min ab workout") — youtu.be / watch?v= / shorts URLs
  all normalized and embedded in the challenge card.
- **Metrics**: distance, run count, reps, workout count, habit-completion days, total score, and
  **check-ins** — a self-report "mark done" counter (target N times) for video/text challenges
  where progress isn't derivable from logged data.
- Date window + target; per-participant leaderboard; invitation statuses (invited/accepted/declined).
- States surfaced clearly: upcoming / active / finished, with a winner banner 🏆 at the end.
- Templates for one-tap creation: "Most km this week", "7-day stretch streak", "Do this video 3×".

## 6. Scoring (the competitive glue)

A simple, transparent weekly score so every member competes on effort, not just distance:

| Action | Points |
| --- | --- |
| Run logged | 10 + 1 per km |
| Workout logged | 10 |
| Each habit completed (per day) | 3 |
| All habits in a day | +2 bonus |
| Plan run completed on schedule | +5 |
| 7-day streak (any activity/habit) | +10 |

- Score is computed per week (keeps competition fresh); a lifetime total is also shown.
- Shown on dashboard, group leaderboard, and weekly Telegram recap.
- Formula lives in the shared package so web, api, and bot agree.
- Decided: **no retroactive scores** — everyone starts at zero when the site launches.

## 7. Plans

### Running plan
- Inputs: current weekly km, goal weekly km, runs/week (default 2), duration in weeks.
- 10%/week progressive overload, final week lands exactly on the goal; weekly target split across
  scheduled runs; logging a run auto-completes the week's next scheduled run.
- The generated ramp is previewed as a chart before saving.
- Adaptive nudge: if a week is missed, the plan offers "repeat week" instead of silently falling behind.

### Workout plan builder
- Compose a weekly template: e.g. Mon strength A, Wed run, Fri strength B + daily habits.
- Each planned slot is checkable from the dashboard; completing it links the actual logged activity.
- One active workout plan per user; templates are editable.

## 8. Dashboard & stats

Stats are a headline feature — personal, group, and platform-wide layers:

### Personal
- Today card: today's planned slot + habit checkboxes — the single "what do I do right now" answer.
- This-week card: plan progress ring, km and runs left, scheduled-run pills.
- Streak flame (consecutive active days) and weekly score, front and center.
- Trends: weekly distance bar chart (12 weeks), pace trend line, weekly score line; summary stats
  (week / month / all-time): km, runs, workouts, habit-completion rate, average exertion, average
  sleep before runs.
- Personal records: fastest pace, longest run, biggest week, longest streak — with a small
  celebration when broken.
- Calendar month view: dots per day (run / workout / habits), tap a day for details.

### Group (the deep layer — full visibility between members)
- Weekly leaderboard (score / km / runs toggles) with rank-movement arrows and rank history.
- **You vs group**: your week overlaid on the group average (km, score, habit rate) — "you're
  1.2 km ahead of the family average".
- Per-member drill-down: a member's week/month stats, streak, and recent activity.
- Group totals: combined km this week/month ("the family ran 47 km this week"), most active day,
  group habit-completion rate.
- Head-to-head card: you vs any one member over the last 4 weeks.

### Platform (everyone on Pacer — anonymous aggregates only)
- Community totals: km logged across the platform this week, runs logged today, habits checked.
- **Percentiles**: "your week puts you in the top 20% of runners on Pacer" (distance, score,
  streak) — motivating without exposing anyone.
- Fun aggregates: most popular running day/hour, average pace across the platform vs yours.
- Privacy rule: outside your groups, no names or handles ever — only aggregates and percentiles,
  computed server-side with the service client.

## 8b. Live updates (no refresh needed)

- The group leaderboard, activity feed, reactions, and challenge progress update **in realtime**
  via Supabase Realtime (websockets) — when Dana logs a run, Yuval's open Group tab updates within
  a second, which is exactly the moment competitiveness pays off.
- Score/streak chips and the Today card refresh live when an activity arrives from Telegram, so
  texting the bot is instantly reflected in an open browser tab.
- Lightweight presence is optional polish (e.g. a subtle "3 family members active today"), not v1-blocking.

## 9. Pacer Assistant (in-app bot → realtime voice)

An assistant that lives *inside* the platform (the Telegram bot's sibling), shipped in two stages:

### Stage 1 — chat assistant
- A chat surface in the app: type "log a 5k run from this morning, took 28 minutes" → the
  assistant fills the run form and saves (with a visible confirm card, same trust model as the
  Telegram ✓/✗ flow).
- It can do, via tool-calling against the same API the UI uses (so RLS and scoring apply
  unchanged): log runs/workouts/habits, create challenges ("challenge the family to 30 km this
  week"), answer stats questions ("how far did I run this month?", "who's leading the group?"),
  and navigate ("show my plan").
- Powered by OpenAI (the platform's existing LLM provider — same key as Telegram parsing).

### Stage 2 — realtime voice
- Tap the mic and *talk*: "log a run… five k… 28 minutes… this morning" — the form fields fill
  **live on screen as you speak** (field-by-field visual feedback), then "save it" commits.
- Built on the **OpenAI Realtime API** (WebRTC from the browser, speech-to-speech, with the same
  function tools as stage 1 mapped to form-fill actions). The browser session uses short-lived
  ephemeral tokens minted by the API — the real key never reaches the client.
- Voice works anywhere the assistant works: logging, challenge creation, stats questions
  (spoken answers).
- Alternative provider if ever needed: Gemini Live API — the tool interface is designed
  provider-agnostic so swapping is contained.

## 10. Platform & quality

- **Two first-class form factors, always**: every screen ships with both a phone layout (bottom
  tabs, sheets) and a designed desktop layout (sidebar, multi-column) — desktop is never a
  stretched mobile view. Pacer is a responsive **website** (no install) — the same site on phone and
  desktop; the Telegram bot covers quick logging on the go.
- **Light theme by default** with optional dark mode (not an all-dark UI).
- The UI must **not look AI-generated**: characterful type for numbers, warm palette, custom
  illustrations, springy motion — see `06-TECH-STACK.md` §Design direction.
- No native browser checkboxes/dropdowns — custom toggle/segmented/select components throughout.
- Privacy via RLS: own rows by default; group members read each other via additive policies;
  service-role client only for trusted server work (Telegram ingestion, leaderboard aggregation).
- Canonical units in DB (meters, seconds); all display values derived in shared helpers.
- Empty states everywhere double as feature tutorials (see UX doc §First-time guides).

## Out of scope (explicitly, for now)

- Chat/comments inside groups (reactions only).
- Public profiles or discovery — groups are private, join-code-only.
- GPS tracking / live run recording — this is a *log*, not a tracker; watch photos cover the data entry.
- Native mobile apps or an installable PWA — Pacer ships as a plain responsive website; the Telegram bot covers quick on-the-go logging.
