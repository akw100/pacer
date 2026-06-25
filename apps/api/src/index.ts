import { serve } from '@hono/node-server';
import { app } from './app';
import { env } from './lib/env';
import { botMode, botEnabled } from './telegram/env';
import { startPolling, startWebhook } from './telegram/bot';

// Server entry. tsx runs this directly in dev (watch) and in production — no
// build step. The app assembly lives in app.ts so it can be imported for tests
// without binding a port.
serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`[pacer-api] listening on http://localhost:${info.port}`);
});

if (botEnabled() && botMode() === 'polling') {
  void startPolling();
}

if (botEnabled() && botMode() === 'webhook') {
  void startWebhook();
}
