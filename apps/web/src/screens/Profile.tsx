import { Button } from '../components/Button'
import { useAuth } from '../features/auth/AuthProvider'
import { useProfile } from '../features/auth/useProfile'

export default function Profile() {
  const { signOut } = useAuth()
  const { profile } = useProfile()

  return (
    <div className="p-4">
      <h1 className="font-display text-2xl font-bold text-ink">Profile</h1>
      {profile && (
        <p className="mt-1 text-sm text-ink-muted">
          {profile.displayName} · @{profile.handle}
        </p>
      )}
      <Button variant="secondary" onClick={() => void signOut()} className="mt-6">
        Sign out
      </Button>
    </div>
  )
}
