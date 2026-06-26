import { Button } from '../components/Button'
import { useAuth } from '../features/auth/AuthProvider'
import { useProfile } from '../features/auth/useProfile'
import { FriendsSection } from '../features/friends/FriendsSection'

export default function Profile() {
  const { signOut } = useAuth()
  const { profile } = useProfile()

  return (
    <div className="p-4 md:p-6 lg:p-8 mx-auto w-full max-w-3xl flex flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink">Profile</h1>
        {profile && (
          <p className="mt-1 text-sm text-ink-muted">
            {profile.displayName} · @{profile.handle}
          </p>
        )}
      </header>

      <FriendsSection />

      <div className="flex">
        <Button variant="secondary" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  )
}
