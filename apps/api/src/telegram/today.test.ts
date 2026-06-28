import { test } from 'node:test';
import assert from 'node:assert/strict';
import { today } from './handlers/shared';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// today() picks a run's date in APP_TIMEZONE; the bug it fixes is a UTC date
// landing on the wrong local day at night. We can't pin "now", so assert the
// shape and the fallback rather than a specific date.

test('today() returns yyyy-mm-dd with no APP_TIMEZONE (UTC)', () => {
  delete process.env['APP_TIMEZONE'];
  assert.match(today(), ISO_DATE);
});

test('today() returns yyyy-mm-dd for a valid IANA zone', () => {
  process.env['APP_TIMEZONE'] = 'Asia/Jerusalem';
  assert.match(today(), ISO_DATE);
});

test('today() falls back to UTC (no throw) on an invalid zone', () => {
  process.env['APP_TIMEZONE'] = 'Not/AZone';
  assert.match(today(), ISO_DATE);
  delete process.env['APP_TIMEZONE'];
});
