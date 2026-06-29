import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkoutDraftJson } from './parseWorkout';

test('parseWorkoutDraftJson validates a good payload', () => {
  const d = parseWorkoutDraftJson('{"name":"Leg day","kind":"strength","sets":[{"exercise_name":"Squat","sets":3,"reps":10,"weight":60}],"duration_seconds":null,"workout_date":null,"confidence":0.9}');
  assert.equal(d.kind, 'strength');
  assert.equal(d.sets.length, 1);
});

test('parseWorkoutDraftJson nulls a malformed workout_date', () => {
  const d = parseWorkoutDraftJson('{"name":"x","kind":"other","sets":[],"duration_seconds":null,"workout_date":"today","confidence":1}');
  assert.equal(d.workout_date, null);
});
