import { Hono } from 'hono';
import { AssistantChatRequestSchema, type AssistantChatResponse } from '@pacer/shared';
import type { AppEnv } from '../lib/auth';
import { runAssistant } from '../lib/assistant';
import { zValidator } from '../lib/validate';

// Pacer Coach (Assistant) — POST /assistant/chat.
//
// Read-only v1. The route is mounted behind `requireAuth`; the caller's
// JWT is forwarded to the tool executor so all data the assistant sees is
// scoped exactly as if the user called the underlying endpoints themselves
// (RLS preserved, no service-role).

export const assistant = new Hono<AppEnv>().post(
  '/chat',
  zValidator('json', AssistantChatRequestSchema),
  async (c) => {
    const { messages } = c.req.valid('json');
    const authHeader = c.req.header('Authorization') ?? '';
    const callerJwt = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
    if (!callerJwt) {
      return c.json({ error: 'Missing bearer token' }, 401);
    }

    try {
      const result = await runAssistant(messages, callerJwt);
      const payload: AssistantChatResponse = {
        message: result.message,
        tools_used: result.tools_used,
      };
      return c.json(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Assistant failure';
      return c.json({ error: 'assistant_failed', message }, 502);
    }
  },
);
