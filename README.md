# Pacer

A fitness-tracking PWA for individuals and  groups.

## Live sites

- **Production:** https://pacer-web-production-b697.up.railway.app
- **Dev (staging):** https://pacer-web-staging-cc40.up.railway.app

## Develop

```sh
pnpm install
pnpm dev         # starts the API (:8787) and web (:5173) together
pnpm typecheck   # CI gate
pnpm test
```

### Google sign-in on localhost

Sign-in is Supabase OAuth. After Google, Supabase redirects back to whichever URL
is in its **Redirect URLs** allow-list; if your local origin isn't listed it falls
back to the **Site URL** (production) — that's why local sign-in can bounce you to
the prod site. One-time fix: Supabase dashboard → **Authentication → URL
Configuration → Redirect URLs** → add your local web origin
(`http://localhost:5173`). The app already requests `window.location.origin`, so
once the origin is allow-listed it returns to localhost.

> The web dev server is pinned to `5173` (`--strictPort`) so the redirect URL
> always matches the allow-list. If `5173` is taken (e.g. another project is
> running), `pnpm dev` fails fast — free the port rather than letting it drift to
> one that bounces you to production.
