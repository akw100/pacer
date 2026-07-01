import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreFor, POINTS, SCORE_REASONS } from './scoring';
import { ScoreEventSchema } from './schemas/score-event';

test('run = base + floor(km) * per_km', () => {
  assert.equal(scoreFor({ reason: 'run', distanceMeters: 5000 }), 15); // 10 + 5
  assert.equal(scoreFor({ reason: 'run', distanceMeters: 5400 }), 15); // floors to 5 km
  assert.equal(scoreFor({ reason: 'run', distanceMeters: 999 }), 10); // 0 km
  assert.equal(scoreFor({ reason: 'run', distanceMeters: 0 }), 10);
});

test('flat-rate reasons', () => {
  assert.equal(scoreFor({ reason: 'workout' }), 10);
  assert.equal(scoreFor({ reason: 'habit' }), 3);
  assert.equal(scoreFor({ reason: 'habit_day_bonus' }), 2);
  assert.equal(scoreFor({ reason: 'plan_run' }), 5);
  assert.equal(scoreFor({ reason: 'streak' }), 10);
});

test('POINTS match the §6 table', () => {
  assert.deepEqual(POINTS, {
    RUN_BASE: 10,
    RUN_PER_KM: 1,
    WORKOUT: 10,
    HABIT_PER_DAY: 3,
    ALL_HABITS_BONUS: 2,
    PLAN_RUN_ON_SCHEDULE: 5,
    STREAK_7DAY: 10,
    RACE_WIN: 15,
  });
});

test('a race win is worth RACE_WIN points', () => {
  assert.equal(scoreFor({ reason: 'race_win' }), POINTS.RACE_WIN);
  assert.equal(POINTS.RACE_WIN, 15);
});

// Guards the drift that let 'race_win' land in the DB but not the zod enum.
test('ScoreEventSchema accepts every SCORE_REASONS value', () => {
  for (const reason of SCORE_REASONS) {
    const parsed = ScoreEventSchema.safeParse({
      id: '00000000-0000-0000-0000-000000000000',
      userId: '00000000-0000-0000-0000-000000000000',
      points: 10,
      reason,
      sourceType: 'run',
      sourceId: 'x',
      eventDate: '2026-07-01',
      createdAt: '2026-07-01T00:00:00.000Z',
    });
    assert.ok(parsed.success, `reason '${reason}' should parse`);
  }
});
