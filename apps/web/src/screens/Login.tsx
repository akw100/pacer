import { useEffect } from 'react'
import { Button } from '../components/Button'
import { signInWithGoogle } from '../lib/supabase'

export default function Login() {
  useEffect(() => {
    document.title = 'Sign in — Pacer'
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md rounded-card border border-border bg-white p-8 shadow-sm shadow-ink/5">
        <h1 className="text-2xl font-display font-bold text-ink">Sign in</h1>
        <p className="mt-3 text-sm text-ink-muted">Continue with Google to log your runs, workouts, and habits.</p>
        <div className="mt-8 space-y-4">
          <Button type="button" onClick={() => signInWithGoogle()} className="w-full">
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  )
}
