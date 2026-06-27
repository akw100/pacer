// Central env access. Reads process.env once and exposes typed getters so the
// rest of the app never touches process.env directly. Missing *required* values
// throw early on first use (fail fast at boot), but /health stays DB-free so the
// server can boot for a liveness check even before Supabase is configured.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get supabaseUrl(): string {
    return required('SUPABASE_URL');
  },
  get supabaseAnonKey(): string {
    return required('SUPABASE_ANON_KEY');
  },
  get supabaseServiceRoleKey(): string {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },
  get port(): number {
    const raw = process.env['PORT'];
    return raw ? Number.parseInt(raw, 10) : 8787;
  },
  get webOrigin(): string {
    return process.env['WEB_ORIGIN'] ?? 'http://localhost:5173';
  },
  // Python frames worker (services/frames). Only the video-routines slice uses these.
  get framesServiceUrl(): string {
    return required('FRAMES_SERVICE_URL');
  },
  // Shared secret guarding the worker ↔ api internal callback (both directions).
  get internalToken(): string {
    return required('INTERNAL_TOKEN');
  },
};
