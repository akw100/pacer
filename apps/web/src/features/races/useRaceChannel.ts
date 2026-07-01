import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RaceChannelEvent, RaceReactionEvent } from '@pacer/shared';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { raceKeys } from './api';

const POSITION_THROTTLE_MS = 2000;

export interface RaceChannel {
  /** Latest broadcast distance (meters) per runner user id. */
  positions: Record<string, number>;
  /** The most recent reaction anyone sent, for a transient cheer animation. */
  lastReaction: RaceReactionEvent | null;
  /** Broadcast my current distance (throttled to once per 2s). */
  broadcastPosition: (meters: number) => void;
  /** Broadcast an emoji reaction (no throttle). */
  broadcastReaction: (emoji: string) => void;
}

/**
 * Subscribe to a race's realtime channel (`race:<id>`) for the duration of the
 * lobby/run. Two classes of message arrive on the same channel:
 *
 *  - App-level lifecycle broadcasts the API emits (`event: 'race.started'` /
 *    `'race.finished'` / `'race.lobby'`) → just invalidate the detail query so
 *    authoritative state (status, winner, participant rows) is refetched
 *    through the API.
 *  - Browser→browser race events (`event: 'race'`) carrying a `RaceChannelEvent`
 *    payload → `position` updates the live ticker, `reaction` fires a cheer.
 *    These are never persisted; they live only on the wire.
 *
 * The current user id comes from the app's auth session (the same source every
 * other slice uses); position broadcasts are tagged with it and throttled.
 */
export function useRaceChannel(raceId: string): RaceChannel {
  const qc = useQueryClient();
  const userId = useAuth().session?.user.id ?? null;

  const [positions, setPositions] = useState<Record<string, number>>({});
  const [lastReaction, setLastReaction] = useState<RaceReactionEvent | null>(null);

  // The live channel handle (for send) and the last position-send timestamp,
  // kept in refs so the broadcast callbacks stay stable across renders.
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    if (!raceId) return;
    const channel = supabase.channel(`race:${raceId}`, { config: { broadcast: { self: true } } });
    channelRef.current = channel;

    // API lifecycle broadcasts → refetch authoritative race state.
    const invalidate = () => qc.invalidateQueries({ queryKey: raceKeys.detail(raceId) });
    channel.on('broadcast', { event: 'race.started' }, invalidate);
    channel.on('broadcast', { event: 'race.finished' }, invalidate);
    channel.on('broadcast', { event: 'race.lobby' }, invalidate);

    // Browser race events (position ticks + reactions).
    channel.on('broadcast', { event: 'race' }, ({ payload }) => {
      const ev = payload as RaceChannelEvent;
      if (ev.kind === 'position') {
        setPositions((p) => ({ ...p, [ev.userId]: ev.meters }));
      } else {
        setLastReaction(ev);
      }
    });

    channel.subscribe();
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [raceId, qc]);

  const broadcastPosition = (meters: number) => {
    if (!userId || !channelRef.current) return;
    const now = Date.now();
    if (now - lastSent.current < POSITION_THROTTLE_MS) return;
    lastSent.current = now;
    void channelRef.current.send({
      type: 'broadcast',
      event: 'race',
      payload: { kind: 'position', userId, meters, ts: now },
    });
  };

  const broadcastReaction = (emoji: string) => {
    if (!userId || !channelRef.current) return;
    void channelRef.current.send({
      type: 'broadcast',
      event: 'race',
      payload: { kind: 'reaction', userId, emoji },
    });
  };

  return { positions, lastReaction, broadcastPosition, broadcastReaction };
}
