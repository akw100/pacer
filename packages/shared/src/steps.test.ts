import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StepCounter } from './steps';

test('counts a step when acceleration crosses the threshold', () => {
  const counter = new StepCounter({ threshold: 2.5, minIntervalMs: 250 });

  counter.addSample({ x: 0, y: 0, z: 9.81, timestamp: 0 });
  counter.addSample({ x: 0, y: 0, z: 12.8, timestamp: 100 });
  counter.addSample({ x: 0, y: 0, z: 9.81, timestamp: 300 });

  assert.equal(counter.count, 1);
});

test('ignores rapid back-to-back spikes', () => {
  const counter = new StepCounter({ threshold: 2.5, minIntervalMs: 250 });

  counter.addSample({ x: 0, y: 0, z: 9.81, timestamp: 0 });
  counter.addSample({ x: 0, y: 0, z: 12.8, timestamp: 100 });
  counter.addSample({ x: 0, y: 0, z: 12.6, timestamp: 150 });
  counter.addSample({ x: 0, y: 0, z: 9.81, timestamp: 300 });

  assert.equal(counter.count, 1);
});
