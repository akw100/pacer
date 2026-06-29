import { createBrowserRouter, RouterProvider, Outlet, Navigate, useLocation } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import Nav from './components/Nav'
import { Loader } from './components/Loader'
import Home from './screens/Home'
import Progress from './screens/Progress'
import Group from './screens/Group'
import Challenges from './screens/Challenges'
import Frames from './screens/Frames'
import Profile from './screens/Profile'
import NotFound from './screens/NotFound'
import SignInPage from './features/auth/SignInPage'
import LandingPage from './features/landing/LandingPage'
import ClaimHandlePage from './features/auth/ClaimHandlePage'
import {
  RequireAuth,
  RequireHandle,
  RequireNeedsHandle,
  RedirectIfAuthed,
} from './features/auth/guards'
import { LogSheetMount } from './features/logging/LogSheet'
import { OnboardingFlow } from './features/onboarding/OnboardingFlow'
import { CoachmarkTour } from './features/onboarding/CoachmarkTour'
import { ContextualHints } from './features/onboarding/ContextualHints'
import { HowPacerWorksSheet } from './features/onboarding/HowPacerWorksSheet'
import { OfflineShell } from './pwa/OfflineShell'
import { useAuth } from './features/auth/AuthProvider'
import { GroupProvider } from './features/groups/GroupContext'
import { VoiceAgent } from './features/voice/VoiceAgent'
import { useUserRealtime } from './features/logging/useUserRealtime'

function Shell() {
  // Keep the logged-in UI fresh on every screen when a run/workout is saved
  // off-device (Telegram bot, voice agent) — see useUserRealtime.
  useUserRealtime()
  return (
    <div className="min-h-screen bg-surface text-ink font-body">
      <Nav />
      <main className="pb-16 md:pl-56">
        <Outlet />
      </main>
      <VoiceAgent />
    </div>
  )
}

// Root route gate. Logged out → the marketing landing page IS the root `/`
// (also reachable at the named `/welcome` route); deeper app routes still
// bounce to sign-in. Logged in → claim-handle gate, then the app shell.
function RootGate() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader />
      </div>
    )
  if (!session)
    return location.pathname === '/' ? <LandingPage /> : <Navigate to="/signin" replace />
  return (
    <RequireHandle>
      <Shell />
    </RequireHandle>
  )
}

const router = createBrowserRouter([
  {
    // Public marketing landing page — viewable logged-out, outside the auth gate.
    path: '/welcome',
    element: <LandingPage />,
  },
  {
    path: '/signin',
    element: (
      <RedirectIfAuthed>
        <SignInPage />
      </RedirectIfAuthed>
    ),
  },
  {
    path: '/onboarding/handle',
    element: (
      <RequireAuth>
        <RequireNeedsHandle>
          <ClaimHandlePage />
        </RequireNeedsHandle>
      </RequireAuth>
    ),
  },
  {
    path: '/',
    element: <RootGate />,
    children: [
      { index: true, element: <Home /> },
      { path: 'progress', element: <Progress /> },
      { path: 'group', element: <Group /> },
      { path: 'challenges', element: <Challenges /> },
      { path: 'flows', element: <Frames /> },
      { path: 'profile', element: <Profile /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

const queryClient = new QueryClient()

// Onboarding overlays only render once the user is authenticated. They guard
// themselves further (need a claimed handle / no completed_at) but we still
// short-circuit unauthed renders so we don't fire /onboarding/state on the
// sign-in screen.
function AuthedOverlays() {
  const { session } = useAuth()
  if (!session) return null
  return (
    <>
      <OnboardingFlow />
      <CoachmarkTour />
      <ContextualHints />
      <HowPacerWorksSheet />
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GroupProvider>
        <RouterProvider router={router} />
        <LogSheetMount />
        <AuthedOverlays />
      </GroupProvider>
      <OfflineShell />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  )
}
