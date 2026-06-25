import { createMiddleware } from 'hono/factory';
import type { SupabaseClient } from '@supabase/supabase-js';
import { userClient } from './supabase';

// Typed Hono context: every authed handler can read the verified userId and a
// per-request RLS-scoped Supabase client. Other slices extend behaviour through
// the route registry, never by widening this shape loosely.
export type AppEnv = {
  Variables: {
    userId: string;
    userClient: SupabaseClient;
  };
};

/**
 * Verifies the `Authorization: Bearer <jwt>` against Supabase and populates the
 * request context. We verify by asking Supabase to resolve the token's user
 * (`auth.getUser()`), which validates signature + expiry without us holding the
 * JWT secret. 401 on any missing/invalid token.
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return c.json({ error: 'Missing bearer token' }, 401);
  }

  const client = userClient(token);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  c.set('userId', data.user.id);
  c.set('userClient', client);
  await next();
});
