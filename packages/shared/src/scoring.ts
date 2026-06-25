// The single scoring source of truth — web shows the preview ("+15 pts"), the
// API writes the ledger, the bot includes points in replies. §6 points table
// verbatim; reasons mirror the score_events.reason enum exactly.

export const POINTS = {
  RUN_BASE: 10,
  RUN_PER_KM: 1,
  WORKOUT: 10,
  HABIT_PER_DAY: 3,
  ALL_HABITS_BONUS: 2,
  PLAN_RUN_ON_SCHEDULE: 5,
  STREAK_7DAY: 10,
} as const;

export type ScoreReason =
  | 'run'
  | 'workout'
  | 'habit'
  | 'habit_day_bonus'
  | 'plan_run'
  | 'streak';

export type ScoreInput =
  | { reason: 'run'; distanceMeters: number }
  | { reason: 'workout' }
  | { reason: 'habit' }
  | { reason: 'habit_day_bonus' }
  | { reason: 'plan_run' }
  | { reason: 'streak' };

/** Pure. run = base + floor(km) * per_km; everything else is a flat constant. */
export function scoreFor(input: ScoreInput): number {
  switch (input.reason) {
    case 'run':
      return POINTS.RUN_BASE + Math.floor(input.distanceMeters / 1000) * POINTS.RUN_PER_KM;
    case 'workout':
      return POINTS.WORKOUT;
    case 'habit':
      return POINTS.HABIT_PER_DAY;
    case 'habit_day_bonus':
      return POINTS.ALL_HABITS_BONUS;
    case 'plan_run':
      return POINTS.PLAN_RUN_ON_SCHEDULE;
    case 'streak':
      return POINTS.STREAK_7DAY;
  }
}
