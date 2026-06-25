import { useState } from 'react'
import { Button } from '../components/Button'
import HabitsSection from '../features/habits/HabitsSection'
import ProgressCalendar from '../features/progress/ProgressCalendar'
import ProgressRecords from '../features/progress/ProgressRecords'
import { HistorySection } from '../features/logging/HistorySection'
import { TrendsSection } from '../features/logging/TrendsSection'
import { CommunityCard } from '../features/platform-stats/CommunityCard'

const tabs = ['Trends', 'Calendar', 'History', 'Records'] as const

type Tab = (typeof tabs)[number]

function TabButton({ label, active, onClick }: { label: Tab; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-pill px-4 py-2 text-sm font-semibold transition ${
        active ? 'bg-accent text-white' : 'bg-surface text-ink'
      }`}
    >
      {label}
    </button>
  )
}

export default function Progress() {
  const [selectedTab, setSelectedTab] = useState<Tab>('Calendar')

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 grid gap-4 rounded-card border border-border bg-surface p-6 shadow-sm shadow-ink/5 md:grid-cols-[1.4fr_0.8fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Progress</p>
          <h1 className="mt-2 text-3xl font-display font-bold text-ink">Your streak, calendar, and records</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted">
            Explore your habit momentum, see your logged activity on the calendar, and celebrate your personal bests.
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-card border border-border bg-white p-4">
          <div className="rounded-card bg-surface p-4">
            <p className="text-sm text-ink-muted">Weekly score</p>
            <p className="mt-2 text-3xl font-display font-bold text-ink">142 pts</p>
          </div>
          <div className="rounded-card bg-surface p-4">
            <p className="text-sm text-ink-muted">Current streak</p>
            <p className="mt-2 text-3xl font-display font-bold text-ink">14 days</p>
          </div>
          <Button variant="secondary" className="w-full">View all trends</Button>
        </div>
      </div>

      <HabitsSection />

      <div className="mt-8 rounded-card border border-border bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          {tabs.map((tab) => (
            <TabButton
              key={tab}
              label={tab}
              active={tab === selectedTab}
              onClick={() => setSelectedTab(tab)}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {selectedTab === 'Calendar' && <ProgressCalendar />}
        {selectedTab === 'Records' && <ProgressRecords />}
        {selectedTab === 'Trends' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_22rem] items-start">
            <TrendsSection />
            <CommunityCard />
          </div>
        )}
        {selectedTab === 'History' && <HistorySection />}
      </div>
    </div>
  )
}
