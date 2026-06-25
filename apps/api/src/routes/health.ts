import { Hono } from 'hono';

// Liveness probe. No auth, no DB — must answer even before Supabase is
// configured, so platform health checks (Railway) never depend on the database.
export const health = new Hono().get('/', (c) => c.json({ ok: true }));
