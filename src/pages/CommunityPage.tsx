import { useEffect, useState } from 'react'
import { BookOpen, Search, Users } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { getProfile } from '../lib/data'
import { browseCommunityNotes, type CommunityNote } from '../lib/community'

export default function CommunityPage() {
  const { user } = useAuthStore()
  const [courseQuery, setCourseQuery] = useState('')
  const [universityQuery, setUniversityQuery] = useState('')
  const [results, setResults] = useState<CommunityNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  // Defaults the university filter to the student's own — most useful
  // starting point, since "notes for my course" almost always means "at my
  // school" — but it's just a text field, clearable to search everywhere.
  useEffect(() => {
    if (!user) return
    getProfile(user.id, user.email ?? null)
      .then((p) => setUniversityQuery(p.university ?? ''))
      .catch(() => {})
  }, [user])

  const runSearch = async () => {
    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      setResults(await browseCommunityNotes(courseQuery, universityQuery))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load community notes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-5 px-5 pt-6 pb-10">
      <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
        <Users size={19} className="text-indigo-500" /> Course notes
      </h1>
      <p className="-mt-3 text-xs text-muted">
        Notes other students chose to make public. Use them to study — submitting someone else's notes
        as your own work isn't what this is for.
      </p>

      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={courseQuery}
            onChange={(e) => setCourseQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Search by course, e.g. MKT202 or Principles of Marketing"
            className="input-field pl-9"
          />
        </div>
        <div className="flex gap-2">
          <input
            value={universityQuery}
            onChange={(e) => setUniversityQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="University (optional — clear to search everywhere)"
            className="input-field flex-1"
          />
          <button onClick={runSearch} disabled={loading} className="btn-primary !px-4">
            Search
          </button>
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-500">{error}</p>}

      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : results.length === 0 ? (
        <p className="text-xs text-muted">
          {searched ? 'No published notes match that search yet.' : 'Search for a course to get started.'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {results.map((n) => (
            <a
              key={n.id}
              href={`/s/note/${n.shareToken}`}
              target="_blank"
              rel="noreferrer"
              className="glass-card flex items-start gap-3 rounded-2xl p-3 transition-transform hover:-translate-y-0.5"
            >
              <BookOpen size={16} className="mt-0.5 shrink-0 text-indigo-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
                <p className="truncate text-xs text-muted">
                  {n.courseLabel ?? 'Uncategorized'} · {n.authorName}
                  {n.university ? ` · ${n.university}` : ''}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
