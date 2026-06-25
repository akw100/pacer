import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Profile } from '@pacer/shared';
import { apiFetch, ApiError } from '../../lib/api';
import { useAuth } from './AuthProvider';

type ProfileStatus = 'loading' | 'needs-handle' | 'ready' | 'error';

interface ProfileValue {
  status: ProfileStatus;
  profile: Profile | null;
  refetch: () => void;
}

const ProfileContext = createContext<ProfileValue | null>(null);

/**
 * Loads the caller's profile once a session exists and derives whether they
 * still need to claim a handle. A 404 (no profile row yet) or a row with an
 * empty handle both count as "needs-handle" — the gate that routes a first-time
 * user to the Claim-your-handle screen.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  const [status, setStatus] = useState<ProfileStatus>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!token) {
      setStatus('loading');
      setProfile(null);
      return;
    }
    let active = true;
    setStatus('loading');
    apiFetch<Profile>('/profile/me', { token })
      .then((data) => {
        if (!active) return;
        setProfile(data);
        setStatus(data.handle ? 'ready' : 'needs-handle');
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 404) {
          setProfile(null);
          setStatus('needs-handle');
        } else {
          setStatus('error');
        }
      });
    return () => {
      active = false;
    };
  }, [token, nonce]);

  return createElement(
    ProfileContext.Provider,
    { value: { status, profile, refetch } },
    children,
  );
}

export function useProfile(): ProfileValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within <ProfileProvider>');
  return ctx;
}
