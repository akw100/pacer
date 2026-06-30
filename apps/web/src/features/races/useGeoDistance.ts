import { useEffect, useRef, useState } from 'react';
import {
  haversineMeters,
  isUsableFix,
  isPlausibleStep,
  MIN_STEP_M,
  MIN_STEP_S,
  type LatLon,
} from '@pacer/shared';

export interface GeoSample {
  meters: number;
  ts: number;
}

export interface GeoDistance {
  /** Total accumulated distance (meters) of accepted fixes since `active` went true. */
  meters: number;
  /** Cumulative-distance trail, one entry per accepted fix. */
  samples: GeoSample[];
  /** False when the browser has no Geolocation API at all. */
  supported: boolean;
  /** True once the user has refused the location permission. */
  denied: boolean;
}

/**
 * Accumulate real-world distance from the device's GPS while a race is live.
 *
 * Each fix passes the same quality gates the rest of the system uses (from
 * `@pacer/shared`): the fix must be accurate enough (`isUsableFix`), the step
 * from the previous accepted fix must clear `MIN_STEP_M` / `MIN_STEP_S` (drops
 * GPS jitter while standing still), and the implied speed must be plausible
 * (`isPlausibleStep`, drops teleport spikes). Only surviving steps add to the
 * total.
 *
 * The watch id, previous accepted fix, and last-accepted timestamp live in refs
 * so re-renders never disturb the in-flight measurement. When `active` flips to
 * false the watch is cleared and the prev fix is reset, so the next race starts
 * from a clean zero.
 */
export function useGeoDistance(active: boolean): GeoDistance {
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const [meters, setMeters] = useState(0);
  const [samples, setSamples] = useState<GeoSample[]>([]);
  const [denied, setDenied] = useState(false);

  const watchId = useRef<number | null>(null);
  const prev = useRef<LatLon | null>(null);
  const lastTs = useRef<number | null>(null);

  useEffect(() => {
    if (!supported || !active) return;

    // Fresh measurement for this active window.
    prev.current = null;
    lastTs.current = null;
    setMeters(0);
    setSamples([]);

    const onPos = (pos: GeolocationPosition) => {
      if (!isUsableFix({ accuracy: pos.coords.accuracy })) return;
      const now = Date.now();
      const fix: LatLon = { lat: pos.coords.latitude, lon: pos.coords.longitude };

      // First accepted fix just anchors the trail; nothing to add yet.
      if (!prev.current || lastTs.current === null) {
        prev.current = fix;
        lastTs.current = now;
        return;
      }

      const delta = haversineMeters(prev.current, fix);
      const secondsSinceLast = (now - lastTs.current) / 1000;
      if (delta < MIN_STEP_M || secondsSinceLast < MIN_STEP_S) return;
      if (!isPlausibleStep(delta, secondsSinceLast)) return;

      prev.current = fix;
      lastTs.current = now;
      setMeters((m) => {
        const total = m + delta;
        setSamples((s) => [...s, { meters: total, ts: now }]);
        return total;
      });
    };

    const onErr = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) setDenied(true);
    };

    watchId.current = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 0,
    });

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      prev.current = null;
      lastTs.current = null;
    };
  }, [active, supported]);

  return { meters, samples, supported, denied };
}
