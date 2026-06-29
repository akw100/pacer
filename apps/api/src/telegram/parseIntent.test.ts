import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIntentJson } from './parseIntent';

test('parseIntentJson reads a run intent', () => {
  assert.equal(parseIntentJson('{"intent":"run","confidence":0.9}').intent, 'run');
});
test('parseIntentJson reads none', () => {
  assert.equal(parseIntentJson('{"intent":"none","confidence":0.1}').intent, 'none');
});
test('parseIntentJson rejects an unknown intent', () => {
  assert.throws(() => parseIntentJson('{"intent":"sleep","confidence":1}'));
});
