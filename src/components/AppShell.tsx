import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { BookOpen, GraduationCap, Home, Presentation, CalendarClock, GraduationCap as Logo } from 'lucide-react'

const tabs = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/notes', label: 'Notes', icon: BookOpen },
  { to: '/practice', label: 'Practice', icon: GraduationCap },
  { to: '/slides', label: 'Slides', icon: Presentation },
  { to: '/schedule', label: 'Schedule', icon: CalendarClock },
]

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh w-full bg-white dark:bg-[#161320]">
      {/* Desktop / tablet sidebar */}
      <nav className="hidden w-60 shrink-0 flex-col gap-1 border-r border-gray-200 p-4 md:flex dark:border-gray-800">
        <div className="mb-4 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Logo size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Scholar</p>
            <p className="text-[11px] text-gray-500">Class to Exam</p>
          </div>
        </div>
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                isActive
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'
                  : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900'
              }`
            }
          >
            <Icon size={18} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      <main className="no-scrollbar flex-1 overflow-y-auto pb-20 md:pb-6">
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 flex border-t border-gray-200 bg-white/95 backdrop-blur md:hidden dark:border-gray-800 dark:bg-[#161320]/95">
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
