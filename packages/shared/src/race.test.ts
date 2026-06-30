import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPlausibleFinish, rankFinishers, canTransition, splitsFromSamples } from './race';
test('isPlausibleFinish rejects an impossibly fast finish', () => {
  assert.equal(isPlausibleFinish(3000, 600), true);
  assert.equal(isPlausibleFinish(3000, 5), false);
});
test('rankFinishers orders by finishedAt, dnf last', () => {
  const ranked = rankFinishers([
    { userId: 'a', state: 'finished', finishedAt: '2026-06-30T10:00:10Z' },
    { userId: 'b', state: 'finished', finishedAt: '2026-06-30T10:00:05Z' },
    { userId: 'c', state: 'dnf', finishedAt: null },
  ]);
  assert.deepEqual(ranked.map((r) => r.userId), ['b', 'a', 'c']);
});
test('canTransition enforces the lifecycle', () => {
  assert.equal(canTransition('lobby', 'active'), true);
  assert.equal(canTransition('active', 'finished'), true);
  assert.equal(canTransition('finished', 'active'), false);
  assert.equal(canTransition('lobby', 'cancelled'), true);
});
test('splitsFromSamples returns one elapsed-seconds entry per km', () => {
  const splits = splitsFromSamples([
    { meters: 0, ts: 0 }, { meters: 1000, ts: 300_000 }, { meters: 2000, ts: 620_000 },
  ], 2000);
  assert.deepEqual(splits, [300, 320]);
});
