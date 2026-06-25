import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../components/Button'
import { apiFetch } from '../lib/api'
import { getAccessToken } from '../lib/supabase'

function clampNonNegative(value: number) {
  return Number.isFinite(value) && value >= 0 ? value : 0
}

export default function LogActivity() {
  const navigate = useNavigate()
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [distanceKm, setDistanceKm] = useState(5)
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [durationSeconds, setDurationSeconds] = useState(0)
  const [runDate, setRunDate] = useState(new Date().toISOString().slice(0, 10))
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    getAccessToken()
      .then((token) => setIsSignedIn(Boolean(token)))
      .finally(() => setIsCheckingAuth(false))
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    if (!isSignedIn) {
      navigate('/login')
      return
    }

    const payload = {
      distance_meters: Math.round(distanceKm * 1000),
      duration_seconds: Math.round(durationMinutes * 60 + durationSeconds),
      run_date: runDate,
    }

    try {
      await apiFetch('/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setMessage('Run saved successfully.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }

  if (isCheckingAuth) {
    return <div className="p-6">Checking sign-in status…</div>
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 rounded-card border border-border bg-surface p-5 shadow-sm shadow-ink/5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Log activity</p>
        <h1 className="mt-2 text-3xl font-display font-bold text-ink">Record a run</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Enter your run distance and duration. Negative values are disabled to keep the entry valid.
        </p>
      </div>

      {!isSignedIn ? (
        <div className="rounded-card border border-border bg-white p-6">
          <p className="text-sm text-ink-muted">You need to sign in before logging a run.</p>
          <Button onClick={() => navigate('/login')} className="mt-4">
            Go to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-6 rounded-card border border-border bg-white p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-ink-muted">
              Distance (km)
              <input
                type="number"
                min={0}
                step={0.01}
                value={distanceKm}
                onChange={(event) => setDistanceKm(clampNonNegative(Number(event.target.value)))}
                className="w-full rounded-card border border-border bg-surface px-4 py-3 text-sm text-ink"
              />
            </label>
            <label className="space-y-2 text-sm text-ink-muted">
              Duration minutes
              <input
                type="number"
                min={0}
                step={1}
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(clampNonNegative(Number(event.target.value)))}
                className="w-full rounded-card border border-border bg-surface px-4 py-3 text-sm text-ink"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-ink-muted">
              Duration seconds
              <input
                type="number"
                min={0}
                max={59}
                step={1}
                value={durationSeconds}
                onChange={(event) => setDurationSeconds(Math.min(59, clampNonNegative(Number(event.target.value))))}
                className="w-full rounded-card border border-border bg-surface px-4 py-3 text-sm text-ink"
              />
            </label>
            <label className="space-y-2 text-sm text-ink-muted">
              Date
              <input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={runDate}
                onChange={(event) => setRunDate(event.target.value)}
                className="w-full rounded-card border border-border bg-surface px-4 py-3 text-sm text-ink"
              />
            </label>
          </div>

          <Button type="submit">Save run</Button>
          {message ? <p className="text-sm text-ink-muted">{message}</p> : null}
        </form>
      )}
    </div>
  )
}
