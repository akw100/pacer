import { on } from '../lib/events';
import { scoreFor, type ScoreReason } from '@pacer/shared';
import { serviceClient } from '../lib/supabase';

on('run.logged', async ({ userId, runId, runDate, distanceMeters }) => {
  const points = scoreFor({ reason: 'run', distanceMeters });
  await awardScore(userId, points, 'run', 'run', runId, runDate);
});

on('workout.logged', async ({ userId, workoutId, workoutDate }) => {
  const points = scoreFor({ reason: 'workout' });
  await awardScore(userId, points, 'workout', 'workout', workoutId, workoutDate);
});

on('habit.checked', async ({ userId, habitId, checkDate, habitCheckId }) => {
  const points = scoreFor({ reason: 'habit' });
  await awardScore(userId, points, 'habit', 'habit', habitCheckId, checkDate);
});

async function awardScore(
  userId: string,
  points: number,
  reason: ScoreReason,
  sourceType: string,
  sourceId: string,
  eventDate: string,
) {
  const db = serviceClient();
  await db.from('score_events').insert({
    user_id: userId,
    points,
    reason,
    source_type: sourceType,
    source_id: sourceId,
    event_date: eventDate,
  });
}
