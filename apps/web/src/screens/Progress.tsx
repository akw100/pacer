import { useState } from 'react'
import { HistorySection } from '../features/logging/HistorySection'
import { TrendsSection } from '../features/logging/TrendsSection'

type Tab = 'history' | 'trends'

export default function Progress() {
  const [tab, setTab] = useState<Tab>('history')
  return (
    <div className="p-4 flex flex-col gap-5 max-w-3xl mx-auto">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Progress</h1>
        <div className="inline-flex rounded-pill border border-border bg-surface p-0.5">
          {(['history', 'trends'] as const).map((t) => {
            const active = tab === t
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-pill px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  active ? 'bg-ink text-surface' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {t}
              </button>
            )
          })}
        </div>
      </header>
      {tab === 'history' ? <HistorySection /> : <TrendsSection />}
    </div>
  )
}
