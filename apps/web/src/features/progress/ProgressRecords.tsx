import { Sparkles, Award, TrendingUp, Clock3 } from 'lucide-react'

type RecordItem = {
  label: 'Fastest pace' | 'Longest run' | 'Biggest week' | 'Longest streak'
  value: string
  detail: string
}

const records: RecordItem[] = [
  { label: 'Fastest pace', value: '4:45', detail: '5 km run · Jun 21' },
  { label: 'Longest run', value: '12.4 km', detail: 'Jun 19 · 1:08' },
  { label: 'Biggest week', value: '48 km', detail: 'Jun 18–24' },
  { label: 'Longest streak', value: '14 days', detail: 'Jun 24' },
]

const icons: Record<RecordItem['label'], typeof Award> = {
  'Fastest pace': Award,
  'Longest run': TrendingUp,
  'Biggest week': Sparkles,
  'Longest streak': Clock3,
}

export default function ProgressRecords() {
  return (
    <section className="space-y-4 rounded-card border border-border bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Records</p>
          <h2 className="mt-2 text-xl font-display font-bold text-ink">Personal bests</h2>
        </div>
        <span className="inline-flex items-center gap-2 rounded-pill bg-accent/10 px-3 py-2 text-sm font-semibold text-accent">
          <Sparkles size={16} /> Freshest PRs
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {records.map((record) => {
          const Icon = icons[record.label] as typeof Award
          return (
            <div key={record.label} className="rounded-card border border-border bg-surface p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
                  <Icon size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{record.label}</p>
                  <p className="text-2xl font-display font-bold text-ink">{record.value}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-ink-muted">{record.detail}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
