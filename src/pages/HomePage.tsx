import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Flame, Plus, Sparkles } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { getProfile, listSemesters, listSubjects, listNotes } from '../lib/data'
import { getKnowledgeForSubjects, getLevelInfo, getStreakDays } from '../lib/gamification'
import type { Semester, Subject, Note } from '../types/domain'
import type { LevelInfo, SubjectKnowledge } from '../types/gamification'

export default function HomePage() {
  const { user } = useAuthStore()
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [recentNotes, setRecentNotes] = useState<Note[]>([])
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null)
  const [streak, setStreak] = useState(0)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [knowledge, setKnowledge] = useState<Record<string, SubjectKnowledge>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [s, subj, notes, level, streakDays] = await Promise.all([
          listSemesters(),
          listSubjects(),
          listNotes(),
          getLevelInfo(),
          getStreakDays(),
        ])
        if (cancelled) return
        setSemesters(s)
        setSubjects(subj)
        setRecentNotes(notes.slice(0, 3))
        setLevelInfo(level)
        setStreak(streakDays)
        if (user) {
          getProfile(user.id, user.email ?? null)
            .then((p) => {
              if (!cancelled) setAvatarUrl(p.avatarUrl)
            })
            .catch(() => {})
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

  const activeSemester = semesters.find((s) => s.isActive) ?? semesters[0]

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
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
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

      {loadError && (
        <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-500">{loadError}</p>
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
