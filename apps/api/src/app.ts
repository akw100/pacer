import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppEnv } from './lib/auth';
import { requireAuth } from './lib/auth';
import { env } from './lib/env';
import { registerRoutes } from './routes';
import './subscribers'; // import for registration side-effects (wires bus handlers)

// Path prefixes that skip auth. Everything else requires a valid bearer JWT.
// /webhook is reserved for the Telegram card's public webhook route.
// /internal is for service-to-service callbacks (e.g. the frames worker) — these
// carry no user JWT and are gated by a shared INTERNAL_TOKEN inside the handler.
// /public is anonymous, numbers-only community stats for the marketing landing.
const PUBLIC_PATH_PREFIXES = ['/health', '/webhook', '/internal', '/public'] as const;

function isPublicPath(path: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', cors({ origin: env.webOrigin, credentials: true }));

  // Global auth guard: authenticate every request except the public prefixes.
  app.use('*', (c, next) =>
    isPublicPath(c.req.path) ? next() : requireAuth(c, next),
  );

  registerRoutes(app);

  return app;
}

export const app = createApp();
