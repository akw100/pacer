import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRunDraftJson } from './parse';

test('parseRunDraftJson validates a good model payload', () => {
  const d = parseRunDraftJson('{"distance_meters":5000,"duration_seconds":1680,"confidence":0.88}');
  assert.equal(d.distance_meters, 5000);
  assert.equal(d.confidence, 0.88);
});

test('parseRunDraftJson throws on malformed json', () => {
  assert.throws(() => parseRunDraftJson('not json'));
});

test('parseRunDraftJson throws when units are wrong (negative)', () => {
  assert.throws(() => parseRunDraftJson('{"distance_meters":-1,"duration_seconds":10,"confidence":0.5}'));
});
