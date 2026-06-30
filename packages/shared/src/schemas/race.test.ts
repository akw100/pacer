import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreateRaceInputSchema, RaceStatusSchema, ParticipantStateSchema } from './race';
test('CreateRaceInputSchema requires a positive target', () => {
  assert.equal(CreateRaceInputSchema.parse({ target_meters: 3000 }).target_meters, 3000);
  assert.throws(() => CreateRaceInputSchema.parse({ target_meters: 0 }));
});
test('race + participant enums expose the expected states', () => {
  assert.deepEqual(RaceStatusSchema.options, ['lobby', 'active', 'finished', 'cancelled']);
  assert.deepEqual(ParticipantStateSchema.options, ['invited', 'joined', 'ready', 'racing', 'finished', 'dnf']);
});
