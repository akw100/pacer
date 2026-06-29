import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorkoutDraftSchema, draftToWorkoutCreate } from './workoutDraft';

test('WorkoutDraftSchema accepts a valid strength workout', () => {
  const d = WorkoutDraftSchema.parse({
    name: 'Leg day', kind: 'strength',
    sets: [{ exercise_name: 'Squat', sets: 3, reps: 10, weight: 60 }],
    confidence: 0.9,
  });
  assert.equal(d.sets[0]?.exercise_name, 'Squat');
});

test('WorkoutDraftSchema rejects an invalid kind', () => {
  assert.throws(() => WorkoutDraftSchema.parse({ name: 'x', kind: 'yoga', sets: [], confidence: 1 }));
});

test('draftToWorkoutCreate defaults date to today and sets telegram source', () => {
  const wc = draftToWorkoutCreate(
    { name: 'Leg day', kind: 'strength', sets: [{ exercise_name: 'Squat', sets: 3, reps: 10 }], confidence: 1 },
    '2026-06-29',
  );
  assert.equal(wc.workout_date, '2026-06-29');
  assert.equal(wc.source, 'telegram');
  assert.equal(wc.kind, 'strength');
});
