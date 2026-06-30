import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { invalidateLogging } from './logging.queries';
import { invalidateChallenges } from '../challenges/challenges.queries';

/**
 * App-wide subscription to the caller's own realtime channel. SERVER-SIDE saves
 * — the Telegram bot, the voice agent, any future integration — broadcast on
 * `user:<id>`; an in-app log invalidates its own queries via the mutation, but a
 * save that happens off-device only reaches the UI through this channel. Mounted
 * once in the app Shell so the logged-in UI stays fresh on every screen, not just
 * the group detail page (which is where the only subscription used to live).
 */
export function useUserRealtime(): void {
  const qc = useQueryClient();
  const userId = useAuth().session?.user.id;

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`user:${userId}`);
    channel.on('broadcast', { event: '*' }, () => {
      invalidateLogging(qc);
      qc.invalidateQueries({ queryKey: ['score', 'summary'] });
      // Off-device logging can move a challenge metric (distance/score/etc.) and
      // challenge.updated also lands here — keep the challenges hub fresh too.
      invalidateChallenges(qc);
    });
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}
