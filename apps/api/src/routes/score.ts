import { Hono } from 'hono';
import { streakLength, toDateKey, weekRange } from '@pacer/shared';
import type { AppEnv } from '../lib/auth';

export const score = new Hono<AppEnv>()
  .get('/summary', async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');

    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('week_start')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return c.json({ error: profileError?.message ?? 'Profile not found' }, 500);
    }

    const today = new Date();
    const { start, end } = weekRange(today, profile.week_start);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    const eventsResult = await db
      .from('score_events')
      .select('points,event_date')
      .eq('user_id', userId);

    if (eventsResult.error) {
      return c.json({ error: eventsResult.error.message }, 500);
    }

    const lifetimeScore = (eventsResult.data ?? []).reduce(
      (total, row) => total + Number(row.points ?? 0),
      0,
    );

    const weeklyScore = (eventsResult.data ?? [])
      .filter((row) => {
        const eventDate = String(row.event_date);
        return eventDate >= startKey && eventDate <= endKey;
      })
      .reduce((total, row) => total + Number(row.points ?? 0), 0);

    const [runs, workouts, habitChecks] = await Promise.all([
      db.from('runs').select('run_date').eq('user_id', userId),
      db.from('workouts').select('workout_date').eq('user_id', userId),
      db.from('habit_checks').select('check_date').eq('user_id', userId),
    ]);

    if (runs.error || workouts.error || habitChecks.error) {
      return c.json({ error: 'Unable to compute streak' }, 500);
    }

    const activeDateKeys = new Set<string>();
    (runs.data ?? []).forEach((row) => activeDateKeys.add(String(row.run_date)));
    (workouts.data ?? []).forEach((row) => activeDateKeys.add(String(row.workout_date)));
    (habitChecks.data ?? []).forEach((row) => activeDateKeys.add(String(row.check_date)));

    const streak = streakLength(Array.from(activeDateKeys), today);
    return c.json({ weeklyScore, lifetimeScore, streak });
  });
