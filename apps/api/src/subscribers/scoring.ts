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

on('habit.checked', async ({ userId, habitCheckId, checkDate }) => {
  const points = scoreFor({ reason: 'habit' });
  await awardScore(userId, points, 'habit', 'habit', habitCheckId, checkDate);
  await maybeAwardHabitDayBonus(userId, checkDate);
});

type BonusAward = {
  points: number;
  reason: ScoreReason;
  sourceType: string;
  sourceId: string;
  eventDate: string;
};

/**
 * §6 "all habits in a day" +2 bonus — the payload to write when every one of the
 * user's habits is checked for `checkDate`, else null. Pure so the rule is
 * unit-tested without a DB. Keyed on the day; source_id carries userId because
 * score_events is unique on (reason, source_type, source_id) with no user_id.
 */
export function habitDayBonusAward(
  userId: string,
  checkDate: string,
  totalHabits: number,
  checkedToday: number,
): BonusAward | null {
  if (totalHabits === 0 || checkedToday < totalHabits) return null;
  return {
    points: scoreFor({ reason: 'habit_day_bonus' }),
    reason: 'habit_day_bonus',
    sourceType: 'habit_day',
    sourceId: `${userId}:${checkDate}`,
    eventDate: checkDate,
  };
}

// ponytail: award-only. Like the per-habit points, an uncheck doesn't revoke
// this (no uncheck event / cleanup trigger); and two concurrent web checks of
// the final habits can both read done<total and skip it. Add a DB-side trigger
// if either edge starts to matter.
async function maybeAwardHabitDayBonus(userId: string, checkDate: string): Promise<void> {
  const db = serviceClient();
  const [habits, checks] = await Promise.all([
    db.from('habits').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    db
      .from('habit_checks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('check_date', checkDate),
  ]);
  const award = habitDayBonusAward(userId, checkDate, habits.count ?? 0, checks.count ?? 0);
  if (!award) return;
  await awardScore(userId, award.points, award.reason, award.sourceType, award.sourceId, award.eventDate);
}

async function awardScore(
  userId: string,
  points: number,
  reason: ScoreReason,
  sourceType: string,
  sourceId: string,
  eventDate: string,
) {
  const db = serviceClient();
  await db.from('score_events').upsert(
    { user_id: userId, points, reason, source_type: sourceType, source_id: sourceId, event_date: eventDate },
    { onConflict: 'reason,source_type,source_id', ignoreDuplicates: true },
  );
}
