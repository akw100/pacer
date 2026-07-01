import { MAX_SPEED_MPS } from './geo';
import type { RaceStatus } from './schemas/race';
export function isPlausibleFinish(targetMeters: number, elapsedSeconds: number): boolean {
  if (elapsedSeconds <= 0) return false; return targetMeters / elapsedSeconds <= MAX_SPEED_MPS;
}
export interface FinisherInput { userId: string; state: 'finished' | 'dnf'; finishedAt: string | null }
export function rankFinishers(rows: FinisherInput[]): FinisherInput[] {
  return [...rows].sort((a, b) => {
    if (a.state !== b.state) return a.state === 'finished' ? -1 : 1;
    if (a.state === 'dnf') return 0;
    return (a.finishedAt ?? '').localeCompare(b.finishedAt ?? '');
  });
}
const LEGAL: Record<RaceStatus, RaceStatus[]> = { lobby: ['active', 'cancelled'], active: ['finished'], finished: [], cancelled: [] };
export function canTransition(from: RaceStatus, to: RaceStatus): boolean { return LEGAL[from].includes(to); }
export interface DistanceSample { meters: number; ts: number }
export function splitsFromSamples(samples: DistanceSample[], targetMeters: number): number[] {
  const splits: number[] = [];
  const kms = Math.floor(targetMeters / 1000);
  for (let k = 1; k <= kms; k++) {
    const mark = k * 1000;
    const at = interpolateTime(samples, mark);
    const prev = k === 1 ? sampleTimeAtZero(samples) : interpolateTime(samples, (k - 1) * 1000);
    if (at == null || prev == null) break;
    splits.push(Math.round((at - prev) / 1000));
  }
  return splits;
}
function sampleTimeAtZero(samples: DistanceSample[]): number | null { return samples.length ? samples[0]!.ts : null; }
function interpolateTime(samples: DistanceSample[], meters: number): number | null {
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!; const b = samples[i]!;
    if (b.meters >= meters && a.meters <= meters) {
      const span = b.meters - a.meters; const f = span === 0 ? 0 : (meters - a.meters) / span;
      return a.ts + f * (b.ts - a.ts);
    }
  }
  return null;
}
