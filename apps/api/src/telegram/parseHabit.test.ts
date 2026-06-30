import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHabitJson } from './parseHabit';

test('parseHabitJson validates a habit match', () => {
  const r = parseHabitJson('{"matched":true,"habit_name":"Stretch","all":false,"confidence":0.9}');
  assert.equal(r.matched, true);
  assert.equal(r.habit_name, 'Stretch');
});
test('parseHabitJson allows no-match', () => {
  const r = parseHabitJson('{"matched":false,"habit_name":null,"all":false,"confidence":0.2}');
  assert.equal(r.matched, false);
  assert.equal(r.habit_name, null);
});
