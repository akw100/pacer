import type { Hono } from 'hono';
import type { AppEnv } from '../lib/auth';
import { health } from './health';
import { profile } from './profile';
import { habits } from './habits';
import { score } from './score';
import { runs } from './runs';
import { workouts } from './workouts';
import { onboarding } from './onboarding';
import { platformStats } from './platform-stats';
import { groups } from './groups';
import { reactions } from './reactions';
import { friends } from './friends';

// ── Route registry (APPEND-ONLY) ───────────────────────────────────────────
// The single place routes are mounted onto the app. Each slice adds ONE line
// below for its own `routes/<slice>.ts` module — never edit another slice's
// line, never mount a route anywhere else.
//
// Auth: the global guard in app.ts authenticates every request EXCEPT the
// public prefixes (/health, /webhook). So a normal authed route just mounts
// here and reads `c.get('userId')` / `c.get('userClient')`; a public route's
// prefix must be added to PUBLIC_PATH_PREFIXES in app.ts.
export function registerRoutes(app: Hono<AppEnv>): void {
  app.route('/health', health); // public (see PUBLIC_PATH_PREFIXES)
  app.route('/profile', profile); // authed
  app.route('/habits', habits); // authed
  app.route('/score', score); // authed
  app.route('/runs', runs); // authed
  app.route('/workouts', workouts); // authed
  app.route('/stats/platform', platformStats); // authed
  app.route('/onboarding', onboarding); // authed
  app.route('/groups', groups); // authed
  app.route('/reactions', reactions); // authed
  app.route('/friends', friends); // authed
  // ↑ add your slice's route here, one line.
}
