import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, BookOpen, Flame, ListChecks, Plus, Shield, Sparkles, Trophy } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { getProfile, listSemesters, listSubjects, listNotes } from '../lib/data'
import { listReminders } from '../lib/schedule'
import {
  ALL_DAYS_MASK,
  applyStreakFreezeIfNeeded,
  checkAndAwardBadges,
  checkWeeklyLeagueRollover,
  getKnowledgeForSubjects,
  getLevelInfo,
  getStreakDays,
  getTodayXp,
  isTodayActiveDay,
  spendStreakFreezeToday,
} from '../lib/gamification'
import { LEAGUE_TIERS, type BadgeDef } from '../types/gamification'
import type { Semester, Subject, Note, Profile, Reminder } from '../types/domain'
import type { LevelInfo, SubjectKnowledge } from '../types/gamification'

// Compact single-line version of PlannerPage's dueLabel — just enough to
// tell "overdue" from "today" from "later" at a glance in a 2-3 item widget.
function dueSoonLabel(remindAt: string, now: Date): { text: string; overdue: boolean } {
  const due = new Date(remindAt)
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000)
  const time = due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (diffDays < 0) return { text: 'Overdue', overdue: true }
  if (diffDays === 0) return { text: `Today, ${time}`, overdue: false }
  if (diffDays === 1) return { text: `Tomorrow, ${time}`, overdue: false }
  return { text: due.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }), overdue: false }
}

export default function HomePage() {
  const { user } = useAuthStore()
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [recentNotes, setRecentNotes] = useState<Note[]>([])
  const [dueSoon, setDueSoon] = useState<Reminder[]>([])
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null)
  const [streak, setStreak] = useState(0)
  const [todayXp, setTodayXp] = useState(0)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [knowledge, setKnowledge] = useState<Record<string, SubjectKnowledge>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [newBadges, setNewBadges] = useState<BadgeDef[]>([])
  const [savingStreak, setSavingStreak] = useState(false)
  const [streakSaved, setStreakSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const profilePromise = user ? getProfile(user.id, user.email ?? null) : Promise.resolve(null)
        const [s, subj, notes, level, xpToday, p, reminders] = await Promise.all([
          listSemesters(),
          listSubjects(),
          listNotes(),
          getLevelInfo(),
          getTodayXp(),
          profilePromise,
          listReminders(),
        ])
        if (cancelled) return
        setSemesters(s)
        setSubjects(subj)
        setRecentNotes(notes.slice(0, 3))
        setLevelInfo(level)
        setTodayXp(xpToday)
        if (p) setProfile(p)
        setDueSoon(
          reminders
            .filter((r) => !r.isDone)
            .sort((a, b) => a.remindAt.localeCompare(b.remindAt))
            .slice(0, 3),
        )
        // Which weekdays count toward the streak — a day outside this mask
        // (e.g. a day with no class) needs no activity to keep it alive.
        const mask = p?.streakActiveDaysMask ?? ALL_DAYS_MASK
        const streakDays = await getStreakDays(mask)
        if (!cancelled) setStreak(streakDays)
        if (user) {
          // Best-effort gamification upkeep — never blocks the page.
          applyStreakFreezeIfNeeded(user.id, mask).then(() => {
            if (!cancelled) getStreakDays(mask).then((d) => !cancelled && setStreak(d))
          })
          checkAndAwardBadges(user.id).then((badges) => {
            if (!cancelled && badges.length > 0) setNewBadges(badges)
          })
        }
        if (subj.length > 0) {
          getKnowledgeForSubjects(subj.map((x) => x.id))
            .then((k) => {
              if (!cancelled) setKnowledge(k)
            })
            .catch(() => {})
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load your data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Separate effect so the league rollover (which needs the profile's
  // stored tier/week-key) runs once profile has loaded.
  useEffect(() => {
    if (!user || !profile) return
    checkWeeklyLeagueRollover(user.id, profile.leagueTier, profile.leagueWeekKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile?.id])

  const activeSemester = semesters.find((s) => s.isActive) ?? semesters[0]
  const dailyGoal = profile?.dailyGoalXp ?? 30
  const goalPct = Math.min(100, Math.round((todayXp / dailyGoal) * 100))
  const tierInfo = LEAGUE_TIERS.find((t) => t.tier === (profile?.leagueTier ?? 'bronze'))!

  // Offer a manual save only when there's something to protect (an existing
  // streak), today actually counts toward it (a day with no class, marked
  // inactive in Profile settings, doesn't need saving), nothing has kept
  // today alive yet, and a freeze is actually available to spend — covers
  // days with no notes/practice to log, without requiring the user to wait
  // for an already-missed day to be auto-covered.
  const canSaveStreakToday =
    !loading &&
    streak > 0 &&
    todayXp === 0 &&
    !streakSaved &&
    (profile?.streakFreezeCount ?? 0) > 0 &&
    isTodayActiveDay(profile?.streakActiveDaysMask ?? ALL_DAYS_MASK)

  const handleSaveStreak = async () => {
    if (!user || savingStreak) return
    setSavingStreak(true)
    try {
      const ok = await spendStreakFreezeToday(user.id)
      if (ok) {
        setStreakSaved(true)
        setStreak((s) => s + 1)
        setProfile((p) => (p ? { ...p, streakFreezeCount: Math.max(0, p.streakFreezeCount - 1) } : p))
      }
    } finally {
      setSavingStreak(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 px-5 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Welcome back</p>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {user?.user_metadata?.full_name || user?.email}
          </h1>
        </div>
        <Link to="/profile" className="h-9 w-9 shrink-0 overflow-hidden rounded-full" aria-label="Your profile">
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-xs font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5 60%, #0891b2)' }}
            >
              {(user?.user_metadata?.full_name || user?.email || '?').slice(0, 2).toUpperCase()}
            </div>
          )}
        </Link>
      </div>

      <div
        className="rounded-2xl p-4 text-white"
        style={{
          background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 55%, #0891b2 120%)',
          boxShadow: '0 12px 28px -10px rgba(37, 99, 235, 0.55)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide opacity-80">
            <Sparkles size={14} /> Level {levelInfo?.level ?? 1}
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1 text-xs font-medium">
              <Flame size={14} /> {streak} day{streak === 1 ? '' : 's'}
              {(profile?.streakFreezeCount ?? 0) > 0 && (
                <span className="ml-1 flex items-center gap-0.5 opacity-80" title="Streak freezes available">
                  <Shield size={11} /> {profile?.streakFreezeCount}
                </span>
              )}
            </div>
          )}
        </div>
        <p className="mt-2 text-2xl font-semibold">{levelInfo?.totalXp ?? 0} XP</p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white"
            style={{
              width: `${levelInfo ? (levelInfo.xpIntoLevel / levelInfo.xpForNextLevel) * 100 : 0}%`,
            }}
          />
        </div>
        <p className="mt-1.5 text-xs opacity-80">
          {levelInfo ? levelInfo.xpForNextLevel - levelInfo.xpIntoLevel : 100} XP to level{' '}
          {(levelInfo?.level ?? 1) + 1} — earned from notes, practice, and test scores.
        </p>
      </div>

      {canSaveStreakToday && (
        <div className="glass-card flex items-center justify-between gap-3 rounded-2xl border border-indigo-400/40 p-3">
          <div className="flex items-center gap-2">
            <Shield size={18} className="shrink-0 text-indigo-500" />
            <p className="text-xs font-medium text-gray-900 dark:text-white">
              No notes today yet? Use a freeze to keep your {streak}-day streak
              {' '}({profile?.streakFreezeCount} left).
            </p>
          </div>
          <button
            onClick={handleSaveStreak}
            disabled={savingStreak}
            className="shrink-0 rounded-full bg-indigo-500 px-3 py-1.5 text-[11px] font-semibold text-white"
          >
            {savingStreak ? 'Saving…' : 'Save streak'}
          </button>
        </div>
      )}

      {streakSaved && (
        <div className="glass-card flex items-center gap-2 rounded-2xl border border-emerald-400/40 p-3">
          <Shield size={16} className="shrink-0 text-emerald-500" />
          <p className="text-xs font-medium text-gray-900 dark:text-white">
            Today's covered — your streak is safe. Come back tomorrow!
          </p>
        </div>
      )}

      {newBadges.length > 0 && (
        <div className="glass-card flex items-center justify-between gap-3 rounded-2xl border border-amber-400/40 p-3">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="shrink-0 text-amber-500" />
            <p className="text-xs font-medium text-gray-900 dark:text-white">
              New badge{newBadges.length > 1 ? 's' : ''}: {newBadges.map((b) => b.label).join(', ')}
            </p>
          </div>
          <button onClick={() => setNewBadges([])} className="shrink-0 text-[11px] text-muted">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card flex items-center gap-3 rounded-2xl p-3">
          <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0 -rotate-90">
            <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="5" className="text-black/10 dark:text-white/10" />
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              stroke="#2563eb"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 18}
              strokeDashoffset={2 * Math.PI * 18 * (1 - goalPct / 100)}
            />
          </svg>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {todayXp}/{dailyGoal} XP
            </p>
            <p className="text-[11px] text-muted">Daily goal</p>
          </div>
        </div>
        <Link to="/league" className="glass-card flex items-center gap-3 rounded-2xl p-3 transition-transform hover:-translate-y-0.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
            style={{ background: tierInfo.color }}
          >
            <Trophy size={17} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{tierInfo.label}</p>
            <p className="text-[11px] text-muted">This week's league</p>
          </div>
        </Link>
      </div>

      {loadError && (
        <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-500">{loadError}</p>
      )}

      {dueSoon.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
              <ListChecks size={15} /> Due soon
            </h2>
            <Link to="/planner" className="text-xs font-medium text-indigo-500">
              See all
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {dueSoon.map((r) => {
              const { text, overdue } = dueSoonLabel(r.remindAt, new Date())
              return (
                <Link
                  key={r.id}
                  to="/planner"
                  className="glass-card flex items-center gap-3 rounded-2xl p-3 transition-transform hover:-translate-y-0.5"
                >
                  {overdue ? (
                    <AlertCircle size={16} className="shrink-0 text-red-500" />
                  ) : (
                    <ListChecks size={16} className="shrink-0 text-indigo-500" />
                  )}
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-white">
                    {r.title}
                  </p>
                  <span className={`shrink-0 text-xs font-medium ${overdue ? 'text-red-500' : 'text-muted'}`}>
                    {text}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {activeSemester ? activeSemester.name : 'Your courses'}
          </h2>
          <Link to="/notes" className="text-xs font-medium text-indigo-500">
            Manage
          </Link>
        </div>

        {loading ? (
          <p className="text-xs text-muted">Loading…</p>
        ) : subjects.length === 0 ? (
          <Link
            to="/notes"
            className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-black/10 py-6 text-sm text-muted dark:border-white/15"
          >
            <Plus size={16} /> Add your first subject
          </Link>
        ) : (
          <div className="flex flex-col gap-2">
            {subjects.slice(0, 4).map((s) => (
              <Link
                key={s.id}
                to={`/notes?subject=${s.id}`}
                className="glass-card flex items-center gap-3 rounded-2xl p-3 transition-transform hover:-translate-y-0.5"
              >
                <span
                  className="h-8 w-8 shrink-0 rounded-lg"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{s.name}</p>
                  {s.professorName && <p className="truncate text-xs text-muted">{s.professorName}</p>}
                </div>
                {knowledge[s.id]?.score !== null && knowledge[s.id]?.score !== undefined && (
                  <span className="shrink-0 rounded-full bg-indigo-500/10 px-2 py-1 text-[11px] font-medium text-indigo-500">
                    {knowledge[s.id].score}% mastery
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Recent notes</h2>
        {recentNotes.length === 0 ? (
          <p className="text-xs text-muted">Nothing captured yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentNotes.map((n) => (
              <Link
                key={n.id}
                to={`/notes/${n.id}`}
                className="glass-card flex items-center gap-3 rounded-2xl p-3 transition-transform hover:-translate-y-0.5"
              >
                <BookOpen size={16} className="shrink-0 text-indigo-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
                  <p className="text-xs text-muted">{n.sessionDate}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
