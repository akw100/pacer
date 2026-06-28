import { Link } from 'react-router'
import { Compass } from 'lucide-react'

// Catch-all for unknown routes — renders inside the app shell (nav stays), so
// the user can navigate away instead of hitting react-router's raw default.
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Compass size={26} strokeWidth={1.8} />
      </div>
      <h1 className="font-display text-2xl font-bold text-ink">Page not found</h1>
      <p className="mt-2 text-sm text-ink-muted">
        This page doesn’t exist or may have moved.
      </p>
      <Link
        to="/"
        className="mt-5 inline-flex items-center justify-center rounded-pill bg-accent px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent/90 active:scale-[0.97]"
      >
        Back to Home
      </Link>
    </div>
  )
}
