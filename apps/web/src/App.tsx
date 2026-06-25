import { createBrowserRouter, RouterProvider, Outlet } from 'react-router'
import Nav from './components/Nav'
import Home from './screens/Home'
import Progress from './screens/Progress'
import Group from './screens/Group'
import Challenges from './screens/Challenges'
import Profile from './screens/Profile'
import SignInPage from './features/auth/SignInPage'
import ClaimHandlePage from './features/auth/ClaimHandlePage'
import {
  RequireAuth,
  RequireHandle,
  RequireNeedsHandle,
  RedirectIfAuthed,
} from './features/auth/guards'

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
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
