import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSummary, workoutSummary } from './summary';

test('runSummary includes distance, pace and points', () => {
  const s = runSummary({ distance_meters: 5000, duration_seconds: 1680, confidence: 1 });
  assert.match(s, /5\.00 km/);
  assert.match(s, /\+15 pts/);
});
test('workoutSummary lists sets', () => {
  const s = workoutSummary({ name: 'Leg day', kind: 'strength', sets: [{ exercise_name: 'Squat', sets: 3, reps: 10, weight: 60 }], confidence: 1 });
  assert.match(s, /Leg day/);
  assert.match(s, /3x10 Squat @60kg/);
});
