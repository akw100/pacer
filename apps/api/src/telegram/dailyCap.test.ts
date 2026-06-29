import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tryConsumePhoto, tryConsumeText, DAILY_PHOTO_CAP, DAILY_TEXT_CAP, _resetCaps } from './dailyCap';

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

test('text cap: allows up to DAILY_TEXT_CAP then blocks', () => {
  _resetCaps();
  for (let i = 0; i < DAILY_TEXT_CAP; i++) assert.equal(tryConsumeText('u1', '2026-06-29'), true);
  assert.equal(tryConsumeText('u1', '2026-06-29'), false);
});
test('text and photo caps are independent', () => {
  _resetCaps();
  for (let i = 0; i < DAILY_TEXT_CAP; i++) tryConsumeText('u1', '2026-06-29');
  assert.equal(tryConsumePhoto('u1', '2026-06-29'), true); // photo still allowed
});
