import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../components/Button'
import { apiFetch } from '../lib/api'
import { useAuth } from '../features/auth/AuthProvider'
import { useProfile } from '../features/auth/useProfile'
import { usePatchOnboarding } from '../features/onboarding/useOnboardingState'
import { FriendsSection } from '../features/friends/FriendsSection'
import { ThemeToggle } from '../components/ThemeToggle'
import { useStepTracking } from '../features/habits/useStepTracking'

export default function Profile() {
  const { session, signOut } = useAuth()
  const { profile } = useProfile()
  const email = session?.user.email
  const token = session?.access_token
  const resetOnboarding = usePatchOnboarding()
  const [deleting, setDeleting] = useState(false)
  const { count, message, state, start } = useStepTracking()

  // Reset onboarding: null the three completion timestamps so the welcome
  // carousel + coachmark tour re-arm. The overlay (rendered globally) reads the
  // same query key, so it pops back up immediately. dismissed_hints aren't
  // cleared by the existing PATCH — minor, the core flow is the carousel/tour.
  async function handleResetOnboarding() {
    try {
      await resetOnboarding.mutateAsync({
        completed_at: null,
        skipped_at: null,
        coachmarks_done_at: null,
      })
      toast.success('Onboarding reset — the welcome flow will show again.')
    } catch {
      toast.error('Could not reset onboarding. Try again.')
    }
  }

  async function handleDeleteAccount() {
    if (!token) return
    // ponytail: native confirm is the irreversible-delete guard; swap for a
    // typed-confirmation modal if design wants more friction.
    const ok = window.confirm(
      'Delete your account? This permanently erases all your runs, habits, groups, and data. This cannot be undone.',
    )
    if (!ok) return
    setDeleting(true)
    try {
      await apiFetch<void>('/profile/me', { token, method: 'DELETE' })
      toast.success('Account deleted.')
      await signOut() // clears the session → guards bounce to /signin
    } catch {
      setDeleting(false)
      toast.error('Could not delete your account. Try again.')
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 mx-auto w-full max-w-3xl flex flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink">Profile</h1>
        {(profile || email) && (
          <p className="mt-1 text-sm text-ink-muted">
            {profile && (
              <>{profile.displayName && `${profile.displayName} · `}@{profile.handle}</>
            )}
            {profile && email && ' | '}
            {email}
          </p>
        )}
      </header>

      <FriendsSection />

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-ink">Preferences</h2>
        <div className="flex flex-col gap-3 rounded-card border border-border bg-panel p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink">Dark mode</p>
              <p className="text-xs text-ink-muted">Switch between light and dark.</p>
            </div>
            <ThemeToggle className="[--toggle-size:24px]" />
          </div>

          <div className="rounded-card border border-border/70 bg-surface p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink">Automatic step tracking</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {message ?? 'Try it on a supported phone or browser when you want live step counts.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void start()}
                className="rounded-pill bg-accent px-3 py-1.5 text-sm font-semibold text-white"
              >
                {state === 'active' ? 'Tracking…' : state === 'requesting' ? 'Requesting…' : 'Enable'}
              </button>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3 rounded-card border border-border/70 bg-panel px-3 py-2">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-ink-muted">Current count</div>
                <div className="text-2xl font-semibold text-ink">{count}</div>
              </div>
              <div className="text-right text-xs text-ink-muted">
                <div>Status: {state}</div>
                <div>Unavailable on some devices or browsers</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-ink">Account</h2>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
          <Button
            variant="secondary"
            onClick={() => void handleResetOnboarding()}
            disabled={resetOnboarding.isPending}
          >
            {resetOnboarding.isPending ? 'Resetting…' : 'Reset onboarding'}
          </Button>
        </div>

        <div className="mt-2">
          <Button
            variant="ghost"
            className="text-accent hover:text-accent hover:bg-accent/5"
            onClick={() => void handleDeleteAccount()}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete account'}
          </Button>
          <p className="mt-1 text-xs text-ink-muted">
            Permanently erases your account and all data. This can’t be undone.
          </p>
        </div>
      </section>
    </div>
  )
}
