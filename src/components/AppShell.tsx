import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { BookOpen, GraduationCap, Home, Presentation, CalendarClock } from 'lucide-react'

const tabs = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/notes', label: 'Notes', icon: BookOpen },
  { to: '/practice', label: 'Practice', icon: GraduationCap },
  { to: '/slides', label: 'Slides', icon: Presentation },
  { to: '/schedule', label: 'Schedule', icon: CalendarClock },
]

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-white dark:bg-[#161320]">
      <main className="no-scrollbar flex-1 overflow-y-auto pb-20">{children}</main>

      <nav className="fixed bottom-0 mx-auto flex w-full max-w-md border-t border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-[#161320]/95">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'
              }`
            }
          >
            <Icon size={20} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
