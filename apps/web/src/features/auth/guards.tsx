import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { Loader } from '../../components/Loader';
import { useAuth } from './AuthProvider';
import { useProfile } from './useProfile';

function FullScreen({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface text-sm text-ink-muted">
      {children}
    </div>
  );
}

/** Require a session. Unauthenticated users go to the sign-in page. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <FullScreen><Loader /></FullScreen>;
  if (!session) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}

/** Authed routes that need a claimed handle — first-timers go to onboarding. */
export function RequireHandle({ children }: { children: ReactNode }) {
  const { status } = useProfile();
  if (status === 'loading') return <FullScreen><Loader /></FullScreen>;
  if (status === 'error')
    return <FullScreen>Couldn’t load your profile. Refresh to retry.</FullScreen>;
  if (status === 'needs-handle')
    return <Navigate to="/onboarding/handle" replace />;
  return <>{children}</>;
}

/** The Claim-your-handle route: skip it if the user already has a handle. */
export function RequireNeedsHandle({ children }: { children: ReactNode }) {
  const { status } = useProfile();
  if (status === 'loading') return <FullScreen><Loader /></FullScreen>;
  if (status === 'error')
    return <FullScreen>Couldn’t load your profile. Refresh to retry.</FullScreen>;
  if (status === 'ready') return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Sign-in page: bounce already-authed users into the app (which then routes
 *  them to onboarding if they still need a handle). */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <FullScreen><Loader /></FullScreen>;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
}
