export interface StepSample {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface StepCounterOptions {
  threshold?: number;
  minIntervalMs?: number;
}

export class StepCounter {
  private readonly threshold: number;
  private readonly minIntervalMs: number;
  private lastStepAt = -Infinity;
  private lastMagnitude = 0;
  public count = 0;

  constructor(options: StepCounterOptions = {}) {
    this.threshold = options.threshold ?? 2.5;
    this.minIntervalMs = options.minIntervalMs ?? 250;
  }

  addSample(sample: StepSample): number {
    const magnitude = Math.sqrt(sample.x ** 2 + sample.y ** 2 + sample.z ** 2);
    const delta = magnitude - this.lastMagnitude;
    const now = sample.timestamp;
    const canCount =
      delta >= this.threshold &&
      now - this.lastStepAt >= this.minIntervalMs &&
      this.lastMagnitude > 0;

    if (canCount) {
      this.count += 1;
      this.lastStepAt = now;
    }

    this.lastMagnitude = magnitude;
    return this.count;
  }
}
