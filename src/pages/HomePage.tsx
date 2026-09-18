import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Flame, LogOut, Plus, Sparkles } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { listSemesters, listSubjects, listNotes } from '../lib/data'
import { getKnowledgeForSubjects, getLevelInfo, getStreakDays } from '../lib/gamification'
import type { Semester, Subject, Note } from '../types/domain'
import type { LevelInfo, SubjectKnowledge } from '../types/gamification'

export default function HomePage() {
  const { user, signOut } = useAuthStore()
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [recentNotes, setRecentNotes] = useState<Note[]>([])
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null)
  const [streak, setStreak] = useState(0)
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
  }, [])

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
        <button
          onClick={() => signOut()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800"
          aria-label="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-4 text-white">
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
        <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {loadError}
        </p>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {activeSemester ? activeSemester.name : 'Your courses'}
          </h2>
          <Link to="/notes" className="text-xs font-medium text-indigo-600">
            Manage
          </Link>
        </div>

        {loading ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : subjects.length === 0 ? (
          <Link
            to="/notes"
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-6 text-sm text-gray-500 dark:border-gray-700"
          >
            <Plus size={16} /> Add your first subject
          </Link>
        ) : (
          <div className="flex flex-col gap-2">
            {subjects.slice(0, 4).map((s) => (
              <Link
                key={s.id}
                to={`/notes?subject=${s.id}`}
                className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800"
              >
                <span
                  className="h-8 w-8 shrink-0 rounded-lg"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{s.name}</p>
                  {s.professorName && (
                    <p className="truncate text-xs text-gray-500">{s.professorName}</p>
                  )}
                </div>
                {knowledge[s.id]?.score !== null && knowledge[s.id]?.score !== undefined && (
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
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
          <p className="text-xs text-gray-400">Nothing captured yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentNotes.map((n) => (
              <Link
                key={n.id}
                to={`/notes/${n.id}`}
                className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800"
              >
                <BookOpen size={16} className="shrink-0 text-indigo-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
                  <p className="text-xs text-gray-500">{n.sessionDate}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
