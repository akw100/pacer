import { useCallback, useEffect, useRef, useState } from 'react';
import { StepCounter } from '@pacer/shared';

export type StepTrackingState = 'idle' | 'requesting' | 'active' | 'unsupported' | 'denied' | 'error';

const SHARE_WITH_FRIENDS_STORAGE_KEY = 'pacer.step-tracking.share-with-friends';

function readSharePreference(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SHARE_WITH_FRIENDS_STORAGE_KEY) === '1';
}

export function useStepTracking() {
  const [state, setState] = useState<StepTrackingState>('idle');
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [shareWithFriends, setShareWithFriends] = useState(readSharePreference);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
      setState('unsupported');
      setMessage('This browser or device does not expose motion sensors for step counting.');
      return;
    }

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SHARE_WITH_FRIENDS_STORAGE_KEY, shareWithFriends ? '1' : '0');
  }, [shareWithFriends]);

  const start = useCallback(async () => {
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
      setState('unsupported');
      setMessage('This browser or device does not expose motion sensors for step counting.');
      return;
    }

    cleanupRef.current?.();
    cleanupRef.current = null;
    setCount(0);
    setMessage(null);

    try {
      const MotionEvent = window.DeviceMotionEvent as typeof DeviceMotionEvent & {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };

      if (typeof MotionEvent.requestPermission === 'function') {
        setState('requesting');
        const permission = await MotionEvent.requestPermission();
        if (permission !== 'granted') {
          setState('denied');
          setMessage('Motion permission was denied. Enable it in browser settings to use step tracking.');
          return;
        }
      }

      const counter = new StepCounter();
      const handleMotion = (event: DeviceMotionEvent) => {
        const acceleration = event.accelerationIncludingGravity;
        if (!acceleration) return;

        const nextCount = counter.addSample({
          x: acceleration.x ?? 0,
          y: acceleration.y ?? 0,
          z: acceleration.z ?? 0,
          timestamp: Date.now(),
        });

        setCount(nextCount);
      };

      window.addEventListener('devicemotion', handleMotion as EventListener);
      cleanupRef.current = () => {
        window.removeEventListener('devicemotion', handleMotion as EventListener);
      };
      setState('active');
      setMessage('Step tracking is running. Move naturally and the count will update live.');
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      setState('error');
      setMessage(`Could not start step tracking: ${detail}`);
    }
  }, []);

  const toggleShare = useCallback(() => {
    setShareWithFriends((current) => !current);
  }, []);

  return { count, message, state, start, shareWithFriends, toggleShare };
}
