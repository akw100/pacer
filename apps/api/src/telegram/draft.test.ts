import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RunDraftSchema, draftToRunCreate, putDraft, takeDraft, peekDraft, updateDraft } from './draft';

test('RunDraftSchema accepts a valid draft', () => {
  const d = RunDraftSchema.parse({ distance_meters: 5000, duration_seconds: 1680, confidence: 0.9 });
  assert.equal(d.distance_meters, 5000);
});

test('RunDraftSchema rejects non-positive distance', () => {
  assert.throws(() => RunDraftSchema.parse({ distance_meters: 0, duration_seconds: 1680, confidence: 0.9 }));
});

test('draftToRunCreate defaults run_date to today and sets telegram source', () => {
  const body = draftToRunCreate(
    { distance_meters: 5000, duration_seconds: 1680, confidence: 0.9 },
    '2026-06-25',
  );
  assert.equal(body.run_date, '2026-06-25');
  assert.equal(body.source, 'telegram');
  assert.equal(body.distance_meters, 5000);
  assert.equal(body.warm_up, false);
});

test('draftToRunCreate keeps an explicit run_date', () => {
  const body = draftToRunCreate(
    { distance_meters: 3000, duration_seconds: 900, run_date: '2026-06-20', confidence: 1 },
    '2026-06-25',
  );
  assert.equal(body.run_date, '2026-06-20');
});

test('draft store put/take is one-shot', () => {
  putDraft('chat:1', { distance_meters: 5000, duration_seconds: 1680, confidence: 0.9 });
  assert.ok(takeDraft('chat:1'));
  assert.equal(takeDraft('chat:1'), undefined);
});

test('peekDraft returns without consuming; updateDraft replaces in place', () => {
  putDraft('k', { distance_meters: 5000, duration_seconds: 1680, confidence: 1 });
  assert.equal(peekDraft('k')?.distance_meters, 5000);
  updateDraft('k', { distance_meters: 6000, duration_seconds: 1680, confidence: 1 });
  assert.equal(peekDraft('k')?.distance_meters, 6000);
  assert.equal(takeDraft('k')?.distance_meters, 6000);
  assert.equal(peekDraft('k'), undefined);
});
