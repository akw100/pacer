// Typed fixture data for the Home dashboard. One place to change shape +
// values until the API/Supabase wiring lands — components consume the types,
// not the literals, so a future `useHomeSnapshot()` swap is mechanical.

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

export const homeSnapshot: HomeSnapshot = {
  user: {
    firstName: 'Dana',
    streakDays: 6,
    weeklyPoints: 88,
  },
  today: {
    planned: {
      kind: 'run',
      label: 'Run',
      distanceLabel: '4 km',
      done: false,
    },
    habits: [
      { id: 'stretch', name: 'Stretch', status: 'done' },
      { id: 'nutrition', name: 'Nutrition', status: 'done' },
      { id: 'steps', name: 'Steps', status: 'pending' },
    ],
  },
  week: {
    completedDistance: 12.4,
    goalDistance: 16,
    unit: 'km',
    runsRemaining: 1,
    scheduled: [
      { id: 'r1', label: 'Mon · 4 km', status: 'done' },
      { id: 'r2', label: 'Tue · 4 km', status: 'done' },
      { id: 'r3', label: 'Thu · 4 km', status: 'upcoming', day: 'Thu' },
    ],
  },
  group: {
    groupName: 'Wasserman Family',
    rows: [
      { id: 'u1', name: 'Dana', points: 96 },
      { id: 'me', name: 'You', points: 88, isYou: true },
      { id: 'u3', name: 'Yuval', points: 71 },
    ],
  },
  recent: [
    {
      id: 'a1',
      actorName: 'Yuval',
      description: 'logged a 5.2 km run',
      ago: '2h ago',
      reactions: [
        { emoji: '👏', label: 'Clap', count: 2 },
        { emoji: '🔥', label: 'Fire', count: 1 },
        { emoji: '💪', label: 'Strong', count: 0 },
      ],
    },
    {
      id: 'a2',
      actorName: 'Dana',
      description: 'completed Stretching',
      ago: '4h ago',
      reactions: [
        { emoji: '👏', label: 'Clap', count: 1 },
        { emoji: '🔥', label: 'Fire', count: 0 },
        { emoji: '💪', label: 'Strong', count: 1 },
      ],
    },
  ],
};

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
