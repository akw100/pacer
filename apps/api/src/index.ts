import { serve } from '@hono/node-server';
import { app } from './app';
import { env } from './lib/env';
import { botMode, botEnabled, isProduction } from './telegram/env';
import { startPolling, startWebhook } from './telegram/bot';

// Server entry. tsx runs this directly in dev (watch) and in production — no
// build step. The app assembly lives in app.ts so it can be imported for tests
// without binding a port.
serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`[pacer-api] listening on http://localhost:${info.port}`);
});

// Connect the bot in production only — never staging/local (one poller per token).
if (!isProduction()) {
  console.warn(
    `[telegram] env "${process.env['RAILWAY_ENVIRONMENT_NAME'] ?? 'local'}" is not production — bot not connected.`,
  );
} else if (botEnabled() && botMode() === 'polling') {
  void startPolling();
} else if (botEnabled() && botMode() === 'webhook') {
  void startWebhook();
}
