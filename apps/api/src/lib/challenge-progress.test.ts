import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sumByUser, countByUser, distinctCountByUser } from './challenge-progress';

test('sumByUser: adds valueOf per user', () => {
  const rows = [
    { user_id: 'a', distance_meters: 1000 },
    { user_id: 'a', distance_meters: 2500 },
    { user_id: 'b', distance_meters: 500 },
  ];
  const m = sumByUser(rows, (r) => r.distance_meters);
  assert.equal(m.get('a'), 3500);
  assert.equal(m.get('b'), 500);
  assert.equal(m.get('c'), undefined);
});

test('sumByUser: handles string-typed numerics (numeric columns)', () => {
  const rows = [
    { user_id: 'a', distance_meters: '1000' as unknown as number },
    { user_id: 'a', distance_meters: '250' as unknown as number },
  ];
  const m = sumByUser(rows, (r) => Number(r.distance_meters));
  assert.equal(m.get('a'), 1250);
});

test('countByUser: counts rows per user', () => {
  const m = countByUser([{ user_id: 'a' }, { user_id: 'a' }, { user_id: 'b' }]);
  assert.equal(m.get('a'), 2);
  assert.equal(m.get('b'), 1);
});

test('distinctCountByUser: counts distinct keys, dedupes repeats', () => {
  const rows = [
    { user_id: 'a', check_date: '2026-06-01' },
    { user_id: 'a', check_date: '2026-06-01' }, // same day, dedup
    { user_id: 'a', check_date: '2026-06-02' },
    { user_id: 'b', check_date: '2026-06-01' },
  ];
  const m = distinctCountByUser(rows, (r) => r.check_date);
  assert.equal(m.get('a'), 2);
  assert.equal(m.get('b'), 1);
});

test('reps-style: re-keyed sets summed as sets*reps per owner', () => {
  const owned = [
    { user_id: 'a', sets: 3, reps: 10 }, // 30
    { user_id: 'a', sets: 4, reps: 5 }, // 20
    { user_id: 'b', sets: 1, reps: 8 }, // 8
  ];
  const m = sumByUser(owned, (s) => s.sets * s.reps);
  assert.equal(m.get('a'), 50);
  assert.equal(m.get('b'), 8);
});
