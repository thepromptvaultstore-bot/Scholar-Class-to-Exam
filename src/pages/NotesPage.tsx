import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Mic, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import {
  createNote,
  createSemester,
  createSubject,
  deleteSubject,
  findNoteForSubjectAndDate,
  listNotes,
  listSemesters,
  listSubjects,
} from '../lib/data'
import type { Note, Semester, Subject } from '../types/domain'

const SUBJECT_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6']
const todayISO = () => new Date().toISOString().slice(0, 10)

export default function NotesPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const subjectId = params.get('subject')

  const [semesters, setSemesters] = useState<Semester[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showNewSemester, setShowNewSemester] = useState(false)
  const [newSemesterName, setNewSemesterName] = useState('')
  const [showNewSubjectFor, setShowNewSubjectFor] = useState<string | null>(null)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectProf, setNewSubjectProf] = useState('')
  const [busy, setBusy] = useState(false)

  const selectedSubject = subjects.find((s) => s.id === subjectId) ?? null

  const reload = async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, subj] = await Promise.all([listSemesters(), listSubjects()])
      setSemesters(s)
      setSubjects(subj)
      if (subjectId) setNotes(await listNotes(subjectId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load notes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId])

  const handleCreateSemester = async () => {
    if (!user || !newSemesterName.trim()) return
    setBusy(true)
    try {
      await createSemester(user.id, newSemesterName.trim())
      setNewSemesterName('')
      setShowNewSemester(false)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create semester.')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateSubject = async (semesterId: string) => {
    if (!user || !newSubjectName.trim()) return
    setBusy(true)
    try {
      const color = SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length]
      await createSubject(user.id, semesterId, newSubjectName.trim(), color, newSubjectProf.trim() || undefined)
      setNewSubjectName('')
      setNewSubjectProf('')
      setShowNewSubjectFor(null)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create subject.')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteSubject = async (id: string) => {
    setBusy(true)
    try {
      await deleteSubject(id)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete subject.')
    } finally {
      setBusy(false)
    }
  }

  const startNote = async (mode: 'manual' | 'voice') => {
    if (!user || !selectedSubject) return
    setBusy(true)
    try {
      const date = todayISO()
      const existing = await findNoteForSubjectAndDate(selectedSubject.id, date)
      if (existing) {
        navigate(`/notes/${existing.id}`)
        return
      }
      const note = await createNote(user.id, selectedSubject.id, date, mode)
      navigate(`/notes/${note.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start a new note.')
    } finally {
      setBusy(false)
    }
  }

  // --- No subject selected: show semester + subject picker -------------------
  if (!selectedSubject) {
    return (
      <div className="flex flex-col gap-5 px-5 pt-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Notes</h1>
        {error && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}

        {loading ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : semesters.length === 0 ? (
          <NewSemesterForm
            show={true}
            value={newSemesterName}
            onChange={setNewSemesterName}
            onSubmit={handleCreateSemester}
            busy={busy}
          />
        ) : (
          semesters.map((sem) => {
            const semSubjects = subjects.filter((s) => s.semesterId === sem.id)
            return (
              <div key={sem.id}>
                <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">{sem.name}</h2>
                <div className="flex flex-col gap-2">
                  {semSubjects.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800"
                    >
                      <button
                        onClick={() => setParams({ subject: s.id })}
                        className="flex flex-1 items-center gap-3 text-left"
                      >
                        <span className="h-8 w-8 shrink-0 rounded-lg" style={{ backgroundColor: s.color }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                            {s.name}
                          </p>
                          {s.professorName && (
                            <p className="truncate text-xs text-gray-500">{s.professorName}</p>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => handleDeleteSubject(s.id)}
                        className="p-1 text-gray-300 hover:text-red-500"
                        aria-label={`Delete ${s.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}

                  <NewSubjectForm
                    show={showNewSubjectFor === sem.id}
                    nameValue={newSubjectName}
                    profValue={newSubjectProf}
                    onNameChange={setNewSubjectName}
                    onProfChange={setNewSubjectProf}
                    onOpen={() => setShowNewSubjectFor(sem.id)}
                    onSubmit={() => handleCreateSubject(sem.id)}
                    busy={busy}
                  />
                </div>
              </div>
            )
          })
        )}

        {semesters.length > 0 && (
          <NewSemesterForm
            show={showNewSemester}
            value={newSemesterName}
            onChange={setNewSemesterName}
            onSubmit={handleCreateSemester}
            onOpen={() => setShowNewSemester(true)}
            busy={busy}
            asAddMore
          />
        )}
      </div>
    )
  }

  // --- A subject is selected: show its notes -----------------------------------
  return (
    <div className="flex flex-col gap-4 px-5 pt-6">
      <div className="flex items-center gap-2">
        <button onClick={() => setParams({})} className="p-1 text-gray-500">
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
            {selectedSubject.name}
          </h1>
          {selectedSubject.professorName && (
            <p className="truncate text-xs text-gray-500">{selectedSubject.professorName}</p>
          )}
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          disabled={busy}
          onClick={() => startNote('voice')}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          <Mic size={16} /> Record class
        </button>
        <button
          disabled={busy}
          onClick={() => startNote('manual')}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
        >
          <Pencil size={16} /> Type notes
        </button>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">All sessions</h2>
        {loading ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="text-xs text-gray-400">No notes for this subject yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {notes.map((n) => (
              <button
                key={n.id}
                onClick={() => navigate(`/notes/${n.id}`)}
                className="flex items-center justify-between rounded-xl border border-gray-200 p-3 text-left dark:border-gray-800"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
                  <p className="text-xs text-gray-500">
                    {n.sessionDate} · {n.captureMode === 'voice' ? 'Recorded' : 'Typed'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NewSemesterForm(props: {
  show: boolean
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onOpen?: () => void
  busy: boolean
  asAddMore?: boolean
}) {
  if (!props.show) {
    return (
      <button
        onClick={props.onOpen}
        className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-4 text-sm text-gray-500 dark:border-gray-700"
      >
        <Plus size={16} /> {props.asAddMore ? 'Add another semester' : 'Add a semester'}
      </button>
    )
  }
  return (
    <div className="flex gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
      <input
        autoFocus
        placeholder="e.g. Fall 2026"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none dark:border-gray-700 dark:bg-gray-900"
      />
      <button
        disabled={props.busy}
        onClick={props.onSubmit}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
      >
        Add
      </button>
    </div>
  )
}

function NewSubjectForm(props: {
  show: boolean
  nameValue: string
  profValue: string
  onNameChange: (v: string) => void
  onProfChange: (v: string) => void
  onOpen: () => void
  onSubmit: () => void
  busy: boolean
}) {
  if (!props.show) {
    return (
      <button
        onClick={props.onOpen}
        className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-3 text-sm text-gray-500 dark:border-gray-700"
      >
        <Plus size={16} /> Add subject
      </button>
    )
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
      <input
        autoFocus
        placeholder="Subject name"
        value={props.nameValue}
        onChange={(e) => props.onNameChange(e.target.value)}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none dark:border-gray-700 dark:bg-gray-900"
      />
      <input
        placeholder="Professor (optional)"
        value={props.profValue}
        onChange={(e) => props.onProfChange(e.target.value)}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none dark:border-gray-700 dark:bg-gray-900"
      />
      <button
        disabled={props.busy}
        onClick={props.onSubmit}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
      >
        Add subject
      </button>
    </div>
  )
}
