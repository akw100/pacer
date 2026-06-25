import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subDays } from 'date-fns';
import { weekRange, isInCurrentWeek, toDateKey, streakLength } from './dates';

test('toDateKey is yyyy-MM-dd', () => {
  assert.equal(toDateKey(new Date(2026, 0, 15)), '2026-01-15');
});

test('weekRange honors week-start (Wed 2026-01-14)', () => {
  const wed = new Date(2026, 0, 14);
  assert.equal(toDateKey(weekRange(wed, 1).start), '2026-01-12'); // Monday start
  assert.equal(toDateKey(weekRange(wed, 1).end), '2026-01-18'); // Sunday end
  assert.equal(toDateKey(weekRange(wed, 0).start), '2026-01-11'); // Sunday start
  assert.equal(toDateKey(weekRange(wed, 0).end), '2026-01-17'); // Saturday end
});

test('isInCurrentWeek', () => {
  const now = new Date(2026, 0, 14); // Wed
  assert.ok(isInCurrentWeek(new Date(2026, 0, 12), 1, now)); // Mon, same Mon-week
  assert.ok(!isInCurrentWeek(new Date(2026, 0, 11), 1, now)); // prev Sun, out
});

test('streakLength counts back from today (today inclusive)', () => {
  const now = new Date(2026, 0, 15, 12, 0, 0);
  const keys = [now, subDays(now, 1), subDays(now, 2)].map(toDateKey);
  assert.equal(streakLength(keys, now), 3);
});

test('streakLength breaks when today is missing', () => {
  const now = new Date(2026, 0, 15);
  const keys = [subDays(now, 1), subDays(now, 2)].map(toDateKey);
  assert.equal(streakLength(keys, now), 0);
});

test('streakLength stops at the first gap', () => {
  const now = new Date(2026, 0, 15);
  const keys = [now, subDays(now, 1), subDays(now, 3)].map(toDateKey); // gap at -2
  assert.equal(streakLength(keys, now), 2);
});
