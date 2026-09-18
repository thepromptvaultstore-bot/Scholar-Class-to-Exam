import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { GraduationCap, Sparkles } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { listSemesters, listSubjects } from '../lib/data'
import { cloneSharedNote, cloneSharedPracticeSet, getSharedContent } from '../lib/sharing'
import type { SharedContent } from '../lib/sharing'
import type { Semester, Subject } from '../types/domain'

function SubjectPicker({
  semesters,
  subjects,
  value,
  onChange,
}: {
  semesters: Semester[]
  subjects: Subject[]
  value: string
  onChange: (id: string) => void
}) {
  if (subjects.length === 0) {
    return (
      <p className="text-xs text-muted">
        You'll need a course set up first —{' '}
        <Link to="/notes" className="text-indigo-500">
          add one on the Notes tab
        </Link>
        , then come back to this link.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted">Save into which course?</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field">
        {semesters.map((sem) => {
          const opts = subjects.filter((s) => s.semesterId === sem.id)
          if (opts.length === 0) return null
          return (
            <optgroup key={sem.id} label={sem.name}>
              {opts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>
    </div>
  )
}

export default function SharedPage() {
  const { kind, token } = useParams<{ kind: string; token: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [shared, setShared] = useState<SharedContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [semesters, setSemesters] = useState<Semester[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectId, setSubjectId] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!token || (kind !== 'note' && kind !== 'practice')) {
        setShared({ found: false })
        setLoading(false)
        return
      }
      try {
        const data = await getSharedContent(token, kind)
        if (!cancelled) setShared(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this link.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [token, kind])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([listSemesters(), listSubjects()])
      .then(([s, subj]) => {
        if (cancelled) return
        setSemesters(s)
        setSubjects(subj)
        setSubjectId((prev) => prev || subj[0]?.id || '')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user])

  const handleSaveNote = async () => {
    if (!user || !subjectId || shared?.found !== true || shared.kind !== 'note') return
    setSaving(true)
    setError(null)
    try {
      const note = await cloneSharedNote(user.id, subjectId, shared.note)
      navigate(`/notes/${note.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this note.')
    } finally {
      setSaving(false)
    }
  }

  const handleTakeQuiz = async () => {
    if (!user || !subjectId || shared?.found !== true || shared.kind !== 'practice') return
    setSaving(true)
    setError(null)
    try {
      const set = await cloneSharedPracticeSet(user.id, subjectId, shared.practiceSet, shared.questions)
      navigate(`/practice/${set.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start this quiz.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden px-6 py-10">
      <div className="aurora-bg">
        <div className="aurora-blob" />
      </div>
      <div className="grid-overlay" />

      <div className="glass-card relative z-10 flex w-full max-w-lg flex-col gap-5 rounded-3xl p-7 shadow-2xl">
        <Link to="/" className="flex items-center gap-2.5 self-start">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5 60%, #0891b2)' }}
          >
            <GraduationCap size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Scholar</p>
            <p className="text-[11px] text-muted">Class to Exam</p>
          </div>
        </Link>

        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : !shared?.found ? (
          <div className="flex flex-col gap-2 py-6 text-center">
            <p className="text-sm font-medium text-gray-900 dark:text-white">This link isn't available.</p>
            <p className="text-xs text-muted">It may have been unshared, or the link is incomplete.</p>
          </div>
        ) : shared.kind === 'note' ? (
          <>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-indigo-500">Shared note</p>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{shared.note.title}</h1>
              <p className="text-xs text-muted">{shared.note.sessionDate}</p>
            </div>
            <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-black/[0.02] p-4 text-sm leading-relaxed text-gray-800 dark:bg-white/[0.03] dark:text-gray-200">
              {shared.note.content || <span className="italic text-muted">This note is empty.</span>}
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            {user ? (
              <div className="flex flex-col gap-2">
                <SubjectPicker semesters={semesters} subjects={subjects} value={subjectId} onChange={setSubjectId} />
                {subjects.length > 0 && (
                  <button onClick={handleSaveNote} disabled={saving} className="btn-primary">
                    {saving ? 'Saving…' : 'Save a copy to my notes'}
                  </button>
                )}
              </div>
            ) : (
              <Link to="/auth" className="btn-primary justify-center">
                <Sparkles size={15} /> Sign up free to save this note
              </Link>
            )}
          </>
        ) : (
          <>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-indigo-500">
                Shared {shared.practiceSet.format === 'quiz' ? 'quiz' : 'exam prep'}
              </p>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{shared.practiceSet.title}</h1>
              <p className="text-xs text-muted">
                {shared.practiceSet.questionCount} question{shared.practiceSet.questionCount === 1 ? '' : 's'} — a
                friend shared this with you. Take it yourself and compare scores.
              </p>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            {user ? (
              <div className="flex flex-col gap-2">
                <SubjectPicker semesters={semesters} subjects={subjects} value={subjectId} onChange={setSubjectId} />
                {subjects.length > 0 && (
                  <button onClick={handleTakeQuiz} disabled={saving} className="btn-primary">
                    {saving ? 'Setting up…' : 'Take this quiz'}
                  </button>
                )}
              </div>
            ) : (
              <Link to="/auth" className="btn-primary justify-center">
                <Sparkles size={15} /> Sign up free, then come back to take it
              </Link>
            )}
          </>
        )}

        <div className="border-t border-black/5 pt-4 text-center dark:border-white/10">
          <p className="text-xs text-muted">
            Made with <span className="font-medium text-gray-700 dark:text-gray-300">Scholar — Class to Exam</span>
          </p>
          {!user && (
            <Link to="/auth" className="text-xs font-medium text-indigo-500">
              Get your own free account →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
