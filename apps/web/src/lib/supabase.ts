import { createClient } from '@supabase/supabase-js';

// Browser Supabase client — anon key ONLY (Vite exposes VITE_* to the bundle).
// The service-role key never reaches the web app. Fail fast on missing config so
// we never silently run against an undefined project.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Copy apps/web/.env.example to apps/web/.env and fill in the values.',
  );
}

export const supabase = createClient(url, anonKey);
