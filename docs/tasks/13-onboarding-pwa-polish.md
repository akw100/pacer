# 13 — Onboarding, PWA install & polish

> **Stage:** Post-MVP  ·  **Suggested order:** 12  ·  **Size:** M  ·  **One owner builds this end to end.**

**Goal (one sentence).**
Build the first-run 4-step onboarding carousel, the one-time coachmark tour, the dismissable contextual-hint framework, the header "?" "How Pacer works" sheet, and the full installable PWA (manifest + service worker + offline shell on phone and desktop) — then do an a11y + performance polish pass.

**Why it matters / where it sits in the product.**
This slice turns a fresh Google sign-in into a configured, group-joined, habit-picked user who understands the three-beat loop (log → score → compete) — and makes Pacer feel like a real installed "app" rather than a website. It is the connective tissue between Auth and every feature slice; it consumes their data contracts but owns none of their pages.

## Depends on

- **Auth / session (foundation):** onboarding only shows after a Google/email sign-in. Build against `supabase.auth.getUser()` and the authed API client `apps/web/src/lib/api.ts`. If Auth routing isn't merged, gate onboarding behind a local `?onboarding=1` query flag so you can develop the carousel standalone.
- **Profiles slice (handle):** step 1 claims a handle. Consume the shared `Profile` zod schema and call its handle-availability + handle-claim endpoints (`GET /profiles/handle-available?handle=`, `PATCH /profiles/me`). If Profiles isn't merged, stub a `checkHandle()` that resolves `{ available: true }` after 300ms so the inline-availability UI is buildable now.
- **Groups slice (join/create):** step 2 enters a 6-char code or creates a group. Consume the shared `Group` schema and call `POST /groups/join` (`{ code }`) and `POST /groups` (`{ name }` → returns `{ code }`). If Groups isn't merged, stub both to return a fake 6-char code; the segmented-input control and copy button work against the stub.
- **Telegram slice (link code):** step 3 shows the link code + deep link `t.me/<bot>?start=<code>`. Consume `GET /telegram/link-code` (returns an 8-char code) and read the bot username from `import.meta.env.VITE_TELEGRAM_BOT`. If Telegram isn't merged, render the explainer with a placeholder code — the step is optional/skippable.
- **Habits slice (pick habits):** step 4 pre-checks Stretching + Nutrition and lets the user add custom habits. Consume the shared `Habit` schema and `POST /habits` to create the selected ones on finish. If Habits isn't merged, defer creation to a single batch call behind a feature check; the picker UI is local state until then.
- **App shell (header + tab bar):** the "?" button mounts in the shared header; coachmarks point at the existing `+` button, score chip, and Group tab. Consume the shell's documented anchor data-attributes (`data-coach="fab"`, `data-coach="score"`, `data-coach="group-tab"`); never edit the shell file — only read those anchors.

> Nothing above blocks you: every dependency has a documented endpoint contract and a local stub path. Your onboarding flow itself saves a single completion flag the moment step 1 is done, so a half-finished onboarding never re-traps the user.

## You own these files (no other card touches them)

- `supabase/migrations/<timestamp>_onboarding_state.sql` — `onboarding_state` table only.
- `packages/shared/src/onboarding.ts` — zod schema + types for onboarding/hint state.
- `apps/api/src/routes/onboarding.ts` — onboarding-state route module.
- `apps/web/src/features/onboarding/` (entire dir):
  - `OnboardingFlow.tsx` (embla carousel host)
  - `steps/StepHandle.tsx`, `steps/StepGroup.tsx`, `steps/StepTelegram.tsx`, `steps/StepHabits.tsx`
  - `CoachmarkTour.tsx`, `coachmarks.ts` (tour step config)
  - `ContextualHints.tsx`, `useContextualHint.ts` (hint framework)
  - `HowPacerWorksSheet.tsx` (the header "?" sheet)
  - `SegmentedCodeInput.tsx` (custom 6-char control)
  - `useOnboardingState.ts` (TanStack Query hook over the route above)
- `apps/web/src/pwa/`:
  - `manifest.config.ts` (manifest object passed to vite-plugin-pwa)
  - `OfflineShell.tsx`, `InstallPrompt.tsx` (A2HS phone + desktop standalone install)
  - `useInstallPrompt.ts` (captures `beforeinstallprompt`)
- `apps/web/public/icons/` — PWA icons (192/512/maskable) + `offline.html` shell.
- `apps/web/src/features/onboarding/onboarding.css` — only `@theme`-token-referencing rules; no raw color/radius/font values.

**Append-only registry lines you add (one each, never rewriting):**
- `apps/api/src/routes/index.ts` — register `onboarding` routes.
- `apps/web/vite.config.ts` — add the `VitePWA(manifestConfig)` plugin entry (append to the plugins array; do not reorder existing entries).
- `apps/web/src/App.tsx` — mount `<OnboardingFlow/>`, `<CoachmarkTour/>`, `<ContextualHints/>`, `<InstallPrompt/>` as top-level overlays (append imports + render lines).

## Foundation contracts you CONSUME (never modify)

- **Shared:** `Profile`, `Group`, `Habit` zod schemas + domain types from `packages/shared`. Do not redefine them; import. The unit/score helpers are not needed here.
- **Events:** you do not emit canonical events. You SUBSCRIBE to nothing in the API. The contextual-hint "after 3 manual logs" trigger is detected **client-side** by reading the user's run count via the existing API query (`useRuns()` count) — not by adding an API subscriber. (No `apps/api/src/subscribers/onboarding.ts` file; this slice has no cross-slice server reaction.)
- **Realtime:** none. Onboarding and hints are local/per-user state; no `broadcast()` calls.
- **Route registry:** one append-only line in `apps/api/src/routes/index.ts`.
- **Theme:** all styling references the single `@theme` token file (Tailwind v4 CSS tokens). No hardcoded `#FF5A36`, radii, or font names anywhere — use the `--color-coral`, `--radius-card`, display-font tokens.

## Build order (do these in this sequence)

1. **Migration** — `supabase/migrations/<timestamp>_onboarding_state.sql`:
   - Table `onboarding_state`: `user_id uuid pk references auth.users`, `completed_at timestamptz null`, `skipped_at timestamptz null`, `coachmarks_done_at timestamptz null`, `dismissed_hints text[] not null default '{}'`, `created_at timestamptz not null default now()`.
   - **RLS:** enable; own-rows only — `using (auth.uid() = user_id)` for select/insert/update. No group reads (this is purely personal UI state).
2. **Shared** — `packages/shared/src/onboarding.ts`:
   - `OnboardingStateSchema` (zod) mirroring the table; `OnboardingState` type.
   - `HintId` union type: `'bot-photo' | 'first-challenge'` (the two hints in the UX doc) — string literals, extendable.
   - Pure helper `shouldShowBotPhotoHint(runCount: number, dismissed: HintId[]): boolean` → `runCount >= 3 && !dismissed.includes('bot-photo')`. No I/O.
3. **API** — `apps/api/src/routes/onboarding.ts` (Hono sub-app, per-request user JWT client so RLS applies):
   - `GET /onboarding/state` → upsert-if-missing then return the row.
   - `PATCH /onboarding/state` → `@hono/zod-validator` on a partial of `OnboardingStateSchema` (allow setting `completed_at`, `skipped_at`, `coachmarks_done_at`, appending to `dismissed_hints`).
   - No events emitted, no broadcasts. Add the one registration line in `routes/index.ts`.
4. **Web** — components, custom controls only, both phone + desktop layouts:
   - **OnboardingFlow** (embla-carousel-react): 4 slides, progress dots, "Skip" allowed only after step 1 completes (handle is required). Phone: full-screen sheet. Desktop: centered dialog (~480px) using the shadcn Dialog primitive re-skinned with tokens.
   - **StepHandle:** handle + display-name inputs (react-hook-form + zod resolver on `Profile`), inline availability check (debounced `checkHandle`) with a token-colored available/taken state; on valid claim, write `PATCH /profiles/me` then allow advance.
   - **StepGroup:** custom `SegmentedCodeInput` (6 boxes, paste-aware, no native input look) for "Have a code?" → `POST /groups/join`; OR "Create a group" (name → big shareable code with a copy button + sonner "Copied" toast). Skippable.
   - **StepTelegram:** explainer copy ("text the bot 'ran 5k in 30 min' or send a photo of your watch — it logs itself"), the 8-char link code, and a deep-link button `t.me/${VITE_TELEGRAM_BOT}?start=<code>`. Optional/skippable.
   - **StepHabits:** custom toggle rows, Stretching + Nutrition pre-checked, "+ Add custom" inline. Finish → `POST /habits` for selected, `PATCH /onboarding/state {completed_at}`, route to Home, launch the tour.
   - **CoachmarkTour:** 3 sequential tooltips anchored to `data-coach="fab"` → `"score"` → `"group-tab"` (motion spring fade/scale, focus-trapped, "Got it" / dismiss); writes `coachmarks_done_at` on finish; never shows twice.
   - **ContextualHints + useContextualHint:** reads `useRuns()` count and `dismissed_hints`; renders a dismissable token-styled hint card via `shouldShowBotPhotoHint` (after 3 manual logs → bot-photo hint) and a `first-challenge` hint after joining a group. Dismiss → append to `dismissed_hints`.
   - **HowPacerWorksSheet:** opened from the header "?" anchor; a short 3-beat explainer (log → score → compete) using vaul on phone / Dialog on desktop.
   - **PWA:** `manifest.config.ts` (name "Pacer", short_name, theme/background from theme tokens, `display: standalone`, icons incl. maskable), wire `VitePWA` in `vite.config.ts` with `registerType: 'autoUpdate'`, a precache + offline-shell fallback (`offline.html`) so the app shell loads offline. `InstallPrompt` + `useInstallPrompt` capture `beforeinstallprompt` for the desktop standalone-window install and show the phone "Add to Home Screen" affordance.
   - **States:** loading skeletons on each step while the dependency call is in flight; inline error (e.g. "Handle taken", "Invalid code") with retry; the onboarding overlay itself never blocks the app if its state call fails (fail-open to the app).
   - **Polish pass (last):** a11y sweep — visible focus rings, labels/`aria-*` on every custom control (segmented input, toggles, carousel), focus trap + restore on sheets/dialogs, AA contrast on token pairs; performance check — lazy-load the onboarding bundle so it never ships to returning users, verify Lighthouse PWA "installable" passes on phone + desktop.

## Packages (ONLY these — all from the stack)

- **embla-carousel-react** — onboarding carousel slides.
- **vite-plugin-pwa** — manifest, service worker, install.
- **react-hook-form** + **@hookform/resolvers** — handle form validation.
- **zod** — shared schema validation.
- **@hono/zod-validator** — API boundary validation.
- **@tanstack/react-query** — onboarding-state fetch/cache.
- **vaul** — mobile bottom sheets.
- **shadcn/ui** (Dialog/Popover) — desktop dialog, coachmark anchors.
- **motion** — coachmark/hint spring transitions.
- **sonner** — "code copied" toast.
- **lucide-react** — step + hint icons.
- **@supabase/supabase-js** — auth check + authed client.
- **date-fns** — timestamp formatting (if needed).

## Acceptance criteria — the PR gate (copy this checklist into your PR description)

- [ ] Fresh sign-in shows the 4-step carousel; it never reappears after `completed_at`/`skipped_at` is set.
- [ ] Step 1 handle has working inline availability; Skip is disabled until a handle is claimed, enabled after.
- [ ] Step 2 segmented 6-char input joins a group and "Create a group" yields a copyable code (toast confirms).
- [ ] Step 3 renders the explainer + `t.me/<bot>?start=<code>` deep link and is skippable.
- [ ] Step 4 pre-checks Stretching + Nutrition, supports adding a custom habit, and Finish creates them + opens the coachmark tour.
- [ ] Coachmark tour points at `+` → score chip → Group tab, in order, exactly once.
- [ ] After 3 manual run logs the bot-photo contextual hint appears and is dismissable (stays dismissed).
- [ ] Header "?" opens the "How Pacer works" sheet.
- [ ] PWA installs: phone "Add to Home Screen" and desktop standalone window; offline shell loads with no network; Lighthouse "installable" passes.
- [ ] Works on both phone and desktop layouts.
- [ ] RLS: `onboarding_state` is own-rows only; verified a second user cannot read another's row.
- [ ] `pnpm typecheck` passes; no hardcoded theme values (colors/radii/fonts) — tokens only; no secrets in client (bot username via `VITE_` env only).

## How to verify locally

1. `pnpm dev`, sign in with a fresh account → onboarding carousel appears.
2. Type a handle → see availability flip live; try Skip before/after claiming (disabled → enabled).
3. Step 2: paste a 6-char code into the segmented input; then back out and "Create a group" → click copy → toast.
4. Step 3: click the Telegram deep link → opens `t.me/<bot>?start=<code>`.
5. Step 4: leave Stretching/Nutrition checked, add "10k steps", Finish → land on Home, tour starts and highlights `+`, score chip, Group tab.
6. Log 3 runs → bot-photo hint shows; dismiss → reload → it stays gone.
7. Click header "?" → "How Pacer works" sheet opens.
8. In Chrome desktop, use the install icon → standalone window opens; on a phone (or emulated), trigger "Add to Home Screen". Kill network → app shell + offline page still load.

## Out of scope for this card

- Any feature page's own teaching empty state (Calendar, Records, Challenges, Group-empty) — each feature slice owns its own; do not rewrite them.
- The Profile/Telegram/Groups/Habits **logic and pages** themselves — you only call their endpoints.
- Scoring, plans, leaderboard, feed, assistant, voice — untouched.
- Adding API subscribers, events, or broadcasts.
- Push notifications / web-push (not in this slice; not in stack).

## Copy-paste kickoff prompt for Claude

```
You are building the "Onboarding, PWA install & polish" slice of Pacer, a greenfield
fitness PWA. Build everything fresh; the only things to build against are the foundation
contracts in this repo.

OWN ONLY these files:
- supabase/migrations/<timestamp>_onboarding_state.sql
- packages/shared/src/onboarding.ts
- apps/api/src/routes/onboarding.ts
- apps/web/src/features/onboarding/** (OnboardingFlow, steps/*, CoachmarkTour, coachmarks,
  ContextualHints, useContextualHint, HowPacerWorksSheet, SegmentedCodeInput,
  useOnboardingState, onboarding.css)
- apps/web/src/pwa/** (manifest.config, OfflineShell, InstallPrompt, useInstallPrompt)
- apps/web/public/icons/** + apps/web/public/offline.html
Append-only (one line each, never reorder): apps/api/src/routes/index.ts,
apps/web/vite.config.ts (VitePWA plugin), apps/web/src/App.tsx (mount overlays).

CONSUME these contracts, never modify them: shared zod schemas Profile/Group/Habit;
the authed API client apps/web/src/lib/api.ts + TanStack Query; the app shell's coachmark
anchors data-coach="fab"|"score"|"group-tab". Build against documented endpoints
(profiles handle-available + PATCH /profiles/me, POST /groups + /groups/join,
GET /telegram/link-code, POST /habits) and stub any that aren't merged yet so you are never
blocked. This slice emits NO events, subscribes to nothing, and makes no realtime broadcasts.

BUILD ORDER: (1) migration onboarding_state with own-rows RLS; (2) shared onboarding.ts
zod schema + HintId union + pure shouldShowBotPhotoHint helper; (3) Hono onboarding route
(GET/PATCH state, @hono/zod-validator, per-request user JWT client) + the one registry line;
(4) web — embla 4-step carousel (handle w/ inline availability, segmented 6-char group code +
create/copy, Telegram deep link, habits picker pre-checking Stretching+Nutrition), coachmark
tour, dismissable contextual-hint framework (bot-photo after 3 logs), "?" How-Pacer-Works
sheet, full vite-plugin-pwa manifest+SW+offline shell + install prompt (phone A2HS + desktop
standalone); then an a11y + performance polish pass.

RULES: greenfield only; use ONLY these packages — embla-carousel-react, vite-plugin-pwa,
react-hook-form, @hookform/resolvers, zod, @hono/zod-validator, @tanstack/react-query, vaul,
shadcn/ui (Dialog/Popover), motion, sonner, lucide-react, @supabase/supabase-js, date-fns.
Theme tokens ONLY — no hardcoded colors/radii/fonts. Store nothing derived. Custom controls
only (no native checkboxes/selects). Both phone and desktop layouts. No secrets in the client.
Open a PR into dev when every acceptance-criteria box passes.
```
