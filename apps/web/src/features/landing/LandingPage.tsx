import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Activity, Flame, Trophy, Users, Zap } from 'lucide-react'

import { publicGet } from '@/lib/api'

import { ScrollProgress } from '@/components/magicui/scroll-progress'
import { Pointer } from '@/components/magicui/pointer'
import { AnimatedGradientText } from '@/components/magicui/animated-gradient-text'
import { LineShadowText } from '@/components/magicui/line-shadow-text'
import { TextAnimate } from '@/components/magicui/text-animate'
import { OrbitingCircles } from '@/components/magicui/orbiting-circles'
import { CoolMode } from '@/components/magicui/cool-mode'
import { InteractiveHoverButton } from '@/components/magicui/interactive-hover-button'
import { ShinyButton } from '@/components/magicui/shiny-button'
import { SparklesText } from '@/components/magicui/sparkles-text'
import { RippleButton } from '@/components/magicui/ripple-button'
import { PulsatingButton } from '@/components/magicui/pulsating-button'
import {
  ScrollVelocityContainer,
  ScrollVelocityRow,
} from '@/components/magicui/scroll-based-velocity'
import { BentoCard, BentoGrid } from '@/components/magicui/bento-grid'
import { AnimatedList } from '@/components/magicui/animated-list'
import { NeonGradientCard } from '@/components/magicui/neon-gradient-card'
import { DiaTextReveal } from '@/components/magicui/dia-text-reveal'
import Text3DFlip from '@/components/magicui/text-3d-flip'
import { StripedPattern } from '@/components/magicui/striped-pattern'

// Page W (public marketing landing). Lives outside the auth gate at /welcome.
// Showcases the product to logged-out visitors; every CTA routes to /signin.
// Built entirely from the MagicUI components under @/components/magicui, all
// recolored to the warm Pacer palette (coral / amber / green, no purple,
// per docs/06-TECH-STACK.md "not AI-made").
export default function LandingPage() {
  const navigate = useNavigate()
  const goSignIn = () => navigate('/signin')

  return (
    <div className="min-h-screen overflow-x-hidden bg-surface font-body text-ink">
      <ScrollProgress className="h-1" />
      <Header onSignIn={goSignIn} />
      <Hero onSignIn={goSignIn} />
      <Marquee />
      <Features onSignIn={goSignIn} />
      <Reveal />
      <StatBand />
      <InviteCta onSignIn={goSignIn} />
      <FinalCta onSignIn={goSignIn} />
      <Footer />
    </div>
  )
}

/* ------------------------------------------------------------------ header */

function Header({ onSignIn }: { onSignIn: () => void }) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-surface/80 px-5 py-3 backdrop-blur-sm md:px-10">
      <span className="font-display text-2xl font-bold tracking-tight text-ink">
        Pacer<span className="text-accent">.</span>
      </span>
      <button
        onClick={onSignIn}
        className="rounded-pill px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
      >
        Sign in
      </button>
    </header>
  )
}

/* -------------------------------------------------------------------- hero */

const ORBIT_OUTER = ['🏃', '🚴', '🏊', '🏋️', '🥾']
const ORBIT_INNER = ['🧘', '👟', '🔥']

function Hero({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section className="relative px-5 pb-16 pt-12 md:px-10 md:pb-24 md:pt-20">
      <Pointer />

      <div className="grid items-center gap-10 md:grid-cols-2">
        <div className="flex flex-col items-start gap-6 md:ml-12">
        <div className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-panel px-3 py-1 text-sm font-medium">
          <span aria-hidden>🏅</span>
          <AnimatedGradientText colorFrom="#FF5A36" colorTo="#F5A623">
            Built for families & small crews
          </AnimatedGradientText>
        </div>

        <h1 className="font-display text-5xl font-bold leading-[0.95] tracking-tight text-ink md:text-7xl">
          Track every run.
          <br />
          Move{' '}
          <LineShadowText className="italic" shadowColor="#FF5A36">
            together
          </LineShadowText>
          .
        </h1>

        <TextAnimate
          as="p"
          by="word"
          animation="blurInUp"
          className="max-w-md text-lg text-ink-muted"
        >
          Log runs, workouts and habits, earn points, and climb a private
          leaderboard with the people you actually move with.
        </TextAnimate>

        <div className="flex flex-wrap items-center gap-3">
          <InteractiveHoverButton onClick={onSignIn}>
            Get started for free
          </InteractiveHoverButton>
        </div>
      </div>

      {/* orbiting activities — scaled down on mobile (radius is a fixed px prop) */}
      <div className="relative flex h-64 scale-[0.7] items-center justify-center md:h-[26rem] md:scale-100">
        <OrbitingCircles radius={150} iconSize={46} duration={26}>
          {ORBIT_OUTER.map((e) => (
            <span key={e} className="text-2xl">
              {e}
            </span>
          ))}
        </OrbitingCircles>
        <OrbitingCircles radius={92} iconSize={36} duration={18} reverse speed={1.4}>
          {ORBIT_INNER.map((e) => (
            <span key={e} className="text-xl">
              {e}
            </span>
          ))}
        </OrbitingCircles>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- marquee */

const MARQUEE = [
  '5K 🏃', 'LONG RUN', 'LEG DAY 💪', '10K STEPS 👟', 'NEW PR 🏆',
  '7-DAY STREAK 🔥', 'FAMILY LEAGUE', 'RECOVERY 🧘', 'TEMPO INTERVALS', 'RIDE 🚴',
]

function Marquee() {
  const item = (label: string) => (
    <span key={label} className="mx-6 font-display text-3xl font-semibold text-ink/25 md:text-5xl">
      {label}
    </span>
  )
  return (
    <section className="border-y border-border bg-panel py-6">
      <ScrollVelocityContainer className="flex flex-col gap-2">
        <ScrollVelocityRow baseVelocity={5} direction={1}>
          {MARQUEE.map(item)}
        </ScrollVelocityRow>
        <ScrollVelocityRow baseVelocity={5} direction={-1}>
          {MARQUEE.map((l) => item(l + ' '))}
        </ScrollVelocityRow>
      </ScrollVelocityContainer>
    </section>
  )
}

/* ---------------------------------------------------------------- features */

function Features({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section id="features" className="px-5 py-20 md:px-10">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <h2 className="font-display text-4xl font-bold text-ink md:text-5xl">
          Everything you need to keep moving
        </h2>
        <div className="mt-6 flex justify-center">
          <ShinyButton onClick={onSignIn}>See how it works</ShinyButton>
        </div>
      </div>

      <BentoGrid className="mx-auto max-w-5xl auto-rows-[20rem] grid-cols-1 gap-4 md:grid-cols-3">
        <BentoCard
          name="Live family feed"
          className="md:col-span-2"
          Icon={Users}
          description="See every run, lift and habit your crew logs, the moment it happens."
          href="/signin"
          cta="Join your crew"
          background={<FeedBackground />}
        />
        <BentoCard
          name="Streaks that stick"
          className="md:col-span-1"
          Icon={Flame}
          description="Daily habits and momentum you won't want to break."
          href="/signin"
          cta="Start a streak"
          background={<StreakChart />}
        />
        <BentoCard
          name="Everything in sync"
          className="md:col-span-1"
          Icon={Zap}
          description="Log on your phone, watch or via Telegram, and it shows up everywhere instantly."
          href="/signin"
          cta="Learn more"
          background={<SyncedDevices />}
        />
        <BentoCard
          name="Climb the leaderboard"
          className="md:col-span-2"
          Icon={Trophy}
          description="Fair, transparent scoring. Watch the ranks reshuffle in real time."
          href="/signin"
          cta="See scoring"
          background={<LeaderboardBackground />}
        />
      </BentoGrid>
    </section>
  )
}

const FEED = [
  { emoji: '🏃‍♀️', name: 'Mom', text: 'logged a 5K run', pts: '+50', ring: 'border-accent/30' },
  { emoji: '🔥', name: 'Dad', text: 'hit a 7-day streak', pts: '+30', ring: 'border-streak/30' },
  { emoji: '🏋️', name: 'You', text: 'crushed leg day', pts: '+40', ring: 'border-success/30' },
]

function FeedBackground() {
  return (
    <AnimatedList
      delay={1800}
      className="absolute inset-x-0 top-0 h-[52%] justify-start gap-2 overflow-hidden p-3 [mask-image:linear-gradient(to_bottom,black_60%,transparent)]"
    >
      {FEED.map((f) => (
        <div
          key={f.name + f.text}
          className={`flex w-full max-w-xs items-center gap-3 rounded-pill border ${f.ring} bg-surface px-3 py-2 shadow-sm`}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-pill bg-panel text-lg">
            {f.emoji}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-ink">
            <span className="font-semibold">{f.name}</span>{' '}
            <span className="text-ink-muted">{f.text}</span>
          </span>
          <span className="font-display text-sm font-bold text-success">{f.pts}</span>
        </div>
      ))}
    </AnimatedList>
  )
}

// Momentum bars for the "Streaks that stick" card.
// ponytail: sample data; this is decoration, not a real chart.
const STREAK_BARS = [35, 50, 42, 65, 58, 80, 96]

function StreakChart() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[56%] items-end gap-2 p-5 [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">
      {STREAK_BARS.map((h, i) => (
        <div
          key={i}
          style={{ height: `${h}%` }}
          className="flex-1 rounded-card bg-streak/60 transition-all duration-300 group-hover:bg-streak"
        />
      ))}
    </div>
  )
}

const SYNC_DEVICES = ['📱', '⌚', '💬']

// Calm "everything in sync" visual: devices on a single static line,
// no animated beams. They lift together on hover.
function SyncedDevices() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[52%] items-center justify-center px-6 pt-3">
      <div className="absolute left-1/2 top-1/2 h-px w-2/3 -translate-x-1/2 -translate-y-1/2 bg-border" />
      <div className="relative flex items-center gap-3 transition-transform duration-300 group-hover:-translate-y-1">
        {SYNC_DEVICES.map((e) => (
          <div
            key={e}
            className="grid size-12 place-items-center rounded-card border border-border bg-surface text-2xl shadow-sm"
          >
            {e}
          </div>
        ))}
      </div>
    </div>
  )
}

const RANKS = [
  { pos: 1, emoji: '🥇', name: 'Mom', pts: 2480 },
  { pos: 2, emoji: '🥈', name: 'You', pts: 2310 },
  { pos: 3, emoji: '🥉', name: 'Dad', pts: 1990 },
]

function LeaderboardBackground() {
  return (
    <div className="absolute inset-x-0 top-0 flex h-[56%] flex-col justify-start gap-2 p-5 [mask-image:linear-gradient(to_bottom,black_68%,transparent)]">
      {RANKS.map((r) => (
        <div
          key={r.pos}
          className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-2"
        >
          <span className="text-xl">{r.emoji}</span>
          <span className="flex-1 text-sm font-semibold text-ink">{r.name}</span>
          <span className="font-display text-lg font-bold text-accent">
            {r.pts.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ reveal */

function Reveal() {
  return (
    <section className="flex flex-col items-center gap-6 px-5 py-20 text-center md:px-10">
      <Text3DFlip className="font-display text-2xl font-semibold text-accent">
        Run · Lift · Streak
      </Text3DFlip>

      <DiaTextReveal
        text="Built for the people you actually move with."
        className="max-w-3xl font-display text-3xl font-bold leading-tight md:text-5xl"
      />

      <p className="max-w-xl text-lg text-ink-muted">
        No ads, no strangers, no noise. Just{' '}
        <span className="font-semibold text-accent">your people</span> cheering
        each other on.
      </p>
    </section>
  )
}

/* --------------------------------------------------------------- stat band */

// Site-wide social-proof stat: real all-time kilometers across all users,
// from the public (no-auth) /public/stats endpoint. Tap it for a burst of
// runners (cool-mode).
function StatBand() {
  const [totalKm, setTotalKm] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    publicGet<{ totalKm: number }>('/public/stats')
      .then((d) => alive && setTotalKm(d.totalKm))
      .catch(() => {}) // non-critical; the stat just stays hidden on failure
    return () => {
      alive = false
    }
  }, [])

  // Render nothing until there's real mileage (or if the call fails) — better a
  // missing band than "—", a fake figure, or a "0 km" brag on a marketing page.
  if (totalKm == null || totalKm <= 0) return null

  return (
    <section className="flex justify-center px-5 pb-4 md:px-10">
      <CoolMode options={{ particle: '🏃', size: 32, particleCount: 14 }}>
        <button
          className="flex flex-col items-center gap-1 rounded-card px-8 py-6 transition-transform active:scale-95"
          aria-label="Tap to celebrate the kilometers Pacers have logged"
        >
          <span className="font-display text-6xl font-bold text-accent md:text-7xl">
            {totalKm.toLocaleString()}
          </span>
          <span className="text-sm uppercase tracking-wide text-ink-muted">
            kilometers logged by Pacers
          </span>
        </button>
      </CoolMode>
    </section>
  )
}

/* --------------------------------------------------------------- invite cta */

function InviteCta({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section className="px-5 pb-20 md:px-10">
      <NeonGradientCard
        className="mx-auto max-w-md text-center"
        neonColors={{ firstColor: '#FF5A36', secondColor: '#F5A623' }}
      >
        <div className="flex flex-col items-center gap-3 p-2">
          <span className="text-4xl">🎉</span>
          <h3 className="font-display text-2xl font-bold text-ink">Bring your people</h3>
          <p className="text-sm text-ink-muted">
            Free to start. Add your family or training crew and start logging
            today.
          </p>
          <RippleButton onClick={onSignIn} className="mt-2" rippleColor="#FFFFFF">
            Get started
          </RippleButton>
        </div>
      </NeonGradientCard>
    </section>
  )
}

/* --------------------------------------------------------------- final cta */

function FinalCta({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section className="flex flex-col items-center gap-6 px-5 pb-24 text-center md:px-10">
      <Activity size={32} strokeWidth={1.8} className="text-accent" />
      <SparklesText
        sparklesCount={8}
        className="max-w-2xl font-display text-4xl font-bold text-ink md:text-6xl"
      >
        Start your streak today
      </SparklesText>
      <PulsatingButton onClick={onSignIn} className="px-7 py-3 text-base">
        Get started, it's free
      </PulsatingButton>
    </section>
  )
}

/* ------------------------------------------------------------------ footer */

function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-border bg-panel px-5 py-12 md:px-10">
      <StripedPattern className="text-ink/[0.05]" />
      <div className="relative z-20 mx-auto flex max-w-5xl flex-col gap-10">
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-between">
          <div className="flex max-w-xs flex-col items-center gap-3 text-center md:items-start md:text-left">
            <span className="font-display text-2xl font-bold text-ink">
              Pacer<span className="text-accent">.</span>
            </span>
            <p className="text-sm text-ink-muted">
              Log runs, workouts and habits, earn points, and climb a private
              leaderboard with the people you actually move with.
            </p>
          </div>

          <nav className="flex flex-col items-center gap-2 text-sm md:items-start">
            <span className="font-semibold text-ink">Explore</span>
            <a href="#features" className="text-ink-muted transition-colors hover:text-ink">
              Features
            </a>
            <a href="#features" className="text-ink-muted transition-colors hover:text-ink">
              How scoring works
            </a>
            <Link to="/signin" className="text-ink-muted transition-colors hover:text-ink">
              Sign in
            </Link>
          </nav>

          <div className="flex max-w-xs flex-col items-center gap-2 text-center text-sm md:items-start md:text-left">
            <span className="font-semibold text-ink">Get started</span>
            <p className="text-ink-muted">
              Free for families and small crews. No ads, no strangers, no noise.
            </p>
            <Link to="/signin" className="font-medium text-accent hover:underline">
              Create your league →
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 border-t border-border/60 pt-6 text-xs text-ink-muted md:flex-row">
          <span>© 2026 Pacer. Built for the people you move with.</span>
          <span className="font-display tracking-wide">Run · Lift · Streak</span>
        </div>
      </div>
    </footer>
  )
}
