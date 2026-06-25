# 14 — Voice assistant (post-v1, optional, LAST)

> **Stage:** Post-MVP  ·  **Suggested order:** 13  ·  **Size:** M  ·  **One owner builds this end to end.**

**Goal (one sentence).** Let a user *talk* to the Pacer assistant — tap a mic, speak "log a run, five k, 28 minutes, this morning" and watch the Log form fields fill live, say "save it" to commit the visible form — by minting an ephemeral OpenAI Realtime token server-side and wiring the browser to the OpenAI Realtime API over WebRTC against the **same tool layer** the chat assistant already uses.

**Why it matters / where it sits in the product.** Voice is the second stage of the Pacer Assistant (specs §9). It ships strictly **after** the chat assistant because chat proves the provider-agnostic tool layer first; this card adds a speech-to-speech front end on top of that proven layer and a live, on-screen form-fill so logging by voice feels trustworthy (you save what you *see*, never an unseen guess). It is explicitly optional polish — the app is fully functional without it.

## Depends on
This card depends on the assistant tool layer card (card 10), which defines the shared assistant tool specs and the server-side tool executor. It also has a narrow dependency on the chat card (card 12) for the assistant-panel mount slot only. Build against these contracts so you are never blocked:

- **The shared tool definitions** (`log_run`, `log_workout`, `check_habit`, `create_challenge`, `get_stats`, `get_leaderboard`, `navigate`) live in `packages/shared/src/assistant/tools.ts` as provider-agnostic JSON-schema tool specs (owned by card 10). **Build against the exported spec array/type.** If card 10 hasn't merged yet, define a *local placeholder* tool spec inside your own `voice` feature folder with the same shape, and swap the import for the shared one once it lands — your file boundaries don't change.
- **The server-side tool executor** — `executeTool()` in `apps/api/src/lib/assistant/index.ts` (owned by card 10) — executes a tool call against the existing API handlers with the caller's user JWT, so RLS + scoring + realtime apply unchanged. The voice WebRTC session's function-calls are routed to this same executor. If it isn't merged, your voice token endpoint and the client mic UI still work end-to-end for `set_form_field` (a *client-side* tool that needs no server) and for spoken stats answers can be stubbed until the executor lands.
- **Run/workout/habit zod schemas + unit helpers** in `packages/shared` (m/s → km/mi/pace). The `set_form_field` tool fills the Log form's *raw* inputs; the form itself already converts display → canonical meters/seconds via these helpers when it saves. You consume them; you do not store anything yourself.
- **The Log sheet** (vaul drawer) and **the assistant panel** are owned by other cards. You DO NOT edit their logic. You consume two append-only slots they expose (see Foundation contracts) to drop in a mic toggle and to read/write the form's draft fields through a provided controller — never by reaching into their internals.
- **`apps/web/src/lib/api.ts`** (API client + TanStack Query). You add one typed call for the voice-token endpoint via the existing client; you do not restructure it.

No database tables, no migration, no event-bus subscriber. Voice is stateless: a token mint + a browser session. (Thread history stays client-side, same as chat.)

## You own these files (no other card touches them)
- `apps/api/src/routes/assistant-voice.ts` — the `POST /assistant/voice-token` route module (ephemeral token mint).
- `apps/web/src/features/voice/` — entire folder:
  - `apps/web/src/features/voice/useRealtimeVoice.ts` — WebRTC session hook (connect, mic stream, data-channel tool dispatch, teardown).
  - `apps/web/src/features/voice/MicToggle.tsx` — the custom mic button (idle / connecting / listening / speaking states).
  - `apps/web/src/features/voice/setFormFieldTool.ts` — the client-side `set_form_field` tool spec + dispatcher to the active form controller.
  - `apps/web/src/features/voice/voiceClient.ts` — typed `mintVoiceToken()` call + Realtime SDP/data-channel plumbing.
  - `apps/web/src/features/voice/voiceTools.ts` — assembles the tool set handed to the Realtime session (imports shared specs; adds `set_form_field`).
  - `apps/web/src/features/voice/types.ts` — local types for session state + the form-controller interface.
- `apps/api/src/__tests__/assistant-voice.test.ts` and `apps/web/src/features/voice/__tests__/*` — tests for the above.

**Append-only lines you add (shared files, one line each, never rewrite surrounding code):**
- `apps/api/src/routes/index.ts` — one registration line for the voice route.
- The assistant panel's slot file and the Log sheet's slot file — one `<MicToggle … />` mount line each, into the append-only mount slot those cards expose.

## Foundation contracts you CONSUME (never modify)
- **Shared package:** the assistant tool specs + the `Run`/`Workout`/habit zod schemas + the m/s→km/mi/pace + date helpers. Import only; never redefine.
- **Server tool executor** — `executeTool()` in `apps/api/src/lib/assistant/index.ts` (from card 10, the assistant tool layer): the voice session's function-calls are dispatched through it so RLS, scoring, and realtime broadcasts happen exactly as if the UI made the call. You call it; you do not change it.
- **Event bus:** none. Voice emits no domain events and subscribes to none — it drives the *existing* tool layer, which already emits `run.logged` / `workout.logged` / `habit.checked` / `challenge.updated` on its own.
- **`broadcast()` / realtime:** none added here. Saving via the tool layer triggers the existing broadcasts; the mic UI just invalidates the same TanStack Query keys the chat path already invalidates.
- **Route registry:** one append-only line in `apps/api/src/routes/index.ts`.
- **Web section/mount slots:** one append-only mount line in the assistant panel slot and one in the Log sheet slot. No other web surface is touched.

## Build order (do these in this sequence)
1. **Migration** — **NONE.** Voice adds no tables, columns, or RLS policies. The only secret it relies on is the server's existing `OPENAI_API_KEY` (already configured for Telegram/chat) — it is read in the route and **never** sent to the browser. Confirm no new env var is needed beyond that key and the existing Supabase user-JWT plumbing.
2. **Shared** — **No new schemas.** You consume the existing assistant tool specs and the run/workout/habit schemas + unit helpers. (If you needed a brand-new shared type you would add it under `packages/shared/src/...`, but this slice does not — keep it empty to avoid merge surface.)
3. **API** — `POST /assistant/voice-token`:
   - Authenticated route (per-request user JWT, same middleware as the rest of the API). Reject anonymous callers.
   - Server calls OpenAI to mint a **short-lived ephemeral Realtime client secret** (the real `OPENAI_API_KEY` stays server-side), specifying the Realtime model and the session config (modalities = audio+text, the tool specs from shared, an instructions/system prompt tuned for terse fitness logging). Return only the ephemeral token + its expiry + the model id to the client.
   - Validate nothing inbound beyond auth (no body, or an optional `{ context: 'log' | 'assistant' }` hint validated with `@hono/zod-validator` to bias the system prompt toward form-filling vs. Q&A).
   - **Emits no events. Broadcasts nothing.** Add the one registration line in `routes/index.ts`.
4. **Web** — the mic experience:
   - `useRealtimeVoice.ts`: on mic-tap, call `mintVoiceToken()`, open a WebRTC peer connection to the OpenAI Realtime API using the ephemeral token, attach the local mic `MediaStream`, attach an `<audio>` sink for the model's spoken replies, and open the data channel for events/tool-calls. Surface a small state machine: `idle → requesting-token → connecting → listening → speaking → error → idle`.
   - **Tool dispatch over the data channel:**
     - `set_form_field` (client-side, in `setFormFieldTool.ts`): args `{ field, value }`. It writes into the **active form controller** (the interface in `types.ts`) so the Log form's distance → time → date fields populate live as speech is parsed, each flashing on update (a brief highlight via the theme token + a `motion` spring). It does **not** save.
     - All other tools (`log_run`, `get_stats`, …): hand the function-call to the server tool executor (`executeTool()` from card 10) and return its result to the Realtime session so the model can speak the answer (e.g. stats questions get **spoken** answers).
   - **"Save it" semantics:** the model has NO auto-save tool. "save it" maps to the model calling a final `set_form_field`-free *commit intent* that simply triggers the **visible** form's existing submit (the same submit a tapping user would press) — committing exactly what is on screen. Never write an unseen draft.
   - `MicToggle.tsx`: a **custom** button (no native control) with the four visible states, an animated listening indicator (`motion`), and a `lucide-react` mic icon. Mounts in both the assistant panel and the Log sheet via the append-only slots.
   - **Both form factors:** phone — mic toggle sits in the Log sheet (vaul) header and in the assistant panel's input row, thumb-reachable. Desktop — mic toggle in the assistant sidebar panel and the Log dialog header. The live-fill highlight and listening animation read on both.
   - **Teaching empty state:** before first use, the mic toggle shows a one-line coach hint ("Tap and say: 'log a 5k run, 28 minutes, this morning'") and, on permission denial, a clear inline state explaining mic access is needed (with a retry).
   - **Loading / error states:** token-mint spinner on the toggle; a non-blocking `sonner` toast on connection failure or expired token (offer "try again"); graceful teardown that releases the mic on close, navigation, or error.
   - **Provider note (document, don't build):** add a short comment block in `voiceClient.ts` stating that **Gemini Live API** is the documented drop-in alternative — the tool set is provider-agnostic JSON-schema, so only the transport (token mint + WebRTC/SDK wiring) would change. Do not implement Gemini.

## Packages (ONLY these — all from the stack)
- **openai** — mint Realtime ephemeral token.
- **@hono/zod-validator** — validate optional body.
- **@supabase/supabase-js** — per-request user JWT.
- **@tanstack/react-query** — invalidate after save.
- **vaul** — mic lives in Log sheet.
- **sonner** — connection/error toasts.
- **motion** — listening + field-flash springs.
- **lucide-react** — mic icon.
- **zod** — share-schema reuse.

(Realtime WebRTC uses the browser's built-in `RTCPeerConnection` / `getUserMedia` — no extra package. No new package is introduced by this card.)

## Acceptance criteria — the PR gate (copy this checklist into your PR description)
- [ ] `POST /assistant/voice-token` requires auth, mints a **short-lived ephemeral** OpenAI Realtime token, and the response NEVER contains `OPENAI_API_KEY` or any long-lived secret.
- [ ] Tapping the mic in the **Log sheet** (phone + desktop) starts a Realtime session; speaking distance/time/date fills the **visible** form fields live, each flashing as captured.
- [ ] Saying "save it" submits the **on-screen** form (same path as a manual submit) — nothing is written that the user didn't see; there is no auto-save tool.
- [ ] Stats questions ("how far did I run this month?") return a **spoken** answer, routed through the shared server tool executor (RLS/scoring honored).
- [ ] Mic toggle is a **custom** control with idle/connecting/listening/speaking states; mic permission denial shows a clear inline state with retry.
- [ ] Mic stream and peer connection are **torn down** on close, route change, expiry, and error (no hot-mic leak).
- [ ] Works in both phone and desktop layouts (Log sheet/dialog + assistant panel/sidebar).
- [ ] No new tables, no migration, no event-bus subscriber, no new broadcast.
- [ ] No hardcoded colors/radii/fonts — flash highlight and states use theme tokens only.
- [ ] `set_form_field` is **client-side**; write-tools go through the existing executor, not a new write path.
- [ ] `voiceClient.ts` documents Gemini Live API as the provider-agnostic drop-in alternative.
- [ ] `pnpm typecheck` passes across `shared`, `api`, `web`; only the listed packages are imported; only the append-only lines were added to shared files.
- [ ] Opens a PR into `dev`.

## How to verify locally
1. Ensure `OPENAI_API_KEY` is set for `apps/api` (the existing chat/Telegram key) and Supabase user-JWT auth works locally.
2. `pnpm dev` (api + web). Sign in.
3. Open the **Log** sheet on desktop; click the mic toggle → grant mic permission → see it move to *listening*.
4. Say: "log a run, five kilometers, twenty-eight minutes, this morning." Watch distance → time → date fields populate and flash in order. The form is filled but **not** saved.
5. Say "save it." The run saves through the normal path; a "+pts" `sonner` toast fires and Home score/streak chips update (existing realtime/invalidation).
6. Resize to phone width; repeat from the Log vaul sheet — confirm the toggle is thumb-reachable and the fill animation reads.
7. In the assistant panel, tap mic and ask "how far did I run this month?" → hear a **spoken** answer.
8. Deny mic permission once → see the inline access state + retry. Close the sheet mid-session → confirm the mic indicator (OS) turns off (teardown).

## Out of scope for this card
- The chat assistant endpoint and the SSE tool-calling loop (chat card / card 12 owns these). The **definition** of the shared tool specs (`packages/shared/src/assistant/tools.ts`) and the server tool executor (`executeTool()` in `apps/api/src/lib/assistant/index.ts`) — card 10, the assistant tool layer, owns these; you consume them.
- Any new assistant tool beyond the client-side `set_form_field` and the existing shared tools.
- The Log form's fields, validation, and submit logic (logging card owns it — you only fill/submit via its exposed controller).
- The assistant panel's chat UI/layout (you only mount a mic toggle into its slot).
- Telegram voice/photo, nudges, or any bot work.
- Persisting transcripts or conversations (no tables — thread history stays client-side, same as chat).
- Implementing **Gemini Live** — only document it as the drop-in alternative.
- Any scoring/score-event writing (it happens inside the executor's tool calls, not here).

## Copy-paste kickoff prompt for Claude
```
You are building ONE slice of Pacer, a greenfield fitness PWA (pnpm monorepo: packages/shared, apps/api, apps/web). Build everything fresh; the only things to build against are the foundation contracts in this repo.

SLICE: Voice assistant (post-v1, optional). Add speech-to-speech voice to the Pacer assistant on top of the EXISTING chat tool layer. Greenfield, TypeScript strict.

YOU OWN (create/edit only these):
- apps/api/src/routes/assistant-voice.ts            (POST /assistant/voice-token: mint short-lived ephemeral OpenAI Realtime token; auth required; real OPENAI_API_KEY never leaves the server)
- apps/web/src/features/voice/  (whole folder: useRealtimeVoice.ts, MicToggle.tsx, setFormFieldTool.ts, voiceClient.ts, voiceTools.ts, types.ts)
- tests: apps/api/src/__tests__/assistant-voice.test.ts, apps/web/src/features/voice/__tests__/*
APPEND-ONLY (one line each, never rewrite surrounding code):
- apps/api/src/routes/index.ts          (register the voice route)
- the assistant panel slot file + the Log sheet slot file  (mount <MicToggle/> into their append-only slots)

CONSUME (never modify): the shared provider-agnostic assistant tool specs (packages/shared/src/assistant/tools.ts) + the server tool executor (executeTool() in apps/api/src/lib/assistant/index.ts) — both owned by the assistant tool layer card (card 10); the Run/Workout/habit zod schemas + m/s→km/mi/pace + date helpers in packages/shared; apps/web/src/lib/api.ts + TanStack Query; the Log form's exposed controller interface (mount the assistant-panel slot from the chat card / card 12).

BUILD ORDER:
1. NO migration, NO new shared schema, NO event subscriber, NO new broadcast. Reuse the existing OPENAI_API_KEY only.
2. API: POST /assistant/voice-token — authenticated (per-request user JWT), validate optional {context:'log'|'assistant'} with @hono/zod-validator, mint an ephemeral OpenAI Realtime client secret with the shared tool specs + a terse-logging system prompt, return only {ephemeral token, expiry, model}. Add the one registration line.
3. Web: useRealtimeVoice opens a WebRTC session (browser RTCPeerConnection + getUserMedia, no extra package) using the ephemeral token; data-channel tool dispatch. set_form_field is a CLIENT-side tool that fills the VISIBLE Log form's fields live (distance→time→date), each flashing via theme token + a motion spring — it never saves. All other tools route to the existing server executor (stats answers are SPOKEN). "save it" submits the on-screen form via its existing submit (no auto-save tool, never write an unseen draft). MicToggle is a custom control (idle/connecting/listening/speaking) with a lucide mic icon, mounted in BOTH the Log sheet (vaul) and the assistant panel, phone + desktop. Teaching empty-state coach hint; mic-denied inline state + retry; sonner toast on failure; full teardown on close/route-change/expiry/error.
4. Document in voiceClient.ts that Gemini Live API is the provider-agnostic drop-in alternative (do NOT implement it).

RULES: only these packages — openai, @hono/zod-validator, @supabase/supabase-js, @tanstack/react-query, vaul, sonner, motion, lucide-react, zod. No others. Theme tokens only (no hardcoded colors/radii/fonts). Canonical units are meters/seconds — the form converts via shared helpers; you only fill/submit. No secrets in any client response.

Open a PR into `dev` when every acceptance-criteria box passes.
```
