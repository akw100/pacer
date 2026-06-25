import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  metersToKm,
  metersToDisplayDistance,
  paceSecondsPerUnit,
  formatPace,
  formatDuration,
} from './units';

test('metersToKm', () => {
  assert.equal(metersToKm(5000), 5);
  assert.equal(metersToKm(0), 0);
});

test('metersToDisplayDistance derives km and mi', () => {
  assert.deepEqual(metersToDisplayDistance(5000, 'km'), { value: 5, unit: 'km' });
  const mi = metersToDisplayDistance(1609.344, 'mi');
  assert.equal(mi.unit, 'mi');
  assert.ok(Math.abs(mi.value - 1) < 1e-9);
});

test('paceSecondsPerUnit + formatPace', () => {
  // 5 km in 1680 s = 336 s/km -> "5:36"
  assert.equal(formatPace(paceSecondsPerUnit(5000, 1680, 'km')), '5:36');
  assert.equal(formatPace(330), '5:30');
});

test('formatPace guards 0 / Infinity', () => {
  assert.equal(formatPace(0), '—');
  assert.equal(formatPace(Infinity), '—');
  assert.equal(paceSecondsPerUnit(0, 1680, 'km'), 0);
});

test('formatDuration', () => {
  assert.equal(formatDuration(1680), '28:00');
  assert.equal(formatDuration(3900), '1:05:00');
  assert.equal(formatDuration(65), '1:05');
});
