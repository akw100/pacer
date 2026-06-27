import { createBrowserRouter, RouterProvider, Outlet } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import Nav from './components/Nav'
import Home from './screens/Home'
import Progress from './screens/Progress'
import Group from './screens/Group'
import Challenges from './screens/Challenges'
import Profile from './screens/Profile'
import NotFound from './screens/NotFound'
import SignInPage from './features/auth/SignInPage'
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

function Shell() {
  return (
    <div className="min-h-screen bg-surface text-ink font-body">
      <Nav />
      <main className="pb-16 md:pl-56">
        <Outlet />
      </main>
    </div>
  )
}

const router = createBrowserRouter([
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
    element: (
      <RequireAuth>
        <RequireHandle>
          <Shell />
        </RequireHandle>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: 'progress', element: <Progress /> },
      { path: 'group', element: <Group /> },
      { path: 'challenges', element: <Challenges /> },
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
