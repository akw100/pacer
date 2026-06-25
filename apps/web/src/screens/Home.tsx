import { HomeDashboard } from '../features/home/HomeDashboard'
import HabitsSection from '../features/habits/HabitsSection'

export default function Home() {
  return (
    <div className="flex flex-col gap-6 pb-6">
      <HomeDashboard />
      <div className="px-4 mx-auto w-full max-w-5xl">
        <HabitsSection />
      </div>
    </div>
  )
}
