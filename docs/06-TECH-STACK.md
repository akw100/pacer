# Pacer — Tech stack & packages

Concrete package choices. Criteria: actively maintained, pleasant DX, small API surface, and —
for UI — packages that produce a distinctive feel rather than a default-template look.

## Monorepo

| Concern    | Choice                                                                              |
| ---------- | ----------------------------------------------------------------------------------- |
| Workspace  | **pnpm** workspaces (`packages/shared`, `apps/api`, `apps/web`)                     |
| Language   | **TypeScript** strict everywhere; shared package consumed as raw TS (no build step) |
| Validation | **zod** — one schema per entity in `shared`, reused by API validators and web forms |
| Dates      | **date-fns** — tree-shakeable, plain functions, week-start configurable             |

## Web (`apps/web`)

| Concern | Package | Why |
| --- | --- | --- |
| Framework | **React 19 + Vite** | known quantity, fast |
| Routing | **react-router v7** | boring on purpose; the app has 5 routes |
| Server state | **@tanstack/react-query** | caching + optimistic updates; realtime events just invalidate queries |
| Styling | **Tailwind v4** (`@tailwindcss/vite`) | tokens in CSS, fast iteration |
| Component base | **shadcn/ui** (selected primitives only) | accessible Radix primitives we re-skin heavily — take Dialog, Popover, Slider; skip anything that locks in the default look |
| Bottom sheets | **vaul** | the native-feeling drawer; the Log sheet lives here |
| Toasts | **sonner** | the "+15 pts" moments; stacked, swipeable |
| Animation | **motion** (Framer Motion) | springy leaderboard reorders, card transitions |
| Animated numbers | **@number-flow/react** | scores/distances roll over odometer-style — instantly makes stats feel alive and non-generic |
| Charts | **recharts** | fine for bars/lines; styled with our tokens, no default grid look |
| Autocomplete | **cmdk** | exercise-name autocomplete from history |
| Icons | **lucide-react** | consistent stroke icons |
| Confetti | **canvas-confetti** | PRs and challenge wins only — celebration must stay rare |
| Forms | **react-hook-form** + `@hookform/resolvers` (zod) | shared schemas drive validation |
| Onboarding carousel | **embla-carousel-react** | tiny, gesture-friendly |
| PWA | **vite-plugin-pwa** | manifest + service worker; installable on phone and desktop |
| Supabase | **@supabase/supabase-js** | auth + realtime channels (anon key only) |
| Dev DX (dev-only) | **react-grab** | hover an element + Cmd/Ctrl+C copies its file/component/source for pasting into a coding agent. `devDependency`, imported only under `import.meta.env.DEV` in `index.html` — dropped from prod builds. |

## API (`apps/api`)

| Concern | Package | Why |
| --- | --- | --- |
| Framework | **Hono** + `@hono/node-server` | tiny, typed, sub-app routing |
| Validation | **@hono/zod-validator** | zod schemas at the route boundary |
| DB/auth | **@supabase/supabase-js** | two clients: service-role (trusted) + per-request user JWT (RLS) |
| Telegram | **grammY** | the modern bot framework — typed webhook handling, inline keyboards (the ✓/✗ photo confirm), file downloads for photos; far nicer than hand-rolled fetch calls |
| LLM | **openai** | the platform's single LLM provider — gpt-4o-mini structured outputs for Telegram text, gpt-4o-mini vision for watch photos, tool-calling for the in-app assistant, and the **Realtime API** (WebRTC + ephemeral tokens) for voice. Provider-agnostic JSON-schema tool layer keeps Gemini (Live API) as a drop-in alternative. |
| Dev runner | **tsx** watch (also runs production — no build step) |

## Realtime (no refresh)

**Supabase Realtime** — already in the stack, no extra socket server to host:

- One **broadcast channel per group** (`group:<id>`): after the API writes a run/workout/habit/
  reaction/score event, it broadcasts a compact event; subscribed clients invalidate the relevant
  TanStack Query keys. Self-authorized via Realtime RLS (members only).
- A **per-user channel** (`user:<id>`) so a Telegram-logged run updates the user's own open tab
  (Home chips, Today card).
- Pattern: realtime events carry *what changed*, not data — the client refetches through the
  normal API path, so RLS and derivations stay in one place.
- If Supabase Realtime ever becomes limiting, the fallback is a small WebSocket route on the Hono
  server — but don't start there.

## Design direction — "not AI-made"

The fastest tells of AI-generated UI are: default shadcn gray-on-white, Inter everywhere, purple
gradients, glassmorphism, perfectly uniform border radii, and zero personality in empty states.
Counter-programming:

1. **Type with character**: a display face for numbers and headings — **Clash Display** or
   **Cabinet Grotesk** (free via Fontshare) — paired with a quiet body face (Inter or system).
   Big stats set in the display face are the brand.
2. **Warm, specific palette**: off-white `#FAF8F5` background, ink `#1F2733`, coral `#FF5A36`
   accent, plus two supporting tones (a warm green for habits/success, a soft amber for streaks).
   No gradients as decoration.
3. **Tactile details**: chunky 16px-radius cards but *mixed* radii (pills, squircle avatars),
   1px tinted borders instead of heavy shadows, slight rotation on celebratory stickers/badges.
4. **Custom illustration in empty states**: one consistent hand-drawn-ish set (e.g. Open Peeps /
   popsy.co style, recolored to the palette) — empty states are where template UIs look most generic.
5. **Motion with opinion**: springs (motion), odometer numbers (number-flow), leaderboard rows
   that visibly swap places. Animation tied to *meaning* (points earned, rank changed), never ambient.
6. **Emoji as a first-class element**: avatars, habit icons, reactions — it keeps the family app
   warm and personal without an icon-design project.
7. **Density where it counts**: stats pages should feel rich (real numbers, small multiples),
   not like a landing page with three floating cards.

## Hosting

**Railway** — `pacer-api` (tsx, no build) + `pacer-web` (Vite build, static SPA via
`RAILPACK_SPA_OUTPUT_DIR`), `main` → production, `dev` → staging, `RAILPACK_NODE_VERSION=22`.
**Supabase** for Postgres/Auth/Realtime — separate projects for production and staging.
