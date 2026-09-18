import { useEffect, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  BookOpen,
  GraduationCap,
  Home,
  Presentation,
  CalendarClock,
  GraduationCap as Logo,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useReminderNotifications } from '../lib/useReminderNotifications'
import { getProfile } from '../lib/data'

const tabs = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/notes', label: 'Notes', icon: BookOpen },
  { to: '/practice', label: 'Practice', icon: GraduationCap },
  { to: '/slides', label: 'Slides', icon: Presentation },
  { to: '/schedule', label: 'Schedule', icon: CalendarClock },
]

export function AppShell({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id
  useReminderNotifications(userId)

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string | null>(null)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    getProfile(user.id, user.email ?? null)
      .then((p) => {
        if (!cancelled) {
          setAvatarUrl(p.avatarUrl)
          setFullName(p.fullName)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <div className="relative flex h-dvh w-full overflow-hidden">
      <div className="aurora-bg">
        <div className="aurora-blob" />
      </div>
      <div className="grid-overlay" />

      {/* Desktop / tablet sidebar */}
      <nav className="glass-panel relative z-10 hidden w-64 shrink-0 flex-col gap-1 border-y-0 border-l-0 p-4 md:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #2563eb, #4f46e5 60%, #0891b2)',
              boxShadow: '0 8px 20px -6px rgba(37, 99, 235, 0.6)',
            }}
          >
            <Logo size={19} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Scholar</p>
            <p className="text-[11px] text-muted">Class to Exam</p>
          </div>
        </div>
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'text-white shadow-md'
                  : 'text-gray-500 hover:bg-black/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.05]'
              }`
            }
            style={({ isActive }) =>
              isActive
                ? {
                    background: 'linear-gradient(135deg, #2563eb, #4f46e5 70%, #0891b2)',
                    boxShadow: '0 6px 16px -6px rgba(37, 99, 235, 0.6)',
                  }
                : undefined
            }
          >
            <Icon size={18} strokeWidth={2} />
            {label}
          </NavLink>
        ))}

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `mt-auto flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm font-medium transition-colors ${
              isActive ? 'bg-black/[0.03] dark:bg-white/[0.05]' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
            }`
          }
        >
          <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span
                className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5 60%, #0891b2)' }}
              >
                {(fullName || user?.email || '?').slice(0, 2).toUpperCase()}
              </span>
            )}
          </span>
          <span className="truncate text-gray-600 dark:text-gray-300">{fullName || 'Your profile'}</span>
        </NavLink>
      </nav>

      <main className="no-scrollbar relative z-10 flex-1 overflow-y-auto pb-24 md:pb-6">
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="glass-panel fixed inset-x-0 bottom-0 z-10 flex border-x-0 border-b-0 md:hidden">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                isActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400'
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
