import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streakLength } from './streak';

test('counts consecutive days ending today', () => {
  assert.equal(streakLength(['2026-06-30', '2026-06-29', '2026-06-28'], '2026-06-30'), 3);
});
test('breaks on a gap', () => {
  assert.equal(streakLength(['2026-06-30', '2026-06-28'], '2026-06-30'), 1);
});
test('zero if today not present', () => {
  assert.equal(streakLength(['2026-06-29'], '2026-06-30'), 0);
});
