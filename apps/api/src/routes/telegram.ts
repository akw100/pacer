import { Hono } from 'hono';
import type { AppEnv } from '../lib/auth';
import { serviceClient } from '../lib/supabase';
import { generateLinkCode } from '../telegram/linkCode';

const LINK_CODE_TTL_MS = 10 * 60 * 1000;

// Account-linking endpoints. Authed by the global guard. The telegram_* tables
// are service-role only (deny-all RLS), so these use the service client but
// always scope to the verified userId from the token — never a body id.
export const telegram = new Hono<AppEnv>()
  .post('/link-code', async (c) => {
    const userId = c.get('userId');
    const code = generateLinkCode();
    const expires_at = new Date(Date.now() + LINK_CODE_TTL_MS).toISOString();
    const { error } = await serviceClient()
      .from('telegram_link_codes')
      .insert({ code, user_id: userId, expires_at });
    if (error) return c.json({ error: error.message }, 400);
    return c.json({ code, expires_at });
  })
  .get('/status', async (c) => {
    const userId = c.get('userId');
    const { data } = await serviceClient()
      .from('telegram_links')
      .select('telegram_username')
      .eq('user_id', userId)
      .maybeSingle();
    return c.json({ linked: Boolean(data), telegram_username: data?.telegram_username ?? null });
  })
  .delete('/link', async (c) => {
    const userId = c.get('userId');
    const { error } = await serviceClient()
      .from('telegram_links')
      .delete()
      .eq('user_id', userId);
    if (error) return c.json({ error: error.message }, 400);
    return c.body(null, 204);
  });
