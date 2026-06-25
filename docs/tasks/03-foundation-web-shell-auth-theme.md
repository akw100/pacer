# 03 — Foundation C — Web shell, auth & theme tokens

> **Stage:** Foundation  ·  **Suggested order:** 3  ·  **Size:** L  ·  **One owner builds this end to end.**

**Goal (one sentence).**
Stand up the React 19 + Vite PWA — the single theme-token file, the five routes as teaching empty pages, the responsive app shell (bottom tabs on phones / left sidebar on desktop) with the floating "+" Log button, the custom base UI primitives, and Google/email sign-in plus minimal handle creation — so every other web slice has a themed, authenticated home to render into.

**Why it matters / where it sits in the product.**
This is the chassis the whole web app hangs off: it defines the one file the team themes from, the navigation, the section-slot pattern that lets four developers drop sections into Home/Progress without colliding, and the auth boundary. Until this merges, no other web slice can render a screen.

## Depends on

- **Foundation A — `packages/shared`** (zod schemas, domain types, unit/date helpers, `scoreFor()`/`POINTS`, realtime event-type union). Consume the `Profile` zod schema and types for the handle/display-name form. *If shared isn't merged yet:* declare a local `type Profile = { handle: string; displayName: string; units: 'km' | 'mi'; weekStart: number; theme: 'light' | 'dark' }` in a `// TODO: replace with shared` block and swap the import on rebase — your sign-in and handle flow build either way.
- **Foundation B — `apps/api`** (Hono app, route registry, event bus, `broadcast`, the `/profile/me` GET/PATCH route). Consume `GET /profile/me` to load the signed-in profile and `PATCH /profile/me` to claim a handle. *If the API route isn't merged yet:* point the fetch client at a stubbed handler (return a fake profile) behind one `const USE_STUB` flag; the screens and routing are fully testable, and you delete the stub on rebase. Auth itself does not depend on the API — Supabase Auth runs client-side.
- **Supabase project** (anon key + URL via env). Auth and the browser client work independently of the API.

## You own these files (no other card touches them)

```
apps/web/index.html
apps/web/vite.config.ts
apps/web/tsconfig.json
apps/web/package.json
apps/web/public/                          (icons placeholder dir only; full manifest = PWA card)
apps/web/src/main.tsx
apps/web/src/App.tsx                       (router + providers)
apps/web/src/theme/tokens.css              ← THE single theme-token file
apps/web/src/theme/fonts.css
apps/web/src/index.css                     (Tailwind v4 entry + @theme import)
apps/web/src/lib/api.ts                    ← API fetch client (shell-owned; slices import it)
apps/web/src/lib/supabase.ts               (browser client, anon key only)
apps/web/src/lib/queryClient.ts
apps/web/src/app/AppShell.tsx              (tab bar / sidebar + "+" button)
apps/web/src/app/BottomTabs.tsx
apps/web/src/app/Sidebar.tsx
apps/web/src/app/LogButton.tsx             (floating "+", opens a placeholder sheet)
apps/web/src/app/SectionSlots.tsx          ← append-only slot registry for Home/Progress
apps/web/src/app/RequireAuth.tsx
apps/web/src/components/ui/Button.tsx
apps/web/src/components/ui/Card.tsx
apps/web/src/components/ui/Toggle.tsx
apps/web/src/components/ui/Segmented.tsx
apps/web/src/components/ui/Select.tsx
apps/web/src/components/ui/Sheet.tsx        (vaul wrapper, themed)
apps/web/src/components/ui/EmptyState.tsx
apps/web/src/components/ui/index.ts
apps/web/src/features/auth/SignInPage.tsx
apps/web/src/features/auth/ClaimHandlePage.tsx
apps/web/src/features/auth/useSession.ts
apps/web/src/routes/HomePage.tsx           (shell + slot host; sections come from other cards)
apps/web/src/routes/ProgressPage.tsx       (shell + slot host)
apps/web/src/routes/GroupPage.tsx          (empty teaching state)
apps/web/src/routes/ChallengesPage.tsx     (empty teaching state)
apps/web/src/routes/ProfilePage.tsx        (empty teaching state)
```

**Append-only files you create but others extend** (you ship the file + the registry; other cards add ONE line each):
- `apps/web/src/app/SectionSlots.tsx` — exports `homeSlots` / `progressSlots` arrays; slices push their section component via one line.

## Foundation contracts you CONSUME (never modify)

- **`packages/shared`**: `Profile` zod schema + type. (Unit/date/score helpers exist here too — you don't use them, but slices rendering into your slots will; do not duplicate them.)
- **`apps/api` route registry** (`apps/api/src/routes/index.ts`): you do NOT add a route — `/profile/me` is owned by Foundation B. You only call it.
- **Realtime**: NOT built here, and NOT part of the MVP. Live updates (channel subscriptions → query invalidation) are owned entirely by the Groups card (07). This card ships no realtime client.
- **Events bus / subscribers** (`apps/api/src/subscribers/*`): not touched by this card — purely a web slice.
- **Section slots**: you DEFINE the slot arrays. Home/Progress section owners append one import + one `homeSlots.push(...)` line in their own follow-up — never edit your page bodies.

## Build order (do these in this sequence)

1. **Migration** — *none.* This card creates no tables. The `profiles` table + RLS (own-row read/write) belong to a foundation/profile card; you consume `/profile/me`. Do not write a migration.

2. **Shared** — *consume only.* Import `Profile` from `packages/shared`. The only pure logic here is form-side: a `handle` regex/length guard (3–20 chars) mirrored from the shared schema via `Profile.shape.handle` — do not invent a second source of truth.

3. **API** — *consume only, emit nothing.* No new routes, no events, no broadcast emission from this card. No realtime client either — that's the Groups card (07).

4. **Web** — build in this order:
   1. `theme/tokens.css` + `theme/fonts.css` + `index.css`: Tailwind v4 `@theme` block. Define ALL tokens as CSS variables — colors `--color-bg #FAF8F5`, `--color-ink #1F2733`, `--color-coral #FF5A36`, plus the two supporting tones (warm green for habits/success, soft amber for streaks), surface/border tints; radii (`--radius-card 16px`, pill, squircle); type scale binding **Clash Display / Cabinet Grotesk** (display, for numbers/headings via `@number-flow` later) and **Inter** (body) loaded from Fontshare in `fonts.css`. Dark-mode token set under a `.dark` selector. This file is the team's single theme source — everything else references `var(--…)` / Tailwind token classes, never hex.
   2. Providers in `App.tsx`: `QueryClientProvider` (from `lib/queryClient.ts`), router, `<Toaster />` (sonner, themed via tokens).
   3. `lib/supabase.ts` (anon key from `import.meta.env`), `lib/api.ts` (typed `fetch` wrapper attaching the Supabase JWT; throws typed errors for TanStack Query).
   4. Base UI primitives in `components/ui/*` — re-skin only the Radix primitives the stack allows (Dialog, Popover, Slider via shadcn/ui): **Toggle**, **Segmented**, **Select** (NO native checkbox/dropdown), **Card**, **Button**, **Sheet** (vaul), **EmptyState**. All token-driven, light/dark aware.
   5. App shell: `AppShell.tsx` renders `BottomTabs` under a `md:` breakpoint and `Sidebar` above it (sidebar = logo top, 5 destinations, "+ Log" full button, profile bottom — per §Desktop layouts). `LogButton` floats on phones / is the sidebar button on desktop; opens a placeholder Sheet ("Logging lives here — Log card owns this") so it's wired but not built.
   6. Routes (react-router v7): `/` Home, `/progress`, `/group`, `/challenges`, `/profile`. Home/Progress render `SectionSlots` hosts (map over `homeSlots`/`progressSlots`, render nothing-but-empty-state if no sections). Group/Challenges/Profile ship **teaching empty states** verbatim in spirit from the UX doc ("No group yet — create one and share the code with your family", Challenges "Challenge your group to anything — even a YouTube workout video").
   7. Auth: `SignInPage` (single card — logo, "Track workouts. Compete with your family.", **Continue with Google** primary, email fallback behind a small link), `ClaimHandlePage` (handle + display name with inline availability check via `PATCH /profile/me`), `useSession`/`RequireAuth` gating all five routes; unauthenticated → SignIn, authed-without-handle → ClaimHandle.
   8. `vite-plugin-pwa` as a **stub** (registerType auto, minimal placeholder manifest, no icons) — leave a `// PWA card owns the full manifest` comment. Install + theme `vaul`, `sonner`, `motion`.

## Packages (ONLY these — all from the stack)

- **react** + **react-dom** — app framework
- **vite** + **@vitejs/plugin-react** — dev/build tooling
- **react-router** — five routes
- **@tanstack/react-query** — server-state cache
- **tailwindcss** + **@tailwindcss/vite** — token styling
- **shadcn/ui** (Radix primitives only) — accessible base to re-skin
- **vaul** — bottom-sheet primitive
- **sonner** — toasts
- **motion** — shell/route transitions
- **lucide-react** — tab/nav icons
- **@supabase/supabase-js** — auth + browser client
- **vite-plugin-pwa** — stub registration
- **zod** — handle-form guard from shared schema
- **typescript** — strict types

## Acceptance criteria — the PR gate (copy this checklist into your PR description)

- [ ] Sign in with Google completes on a phone-sized viewport and returns to the app authenticated.
- [ ] Email fallback sign-in works from the collapsed link.
- [ ] A new user with no handle lands on Claim-handle; claiming a 3–20 char handle + display name succeeds via `PATCH /profile/me` and routes to Home.
- [ ] All five tabs navigate; Group/Challenges/Profile show teaching empty states; Home/Progress render their slot hosts (empty-state when no sections registered).
- [ ] Bottom tab bar shows on phone widths; left sidebar shows on desktop widths — both first-class, not a stretched copy.
- [ ] Floating "+" Log button is present on every authed screen and opens the placeholder sheet.
- [ ] `SectionSlots.tsx` exposes append-only `homeSlots`/`progressSlots` arrays; adding a section is one push line (demonstrate with a throwaway dummy, then remove it).
- [ ] Every color/radius/font traces to a token in `theme/tokens.css` — `grep` finds no raw hex / px-radius / font-family in components.
- [ ] Light and dark token sets both render correctly.
- [ ] `pnpm -w typecheck` passes; no `any` at the auth/api boundary.
- [ ] No secrets committed — only `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` via env; `.env.example` added.
- [ ] vite-plugin-pwa registers as a stub (no full manifest/icons) with a comment deferring to the PWA card.

## How to verify locally

1. `pnpm install` at the workspace root, then `pnpm --filter @pacer/web dev`.
2. Open the app on a narrow viewport (DevTools device toolbar or a real phone on the LAN URL). You should see the **Sign-in card**.
3. Click **Continue with Google**, complete OAuth → you return authenticated. Because you have no handle, you land on **Claim your handle**. Enter a handle + display name → routed to **Home**.
4. Confirm the **bottom tab bar** is visible; tap each of the 5 tabs — Home/Progress show empty slot hosts, Group/Challenges/Profile show teaching empty states. Tap the floating **+** → placeholder Log sheet opens.
5. Resize to desktop width: the bottom tabs are replaced by the **left sidebar** with the "+ Log" full button; navigation still works.
6. Toggle `.dark` on `<html>` (or the theme control if wired) → palette switches with no broken colors.

## Out of scope for this card

- The `profiles` table/migration and the `/profile/me` API route (owned by foundation/profile + Foundation B) — you consume them.
- Any real Log form (Run/Workout/Habits), Home/Progress *sections*, Group/Challenge/Profile content, scoring, charts — other slices fill the slots and pages.
- Full PWA manifest, icons, offline strategy, install prompts (PWA/Onboarding card).
- The onboarding carousel (group join/create, Telegram link, habit pick), coachmark tour, assistant panel.
- Unit/date/score helpers — they live in `packages/shared`; never reimplement.

## Copy-paste kickoff prompt for Claude

```
You are building ONE slice of Pacer, a greenfield fitness-tracking PWA. Build everything fresh; the
only things to build against are the foundation contracts in this repo. pnpm monorepo:
packages/shared (raw TS), apps/api (Hono), apps/web (React 19 + Vite).

SLICE: Foundation C — Web shell, auth & theme tokens.

YOU OWN (create only these; never edit another slice's files):
  apps/web/{index.html,vite.config.ts,tsconfig.json,package.json}
  apps/web/src/{main.tsx,App.tsx,index.css}
  apps/web/src/theme/{tokens.css,fonts.css}
  apps/web/src/lib/{api.ts,supabase.ts,queryClient.ts}
  apps/web/src/app/{AppShell,BottomTabs,Sidebar,LogButton,SectionSlots,RequireAuth}.tsx
  apps/web/src/components/ui/{Button,Card,Toggle,Segmented,Select,Sheet,EmptyState,index}.ts(x)
  apps/web/src/features/auth/{SignInPage,ClaimHandlePage,useSession}.ts(x)
  apps/web/src/routes/{Home,Progress,Group,Challenges,Profile}Page.tsx

CONSUME (never modify): the shared `Profile` zod schema/type from packages/shared; the API
`GET/PATCH /profile/me` route from apps/api (owned by Foundation B). If either isn't merged yet,
stub it behind one flag and swap on rebase — your screens build either way. Supabase Auth runs
client-side (anon key only).

RULES:
- GREENFIELD. Only the packages listed in 06-TECH-STACK.md: react, react-dom, vite,
  @vitejs/plugin-react, react-router, @tanstack/react-query, tailwindcss, @tailwindcss/vite,
  shadcn/ui (Radix primitives only), vaul, sonner, motion, lucide-react, @supabase/supabase-js,
  vite-plugin-pwa, zod, typescript. If you think you need anything else, STOP and write
  "⚠️ NEEDS TEAM DECISION: <pkg> for <reason>" instead of adding it.
- THEME: put EVERY color/radius/font as a CSS variable in apps/web/src/theme/tokens.css (warm
  palette #FAF8F5 bg / #1F2733 ink / #FF5A36 coral + warm-green success + soft-amber streak;
  16px card radius + pill/squircle; Clash Display / Cabinet Grotesk display + Inter body from
  Fontshare). Components reference tokens only — NEVER hardcode a hex/px-radius/font-family.
  Include a .dark token set.
- Custom controls only: Toggle / Segmented / Select must NOT use native checkbox/dropdown;
  re-skin only the shadcn/ui Radix primitives the stack allows.
- Two first-class form factors: bottom tab bar on phones, left sidebar on desktop — not a
  stretched mobile view. Floating "+" Log button on every authed screen (opens a placeholder
  sheet; the real Log form is another card's).
- SectionSlots.tsx exposes append-only homeSlots/progressSlots arrays; Home/Progress map over
  them. Other cards add their section with ONE push line — never edit your pages.
- vite-plugin-pwa is a STUB here (no full manifest/icons); leave a comment deferring to the PWA card.

BUILD ORDER: tokens.css + fonts.css + index.css → providers in App.tsx (QueryClient, router,
sonner Toaster) → supabase.ts + api.ts → UI primitives → AppShell (tabs/sidebar +
LogButton) → 5 routes with teaching empty states (verbatim spirit from 02-PAGES-UX.md) →
auth (SignInPage Google-primary + email fallback, ClaimHandlePage with inline availability check,
useSession/RequireAuth gating) → vite-plugin-pwa stub.

GATE: on a phone — sign in with Google, claim a handle, navigate all five tabs; resize to desktop
and confirm the sidebar replaces the tabs. typecheck passes, no hardcoded theme values, no secrets
(only VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY via env + .env.example).

Open a PR into `dev` when every acceptance-criteria box passes.
```
