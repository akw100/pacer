import { NavLink } from 'react-router'
import { Home, BarChart2, Users, Trophy, User } from 'lucide-react'

const tabs = [
  { to: '/', label: 'Home', Icon: Home },
  { to: '/progress', label: 'Progress', Icon: BarChart2 },
  { to: '/group', label: 'Group', Icon: Users },
  { to: '/challenges', label: 'Challenges', Icon: Trophy },
  { to: '/profile', label: 'Profile', Icon: User },
] as const

export default function Nav() {
  return (
    <>
      {/* Mobile bottom bar */}
      <nav className="fixed bottom-0 inset-x-0 h-16 bg-surface border-t border-border flex items-center justify-around md:hidden z-10">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 text-xs transition-colors ${
                isActive ? 'text-accent' : 'text-ink-muted'
              }`
            }
          >
            <Icon size={22} strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 inset-y-0 w-56 flex-col bg-surface border-r border-border z-10 p-4 gap-1">
        <span className="font-display font-bold text-xl text-ink px-3 py-2 mb-4">Pacer</span>
        {tabs.map(({ to, label, Icon }) => (
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
      </aside>
    </>
  )
}
