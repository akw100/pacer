# Design — Google sign-in + handle selection (web)

Date: 2026-06-25
Card: Foundation C (web shell / auth / theme) — **only** the Google-login + handle-selection slice.
Branch: `feat/03-web-google-auth` → PR into `dev`.

## Goal

A visitor opens the PWA, taps **Continue with Google**, and — if they have not yet
claimed a handle — is routed to a **Claim your handle** screen before reaching the app.
Authenticated users with a handle land on the existing Home shell. Everything typechecks
and runs locally; the live Google round-trip depends on Supabase dashboard config (below).

## Scope

In:
- Google OAuth via Supabase (`signInWithOAuth`).
- Session state + auth-gated routing.
- "Claim your handle" screen (handle + display name) with inline format validation and
  save via the existing `PATCH /profile/me`.
- Sign-out on the existing Profile screen.

Out (later cards / not this PR):
- Email/magic-link fallback (Google-only this PR).
- Onboarding steps 2–4 (join group, Telegram, habits) and coachmarks.
- A live handle-availability endpoint (none exists; not editing Foundation B's route).

## Existing state (on `dev`)

The web shell is already scaffolded: Vite 6 + React 19, `react-router` v8 router in
`src/App.tsx`, `components/Nav.tsx`, five `screens/*`, Tailwind v4 with `src/theme/tokens.css`,
fonts wired in `index.html`. Missing for auth: `@supabase/supabase-js`, `@tanstack/react-query`.

The API (Foundation B) exposes `GET /profile/me` and `PATCH /profile/me`, both behind a
Supabase bearer-JWT middleware (`Authorization: Bearer <access_token>`).

## Architecture

```
apps/web/
  .env.example                       VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY · VITE_API_URL (names only)
  src/
    lib/supabase.ts                  browser anon client from import.meta.env (anon key ONLY)
    lib/api.ts                       apiFetch(path, {token}) — base URL + bearer + JSON
    app/queryClient.ts               single QueryClient
    features/auth/
      AuthProvider.tsx               session context via supabase.auth + onAuthStateChange
      useProfile.ts                  react-query GET /profile/me; derives needsHandle
      SignInPage.tsx                 logo, value prop, Continue with Google
      ClaimHandlePage.tsx            handle + display name, inline validation, save
    main.tsx        (edit)           wrap <QueryClientProvider><AuthProvider> around <App/>
    App.tsx         (edit)           add /signin + /onboarding/handle routes; guard the Shell
    screens/Profile.tsx (edit)       add a Sign out action
```

### Data flow
1. `AuthProvider` reads the current Supabase session on mount and subscribes to
   `onAuthStateChange`. Exposes `{ session, loading, signInWithGoogle, signOut }`.
2. A `RequireAuth` guard wraps the Shell route:
   - `loading` → render nothing (or a spinner).
   - no `session` → `<Navigate to="/signin">`.
   - session present → `useProfile()` runs `GET /profile/me` with the access token.
     - `needsHandle` (404 **or** row with empty/null `handle`) → `<Navigate to="/onboarding/handle">`.
     - otherwise → render the app.
3. `SignInPage`: `signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`.
   On return, Supabase restores the session; the guard re-evaluates.
4. `ClaimHandlePage`:
   - Local controlled inputs. Handle lower-cased live; validated against
     `ProfileSchema.shape.handle` (3–20, `[a-z0-9_]`) from `@pacer/shared`. Display name non-empty.
   - Save → `PATCH /profile/me { handle, displayName }` with bearer token.
     - success → invalidate the profile query → guard routes to `/`.
     - unique-violation / 4xx → inline error ("That handle is taken — try another.").

### Error handling
- Missing `VITE_` env → `lib/supabase.ts` throws a clear startup error (fail fast, no silent anon).
- `GET /profile/me` 404 is treated as "no profile yet" (needs handle), not a hard error.
- `PATCH` failures surface inline on the handle screen; the user can retry.

### Theming
All visuals reference existing tokens in `src/theme/tokens.css` (`bg-surface`, `text-ink`,
`text-accent`, `rounded-card`, `font-display`). No raw hex / px radius in components.

## Known external dependencies (not built here)
1. **Supabase dashboard**: enable the Google provider and add redirect URLs; developers fill
   real `VITE_` values in a local `.env`. Live login is untestable until this is done.
2. **DB / auth trigger (Foundation B)**: `PATCH /profile/me` performs an `UPDATE`, so it assumes
   the signup trigger already inserted the caller's `profiles` row. If no row exists, the save
   fails — that is Foundation B's migration to provide. The guard tolerates both a 404 and a
   null-handle row for routing, but the browser cannot create the row itself.

## Verification
- `pnpm install` then `pnpm typecheck` green across all workspaces (the CI gate).
- `pnpm --filter @pacer/web dev` boots; `/signin` renders with the Google button.
- With dashboard configured + local `.env`: Google round-trip → first-time user sees
  Claim-your-handle → save → Home; returning user with a handle skips straight to Home;
  sign-out returns to `/signin`.
