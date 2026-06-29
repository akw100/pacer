import { on } from '../lib/events';
import { broadcast } from '../lib/realtime';
import { serviceClient } from '../lib/supabase';

// Challenges subscriber: when a user logs activity that could move a challenge
// (a run/workout/habit/score event), nudge their own open tabs to refetch the
// challenge list. Progress itself is derived server-side at read time, so the
// event stays compact ({ type, ids }) — the client just invalidates and refetches
// through the normal API path.
//
// We only broadcast when the user actually participates in at least one
// challenge, so non-challenge users never get pointless realtime traffic.

async function nudgeIfParticipant(userId: string): Promise<void> {
  const { count } = await serviceClient()
    .from('challenge_participants')
    .select('challenge_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('status', 'declined');
  if (!count) return;
  void broadcast(`user:${userId}`, { type: 'challenge.updated', ids: { userId } });
}

on('run.logged', ({ userId }) => nudgeIfParticipant(userId));
on('workout.logged', ({ userId }) => nudgeIfParticipant(userId));
on('habit.checked', ({ userId }) => nudgeIfParticipant(userId));
on('score.awarded', ({ userId }) => nudgeIfParticipant(userId));
