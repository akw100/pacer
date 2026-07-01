import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineMeters, isUsableFix, isPlausibleStep, MAX_ACCURACY_M, MAX_SPEED_MPS } from './geo';
test('haversineMeters ~111.2m per 0.001° latitude', () => {
  const d = haversineMeters({ lat: 0, lon: 0 }, { lat: 0.001, lon: 0 });
  assert.ok(Math.abs(d - 111.2) < 1, `got ${d}`);
});
test('isUsableFix rejects low-accuracy fixes', () => {
  assert.equal(isUsableFix({ accuracy: 10 }), true);
  assert.equal(isUsableFix({ accuracy: MAX_ACCURACY_M + 1 }), false);
});
test('isPlausibleStep rejects teleport speed', () => {
  assert.equal(isPlausibleStep(1000, 1), false);
  assert.equal(isPlausibleStep(8, 3), true);
  assert.ok(MAX_SPEED_MPS >= 6 && MAX_SPEED_MPS <= 8);
});
