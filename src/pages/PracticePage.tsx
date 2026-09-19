import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Loader2, Sparkles } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { listSubjects, listNotes } from '../lib/data'
import { createPracticeSet, listPracticeSets } from '../lib/practice'
import { LimitReachedError } from '../lib/entitlements'
import { ErrorBanner } from '../components/ErrorBanner'
import type { Subject, Note } from '../types/domain'
import type { PracticeFormat, PracticeScope, PracticeSet } from '../types/practice'

export default function PracticePage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectId, setSubjectId] = useState<string>('')
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([])
  const [format, setFormat] = useState<PracticeFormat>('quiz')
  const [sets, setSets] = useState<PracticeSet[]>([])
  const [loading, setLoading] = useState(true)
  const [limitReached, setLimitReached] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listSubjects()
      .then((s) => {
        setSubjects(s)
        if (s.length > 0) setSubjectId(s[0].id)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load subjects.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!subjectId) return
    setSelectedNoteIds([])
    Promise.all([listNotes(subjectId), listPracticeSets(subjectId)])
      .then(([n, s]) => {
        setNotes(n)
        setSets(s)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load notes.'))
  }, [subjectId])

  const toggleNote = (id: string) => {
    setSelectedNoteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const scopeFor = (count: number): PracticeScope =>
    count <= 1 ? 'single' : count === notes.length ? 'course' : 'multi'

  const handleGenerate = async () => {
    if (!user || !subjectId || selectedNoteIds.length === 0) return
    setGenerating(true)
    setError(null)
    setLimitReached(false)
    try {
      const set = await createPracticeSet(
        user.id,
        subjectId,
        selectedNoteIds,
        scopeFor(selectedNoteIds.length),
        format,
      )
      navigate(`/practice/${set.id}`)
    } catch (err) {
      setLimitReached(err instanceof LimitReachedError)
      setError(err instanceof Error ? err.message : 'Could not generate a practice set.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <div className="px-5 pt-6 text-sm text-muted">Loading…</div>

  if (subjects.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <GraduationCap size={26} className="text-indigo-400" />
        <p className="text-sm text-muted">Add a course and some notes first, then come back here.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 px-5 pt-6 pb-10">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Practice & Exam Prep</h1>
      {error && <ErrorBanner message={error} showUpgrade={limitReached} />}

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Course</label>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="input-field">
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-muted">Pick notes to test yourself on</label>
          {notes.length > 0 && (
            <button
              onClick={() =>
                setSelectedNoteIds(selectedNoteIds.length === notes.length ? [] : notes.map((n) => n.id))
              }
              className="text-xs font-medium text-indigo-500"
            >
              {selectedNoteIds.length === notes.length ? 'Clear' : 'Select all (whole course)'}
            </button>
          )}
        </div>
        {notes.length === 0 ? (
          <p className="text-xs text-muted">No notes for this course yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {notes.map((n) => (
              <label
                key={n.id}
                className="glass-card flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedNoteIds.includes(n.id)}
                  onChange={() => toggleNote(n.id)}
                />
                <span className="truncate">
                  {n.title} <span className="text-muted">· {n.sessionDate}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Format</label>
        <div className="flex gap-2">
          <button
            onClick={() => setFormat('quiz')}
            className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
              format === 'quiz'
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500'
                : 'border-black/10 text-muted dark:border-white/15'
            }`}
          >
            Quiz (objective)
          </button>
          <button
            onClick={() => setFormat('exam')}
            className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
              format === 'exam'
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500'
                : 'border-black/10 text-muted dark:border-white/15'
            }`}
          >
            Exam (explain in your own words)
          </button>
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={generating || selectedNoteIds.length === 0}
        className="btn-primary"
      >
        {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {generating ? 'Generating…' : `Generate ${format === 'quiz' ? 'quiz' : 'exam prep'}`}
      </button>

      {sets.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Previous sets</h2>
          <div className="flex flex-col gap-2 pb-6">
            {sets.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/practice/${s.id}`)}
                className="glass-card flex items-center justify-between rounded-2xl p-3 text-left text-sm transition-transform hover:-translate-y-0.5"
              >
                <span className="truncate">{s.title}</span>
                <span className="shrink-0 text-xs text-muted">
                  {s.format} · {s.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
