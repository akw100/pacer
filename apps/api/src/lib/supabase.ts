import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

// Two clients, two trust levels — never mix them:
//
//  - serviceClient(): service-role key, BYPASSES RLS. Trusted server work only
//    (aggregation, ingestion, the signup-trigger's domain). NEVER hand this to
//    anything derived from a request.
//  - userClient(jwt): anon key + the caller's bearer JWT, so Postgres RLS applies
//    as that user. This is what request handlers use to read/write the caller's
//    own rows.

let _service: SupabaseClient | null = null;

/** Service-role client (no user context). Bypasses RLS — trusted server work only. */
export function serviceClient(): SupabaseClient {
  if (!_service) {
    _service = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _service;
}

/** Per-request client carrying the caller's JWT, so RLS applies as that user. */
export function userClient(jwt: string): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}
