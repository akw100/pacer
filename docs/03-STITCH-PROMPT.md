# Stitch design prompt — Pacer

Use these prompts in Google Stitch (stitch.withgoogle.com). Start with the project-level brief,
then generate screen by screen — Stitch does better with one screen per prompt. Treat the output
as a starting point: we keep the layout ideas and information hierarchy, not necessarily the exact
visuals.

---

## Project brief (paste first / include in every prompt)

> Design a **mobile-first fitness tracking web app called "Pacer"** for individuals and small
> private groups (families, friends). It tracks runs, strength workouts, and daily fitness habits
> (stretching, nutrition), and turns effort into a **weekly point score** that members compete on
> in private groups and challenges.
>
> **Style**: light theme, clean and airy, generous whitespace, rounded cards (16px radius), one
> energetic accent color (coral-orange `#FF5A36`) on a warm off-white background (`#FAF8F5`),
> dark slate text (`#1F2733`), soft shadows. Friendly and motivating, not corporate and not
> gamer-dark. Big bold numbers for stats (distance, score, streak). Subtle celebratory touches
> (streak flame 🔥, trophy, confetti moments) without being childish. Typography with character:
> a display face (like Clash Display or Cabinet Grotesk) for headings and big stat numerals,
> a quiet sans (Inter) for body — avoid a generic template look: no purple gradients, no
> glassmorphism, no gray-on-white default component styling.
>
> **Navigation**: bottom tab bar with 5 items — Home, Progress, Group, Challenges, Profile — plus
> a prominent floating circular "+" log button centered above the bar. All toggles and selects are
> custom-styled pills/segmented controls, never native form controls.

## Screen prompts

### 1. Home
> Home screen. Top: greeting "Good morning, Dana", a streak chip "🔥 6 days", and a score chip
> "88 pts this week". Below: a "Today" card containing today's planned activity ("Run · 4 km" with
> a check circle) and three habit toggle pills (Stretch ✓, Nutrition ✓, Steps ○). Next: a "This
> week" card with a circular progress ring "12.4 / 16 km", text "1 run left", and small pills for
> each scheduled run (two done, one upcoming Thursday). Next: a compact horizontal "group pulse"
> strip showing top-3 leaderboard avatars with points (Dana 96, You 88, Yuval 71). Bottom: two
> recent activity rows with small reaction emoji counts. Bottom tab bar + floating "+" button.

### 2. Log sheet
> A bottom sheet over the Home screen for logging. Top: segmented control "Run | Workout | Habits"
> with Run selected. Large side-by-side inputs for distance (km) and time (mm:ss), a date field
> defaulting to Today, an exertion slider 1–10, and a collapsed "More details" row (warm-up,
> stretched, food, sleep). Primary full-width button "Save run · +15 pts".

### 3. Progress
> Progress screen with a segmented control "Trends | Calendar | History | Records". Trends view:
> a bar chart of weekly kilometers over 12 weeks, a line chart of pace, and three stat tiles
> (This week 12.4 km · This month 41 km · All time 318 km). Then the Calendar variant: a month
> grid where days have small colored dots (orange = run, blue = workout, green = all habits done)
> and one day selected showing a detail bottom sheet.

### 4. Group
> Group screen for a private family group "Wasserman Family". Header with group name, member
> avatar stack, and an "Invite" button showing a 6-character join code "K7M3RP" with a copy icon.
> Main card: weekly leaderboard ranked by points with rank-change arrows, the current user's row
> highlighted. Below: an activity feed — "Yuval logged a 5.2 km run · 2h ago" with reaction
> buttons (👏 🔥 💪) and counts. A secondary button "Challenge this group". Include the empty-state
> variant of this screen too: illustration, "No group yet", two buttons "Enter a code" / "Create
> a group".

### 5. Challenges
> Challenges screen with three sections: an invitation card at top ("Mom challenged you: Do this
> 10-min ab workout 3× this week" with an embedded YouTube video thumbnail and Accept / Decline
> buttons), then Active challenges as cards with progress bars toward a target and a mini
> leaderboard, then a Finished challenge card with a winner banner "🏆 Dana won · Most km in May".

### 6. Challenge creation
> A 3-step challenge creation flow. Step 1 "Who": choice cards — a specific person (handle input),
> a group (group picker), or everyone. Step 2 "What": a template gallery (cards: "Most km this
> week", "7-day stretch streak", "Do this video 3×") plus a custom option with metric picker,
> target, date range, optional description text, and an optional YouTube URL field showing a video
> preview. Step 3: confirmation preview of the challenge card as recipients will see it.

### 7. Onboarding
> A 4-step onboarding carousel: (1) claim a handle with availability check, (2) "Join your people"
> — a 6-character segmented code input OR a create-group card showing a big shareable code,
> (3) connect Telegram — a friendly explainer "Text the bot 'ran 5k in 30 min' or send a photo of
> your watch and it logs itself", a chat mockup bubble, and a "Open Telegram" button, (4) pick
> daily habits with pre-checked pills for Stretching and Nutrition plus an "add your own" input.
> Progress dots, Skip link top-right.

### 8. Assistant
> An in-app assistant chat panel sliding up as a full-height sheet over the Home screen. Header
> "Pacer Assistant" with a sparkle icon and a mic toggle button. Chat thread: user bubble "log a
> 5k run from this morning, 28 minutes", assistant reply with an inline confirm card showing the
> filled run (5.00 km · 28:00 · Today · pace 5:36 /km) and three buttons Save / Edit / Cancel.
> Below, a second exchange: "who's leading the family this week?" answered with a small
> leaderboard stat card. Input bar at the bottom with text field and mic button. Include a second
> variant: **voice mode active** — a subtle waveform indicator at the top, and behind the
> semi-transparent panel the run form is visible with its distance field highlighted as it fills
> in live from speech.

### 9. Profile & settings
> Profile screen: avatar, handle "@dana", display name, then settings rows grouped in cards —
> Account (units km/mi segmented toggle, theme light/dark, week start), Running plan (summary
> "16 km/week goal · week 4 of 8" with an Edit chevron and a tiny ramp chart), Habits (manage
> list), Telegram (status "Linked as @dana_w" with a disconnect link and nudge preference pills
> Off / Daily / Weekly), and a scoring explainer row "How points work".

### Desktop variant (one extra prompt)
> Same app on desktop: left sidebar navigation instead of bottom tabs, Home as a 2-column
> dashboard (Today + This week left; group leaderboard and feed right), max content width 1100px,
> same light warm style.

## Notes for whoever runs Stitch

- Generate mobile screens first (that's the primary form factor), then the one desktop prompt.
- Ask for the **empty-state variants** of Group and Challenges — those screens teach the features.
- Export to Figma if you want to iterate; otherwise screenshots are enough — we build the
  components in React/Tailwind (shadcn/ui base) and only borrow hierarchy/spacing/ideas.
- Hebrew/RTL is not required in the designs; the app ships in English first.
