import { NavLink } from 'react-router'
import { Home, BarChart2, Users, Trophy, User, Plus, Clapperboard, Sparkles, Swords, CalendarRange } from 'lucide-react'
import { openLogSheet } from '../features/logging/LogSheet'

const tabs = [
  { to: '/', label: 'Home', Icon: Home },
  { to: '/progress', label: 'Progress', Icon: BarChart2 },
  { to: '/group', label: 'Group', Icon: Users },
  { to: '/challenges', label: 'Challenges', Icon: Trophy },
  { to: '/races', label: 'Races', Icon: Swords },
  { to: '/planning', label: 'Planning', Icon: CalendarRange },
  { to: '/flows', label: 'Flows', Icon: Clapperboard },
  { to: '/profile', label: 'Profile', Icon: User },
] as const

const tabLink = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center gap-0.5 text-xs transition-colors ${isActive ? 'text-accent' : 'text-ink-muted'}`

export default function Nav() {
  return (
    <>
      {/* Mobile bottom bar — 2 | FAB | 3 split */}
      <nav className="fixed bottom-0 inset-x-0 h-16 bg-panel border-t border-border flex items-center md:hidden z-10">
        <div className="flex-1 flex items-center justify-around">
          {tabs.slice(0, 2).map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={tabLink}>
              <Icon size={22} strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </div>
        <button
          onClick={() => openLogSheet()}
          className="-mt-5 w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/25 active:scale-95 transition-transform shrink-0"
          aria-label="Log activity"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
        <div className="flex-1 flex items-center justify-around">
          {tabs.slice(2).map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={tabLink}>
              <Icon size={22} strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 inset-y-0 w-56 flex-col bg-panel border-r border-border z-10 p-4 gap-1">
        <span className="font-display font-bold text-xl text-ink px-3 py-2 mb-4">Pacer</span>
        {/* Render every tab EXCEPT Profile — Profile is pinned as the last
            regular app-screen entry, below Coach. Mobile is unaffected: the
            mobile bar reads the FULL `tabs` array via .slice(0, 2) / .slice(2)
            below, so Profile stays at its existing rightmost slot there. */}
        {tabs.filter(({ to }) => to !== '/profile').map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-card text-sm transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-ink hover:bg-ink/5'
              }`
            }
          >
            <Icon size={18} strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}

        {/* Desktop-only Coach entry. Kept outside the shared `tabs` array so
            the mobile bottom bar stays at its current 8 tabs — Coach is also
            reachable from anywhere via the floating "Ask Coach" pill
            (CoachLauncher). */}
        <NavLink
          to="/coach"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-card text-sm transition-colors ${
              isActive
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-ink hover:bg-ink/5'
            }`
          }
        >
          <Sparkles size={18} strokeWidth={1.8} />
          Coach
        </NavLink>

        {/* Profile — pinned last among regular app screens on desktop only. */}
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-card text-sm transition-colors ${
              isActive
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-ink hover:bg-ink/5'
            }`
          }
        >
          <User size={18} strokeWidth={1.8} />
          Profile
        </NavLink>

        {/* Link to the public marketing landing page (also the logged-out root). */}
        <NavLink
          to="/welcome"
          className="mt-auto flex items-center gap-3 px-3 py-2.5 rounded-card text-sm text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <Sparkles size={18} strokeWidth={1.8} />
          Landing page
        </NavLink>
      </aside>
    </>
  )
}
