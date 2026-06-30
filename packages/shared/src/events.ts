import type { ScoreReason } from './scoring';

// The in-process bus event catalog AND the realtime catalog. Foundation B's
// event bus and broadcast() type against these. Append-only: a new event = one
// new union member + one payload entry.

export type DomainEventName =
  | 'run.logged'
  | 'workout.logged'
  | 'habit.checked'
  | 'reaction.added'
  | 'score.awarded'
  | 'challenge.updated'
  | 'race.started'
  | 'race.finished';

export type DomainEventPayloads = {
  'run.logged': { userId: string; runId: string; runDate: string; distanceMeters: number };
  'workout.logged': { userId: string; workoutId: string; workoutDate: string };
  'habit.checked': { userId: string; habitId: string; habitCheckId: string; checkDate: string };
  'reaction.added': {
    userId: string;
    targetType: 'run' | 'workout' | 'habit_day';
    targetId: string;
  };
  'score.awarded': { userId: string; points: number; reason: ScoreReason; eventDate: string };
  'challenge.updated': { challengeId: string; userId?: string };
  'race.started': { raceId: string; startAt: string };
  'race.finished': { raceId: string; winnerId: string | null };
};

// Realtime broadcast: one channel per group + a per-user channel. Events carry
// WHAT changed (type + ids), never data — clients refetch via the normal API.
export type RealtimeChannel = `group:${string}` | `user:${string}` | `race:${string}`;
export type RealtimeEvent = { type: DomainEventName; ids: Record<string, string> };

export type RacePositionEvent = { kind: 'position'; userId: string; meters: number; ts: number };
export type RaceReactionEvent = { kind: 'reaction'; userId: string; emoji: string };
export type RaceChannelEvent = RacePositionEvent | RaceReactionEvent;
