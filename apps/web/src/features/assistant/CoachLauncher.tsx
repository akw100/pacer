import { Link, useLocation } from 'react-router'
import { Sparkles } from 'lucide-react'

// Coach-owned global entry pill. Renders fixed at top-right on every
// authenticated screen except /coach itself (where it would just point at
// the page you're on). Deliberately positioned away from the two existing
// FABs (Log FAB — center of mobile nav; Voice FAB — bottom-right) so it
// doesn't visually compete.
//
// The pill is a plain <Link>: URL-based navigation keeps browser back /
// deep-linking / bookmarking working. z-20 matches the Voice FAB so it
// sits above nav but below any active drawer/overlay.
export function CoachLauncher() {
  const { pathname } = useLocation()
  if (pathname === '/coach') return null

  return (
    <div
      className="fixed z-20"
      style={{
        top: 'calc(0.75rem + env(safe-area-inset-top, 0px))',
        right: 'calc(0.75rem + env(safe-area-inset-right, 0px))',
      }}
    >
      <Link
        to="/coach"
        aria-label="Open Pacer Coach"
        className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-panel px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition-colors hover:bg-ink/5"
      >
        <Sparkles size={14} className="text-accent" strokeWidth={1.8} />
        Ask Coach
      </Link>
    </div>
  )
}
