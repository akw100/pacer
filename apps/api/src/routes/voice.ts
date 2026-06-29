import { Hono } from 'hono';
import type { AppEnv } from '../lib/auth';
import { env } from '../lib/env';

// Voice agent — mints a short-lived (~1 min) OpenAI Realtime ephemeral token so
// the browser can open a WebRTC voice session directly with OpenAI. The standing
// OPENAI_KEY never leaves the server. Instructions + tools are sent by the client
// over the data channel (the tools only drive the caller's own DOM), so this
// endpoint just exchanges the standing key for a scoped ephemeral one.
export const voice = new Hono<AppEnv>();

voice.post('/session', async (c) => {
  const userId = c.get('userId');
  const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.openaiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Safety-Identifier': userId,
    },
    body: JSON.stringify({
      session: {
        type: 'realtime',
        model: env.openaiRealtimeModel,
        audio: { output: { voice: 'marin' } },
      },
    }),
  });

  if (!res.ok) {
    return c.json(
      { error: 'realtime_session_failed', detail: await res.text() },
      502,
    );
  }

  // GA returns the token at top-level `value`; tolerate the older nested shape.
  const data = (await res.json()) as {
    value?: string;
    client_secret?: { value?: string };
  };
  const token = data.value ?? data.client_secret?.value;
  if (!token) return c.json({ error: 'no_token_in_response' }, 502);

  return c.json({ token });
});
