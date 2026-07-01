import { test } from 'node:test';
import assert from 'node:assert/strict';
import { habitDayBonusAward } from './scoring';

const UID = 'user-1';
const DATE = '2026-07-01';

test('no habit_day_bonus until every habit is checked', () => {
  assert.equal(habitDayBonusAward(UID, DATE, 3, 2), null);
  assert.equal(habitDayBonusAward(UID, DATE, 0, 0), null); // no habits ⇒ no bonus
});

test('awards +2, keyed per user per day, once all habits are done', () => {
  const a = habitDayBonusAward(UID, DATE, 3, 3);
  assert.ok(a);
  assert.equal(a.points, 2);
  assert.equal(a.reason, 'habit_day_bonus');
  assert.equal(a.sourceType, 'habit_day');
  // userId in the key: score_events is unique on (reason, source_type, source_id)
  // with no user_id column, so two users on the same day must not collide.
  assert.equal(a.sourceId, `${UID}:${DATE}`);
  assert.equal(a.eventDate, DATE);
});
