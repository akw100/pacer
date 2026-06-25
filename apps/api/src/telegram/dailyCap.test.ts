import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tryConsumePhoto, DAILY_PHOTO_CAP, _resetCaps } from './dailyCap';

test('allows up to the cap then blocks, same day', () => {
  _resetCaps();
  for (let i = 0; i < DAILY_PHOTO_CAP; i++) {
    assert.equal(tryConsumePhoto('u1', '2026-06-25'), true, `parse ${i + 1}`);
  }
  assert.equal(tryConsumePhoto('u1', '2026-06-25'), false);
});

test('resets on a new day', () => {
  _resetCaps();
  for (let i = 0; i < DAILY_PHOTO_CAP; i++) tryConsumePhoto('u1', '2026-06-25');
  assert.equal(tryConsumePhoto('u1', '2026-06-26'), true);
});

test('caps are per user', () => {
  _resetCaps();
  for (let i = 0; i < DAILY_PHOTO_CAP; i++) tryConsumePhoto('u1', '2026-06-25');
  assert.equal(tryConsumePhoto('u2', '2026-06-25'), true);
});
