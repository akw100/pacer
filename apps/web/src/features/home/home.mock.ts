// Home dashboard TYPES + pure helpers.
//
// Home consumes these types from `useHomeData()`, which reads live data from
// /score/summary, /habits, /runs, /workouts, /groups, and /groups/:id/stats.
// No demo data lives in this file.

export type HabitStatus = 'done' | 'pending';

export interface HabitItem {
  id: string;
  name: string;
  status: HabitStatus;
}

export interface PlannedActivity {
  kind: 'run' | 'workout' | 'rest';
  label: string;
  /** Display-only — the canonical distance is stored as meters on Run rows. */
  distanceLabel?: string;
  done: boolean;
}

export interface ScheduledRun {
  id: string;
  label: string;
  status: 'done' | 'upcoming';
  /** Short day label for upcoming pills, e.g. 'Thu'. */
  day?: string;
}

export interface WeekProgress {
  /** Display value already converted to the user's unit. */
  completedDistance: number;
  goalDistance: number;
  unit: 'km' | 'mi';
  runsRemaining: number;
  scheduled: ScheduledRun[];
}

export interface LeaderboardRow {
  id: string;
  name: string;
  points: number;
  isYou?: boolean;
}

export interface GroupPulse {
  groupName: string;
  rows: LeaderboardRow[];
}

export interface RecentActivityItem {
  id: string;
  actorName: string;
  description: string;
  ago: string;
  reactions: { emoji: string; label: string; count: number }[];
}

export interface HomeSnapshot {
  user: {
    firstName: string;
    streakDays: number;
    weeklyPoints: number;
  };
  today: {
    planned: PlannedActivity;
    habits: HabitItem[];
  };
  week: WeekProgress;
  group: GroupPulse;
  recent: RecentActivityItem[];
}

/**
 * Time-aware English greeting. Pure — the caller passes a date so this stays
 * easy to test and snapshot.
 */
export function greetingFor(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
