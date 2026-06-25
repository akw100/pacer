# Pacer — Pages & UX

Design principles:

1. **One question per screen.** Each concept gets its own page and a real navigation — no
   overloaded "Settings" tab hiding plans, groups, and integrations.
2. **Logging is the hero action.** A persistent prominent "+" — never more than one tap away. Most
   visits are "log something, glance at progress, leave".
3. **Two form factors, both designed.** Bottom tab bar + sheets on phones; left sidebar +
   multi-column layouts on desktop (see §Desktop layouts). The installable PWA is the "app".
4. **Empty states teach.** Every empty screen explains the feature and offers the first action
   ("No group yet — create one and share the code with your family").
5. **Light, friendly, energetic — and not AI-looking.** Light theme default, one warm accent
   color, characterful numerals, custom illustrations, celebratory moments (PRs, challenge wins).
   Custom controls only — no native checkboxes/selects. Design direction in `06-TECH-STACK.md`.
6. **Live by default.** Leaderboards, feeds, reactions, and challenge progress update over
   websockets — nobody ever refreshes to see whether Mom logged her run.

---

## Navigation (5 destinations + 1 floating action)

| Tab | Icon | Purpose |
| --- | --- | --- |
| **Home** | house | Today + this week at a glance |
| **Progress** | chart | History, trends, calendar, PRs |
| **Group** | people | Leaderboard, feed, members |
| **Challenges** | trophy | Active/upcoming/finished challenges |
| **Profile** | avatar | Settings: account, plan, Telegram, preferences |
| **＋ Log** | floating button | Log run / workout / habits — available from every screen |

---

## Pages

### 0. Sign-in
- Single card: logo, one-line value prop ("Track workouts. Compete with your family."),
  **Continue with Google** as the primary button, email fallback collapsed behind a small link.

### 1. Onboarding (first run only, 4 short steps, skippable after step 1)
1. **Claim your handle** — handle + display name, inline availability check.
2. **Join your people** — "Have a code? Enter it" (6-char segmented input) **or** "Create a group"
   (name → big shareable code with copy button). Skip allowed; this is also where we *show* that
   groups exist.
3. **Connect Telegram** (optional) — one screen explaining "text the bot 'ran 5k in 30 min' or send
   a photo of your watch — it logs itself", with the link code + deep link button
   `t.me/<bot>?start=<code>`.
4. **Pick your habits** — stretching and nutrition pre-checked, add custom. Finish → Home with a
   one-time coachmark tour (3 tooltips: the + button, the score, the group tab).

### 2. Home (the daily screen)
Top to bottom:
- **Header**: greeting + current **streak flame** + **weekly score** chip (tapping score opens a
  "how scoring works" sheet — transparency builds trust in the competition).
- **Today card**: today's planned slot ("Run · 4 km" or "Strength A") with a check state, and the
  day's **habit toggles** (stretch ✓ / nutrition ✓ / custom) — the whole daily ritual is one card,
  zero navigation.
- **This week card**: plan progress ring + "1 run left · 4.2 km to go", scheduled-run pills
  (done/upcoming).
- **Group pulse strip**: top-3 of this week's group leaderboard ("Dana 96 · You 88 · Yuval 71") —
  tap → Group tab. This is the competitive hook on the home screen.
- **Recent activity**: last 2–3 logged items with reactions received.

### 3. Log (modal sheet from the ＋ button)
- Segmented choice: **Run / Workout / Habits**.
- **Run**: big distance + time inputs (units from profile preference), date defaults to today,
  exertion slider, wellness toggles collapsed under "details". Save → confetti-light toast with
  points earned ("+15 pts").
- **Workout**: name with autocomplete, "repeat last" chip, exercise rows (name/sets/reps/weight),
  add-row button.
- **Habits**: today's habit toggles (same component as Home) + a 7-day mini-grid to fix missed days.
- **Assistant entry points in the sheet**: a chat icon ("tell me what to log") and — stage 2 — a
  **mic button**. In voice mode the form stays visible and fields fill in live as the user speaks
  (each field flashes as it's captured: distance → time → date), then "save it" or the Save button
  commits. Speech is never auto-saved without the filled form being shown.
- A small Telegram hint at the bottom of the sheet: "Faster: text the bot →" (links to
  Profile → Telegram if not yet connected).

### 4. Progress
- **Sub-tabs (segmented): Trends · Calendar · History · Records**
- **Trends**: weekly distance bars (12 weeks), pace line, weekly score line; summary stats
  (week/month/all-time: km, runs, workouts, habit rate, avg exertion). Below the personal charts,
  a **Community card**: platform totals ("Pacer ran 1,240 km this week") and your percentile
  ("top 20% by distance") — anonymous, motivating, no names.
- **Calendar**: month grid, colored dots (run / workout / all-habits-done), tap a day → bottom
  sheet with that day's entries.
- **History**: unified reverse-chron list of runs + workouts with edit/delete (swipe on mobile).
- **Records**: PR cards — fastest pace, longest run, biggest week, longest streak — with dates.

### 5. Group
- **Group switcher** at top if the user belongs to several (avatar-stack pills).
- **Leaderboard card**: this week's scores, rank movement arrows (↑2), the current user's row
  highlighted. Toggle: score / km / runs. **Updates live** — a new log reorders it in place with
  a small animation.
- **You vs group card**: your week against the group average (km, score, habit rate) — "1.2 km
  ahead of the family average" — plus group totals ("the family ran 47 km this week").
- **Feed**: members' logged activities + habit milestones, each with reaction buttons (👏 🔥 💪);
  new items slide in live.
- **Members**: list with per-member week stats; tap a member → drill-down (their week/month stats,
  streak, recent activity, head-to-head vs you over 4 weeks). Owner sees manage actions (rename,
  regenerate code, remove).
- **Header button "Invite"** → share sheet with the join code.
- **Challenge shortcut**: "Challenge this group" button → pre-filled challenge creation.
- Empty state (no group): friendly illustration + the two onboarding actions (enter code / create
  group) — the feature explains itself.

### 6. Challenges
- Three sections: **Active** (progress + leaderboard), **Invitations** (accept/decline cards, badge
  on the tab icon when pending), **Upcoming / Finished** (winner banner 🏆 on finished).
- **Challenge detail**: description text, embedded YouTube video (if any), date range with
  days-left ring, full leaderboard, your progress vs target. For check-in challenges, a big
  "Mark done today" button.
- **Create challenge** (from + on this tab or from Group): step 1 *who* (a person by handle /
  a group / everyone), step 2 *what* (template gallery: "Most km this week", "7-day stretch
  streak", "Do this video 3×" — or custom: metric, target, dates, text, YouTube URL), step 3
  confirm preview.

### 7. Pacer Assistant (chat panel)
- Opened from a sparkle/chat button in the header (every screen) or from the Log sheet.
- Mobile: full-height sheet; desktop: right-side panel (the rest of the app stays visible —
  important, because the assistant's actions update the UI live behind it).
- Chat thread with the assistant: free-text requests ("log a 5k from this morning", "who's
  winning this week?", "challenge the family to a 7-day stretch streak").
- Every **write** action renders as a confirm card in the thread (the filled run/challenge,
  with Save / Edit / Cancel) — same trust model as the Telegram ✓/✗ flow; stats answers render
  as small inline stat cards.
- Stage 2 adds the **mic toggle** at the top of the panel: hands-free conversation, spoken
  answers, and live form-filling (see Log sheet above).
- Empty state teaches it: three tappable example prompts.

### 8. Profile & settings
Sections as cards, each its own sub-page on mobile:
- **Account**: avatar, handle, display name, units (km/mi), week start, theme (light/dark), sign out.
- **Running plan**: current plan summary + edit; create flow asks current weekly km → goal →
  weeks → runs/week, then shows the generated ramp as a small chart *before* saving.
- **Workout plan**: weekly template editor (7-day row, tap a day to assign strength/run/rest).
- **Habits**: manage habit list (add/rename/archive).
- **Telegram**: status (linked as @name), link/unlink, nudge preferences (off / daily / weekly recap).
- **Scoring**: read-only explanation of the points table.

---

## Desktop layouts (first-class, not stretched mobile)

Left sidebar replaces the bottom tabs (logo top, 5 destinations, "+ Log" as a full button, profile
bottom). Content max-width ~1100px. Per page:

- **Home**: 2 columns — Today + This week left; group leaderboard + live feed right (the group
  pulse strip becomes the full leaderboard, since space allows).
- **Log**: centered dialog instead of a bottom sheet; same fields side by side.
- **Progress**: Trends charts in a 2-up grid; Calendar and History side by side; Community card
  in the right rail.
- **Group**: leaderboard + you-vs-group left column; feed right column; members table below.
- **Challenges**: card grid (2–3 across); detail opens as a side panel, video embedded large.
- **Profile**: settings as a two-column form layout.

The PWA install prompt appears on both: phones get "Add to Home Screen", desktop gets the
standalone-window install.

## First-time guides (recurring pattern, not a one-off tour)

- **Coachmarks** (once, after onboarding): + button → score chip → Group tab.
- **Teaching empty states** everywhere: Challenges ("Challenge your group to anything — even a
  YouTube workout video"), Calendar ("Days light up when you log"), Records ("Your first run sets
  your first record").
- **Contextual hints, dismissable**: after 3 manual run logs, hint "Did you know you can text the
  bot a photo of your watch?"; after joining a group, hint "Send your first challenge".
- **`?` in the header** opens a short "How Pacer works" sheet (log → score → compete) for anyone
  who skipped onboarding.

## Key flows, end to end

1. **Daily ritual (≤10s)**: open app → Home → tap habits ✓✓ → done. Or via Telegram: "stretched".
2. **Post-run (≤20s)**: photo of watch → bot replies parsed data → tap ✓ → points + plan run
   auto-completed.
3. **Family setup**: Mom creates group on onboarding → shares code in family WhatsApp → each member
   joins during their own onboarding step 2.
4. **Throwing down**: Group tab → "Challenge this group" → pick template "Do this video 3×" →
   paste YouTube link → everyone gets an invitation card + Telegram nudge.
