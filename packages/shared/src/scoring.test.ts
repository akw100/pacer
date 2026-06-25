import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreFor, POINTS } from './scoring';

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
  });
});
