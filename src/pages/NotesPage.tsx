import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Camera,
  Check,
  GraduationCap,
  Layers,
  Mic,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import {
  createNote,
  createSemester,
  createSubject,
  deleteSemester,
  deleteSubject,
  findNoteForSubjectAndDate,
  listNotes,
  listSemesters,
  listSubjects,
  renameSemester,
  updateSubject,
} from '../lib/data'
import type { Note, Semester, Subject } from '../types/domain'

const SUBJECT_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#06b6d4', '#4f46e5', '#64748b']
const todayISO = () => new Date().toISOString().slice(0, 10)

type Tab = 'all' | 'courses'

export default function NotesPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('all')

  const [semesters, setSemesters] = useState<Semester[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, subj, n] = await Promise.all([listSemesters(), listSubjects(), listNotes()])
      setSemesters(s)
      setSubjects(subj)
      setNotes(n)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your notes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-5 px-5 pt-6 pb-10">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Notes</h1>
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-500">{error}</p>}

      <div className="flex gap-2 border-b border-black/5 dark:border-white/10">
        <button
          onClick={() => setTab('all')}
          className={`flex items-center gap-1.5 border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
            tab === 'all' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-muted'
          }`}
        >
          <BookOpen size={15} /> All notes
        </button>
        <button
          onClick={() => setTab('courses')}
          className={`flex items-center gap-1.5 border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
            tab === 'courses' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-muted'
          }`}
        >
          <Layers size={15} /> Semesters & courses
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : tab === 'all' ? (
        <AllNotesTab
          semesters={semesters}
          subjects={subjects}
          notes={notes}
          userId={user?.id}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
        />
      ) : (
        <CoursesTab
          semesters={semesters}
          subjects={subjects}
          userId={user?.id}
          onChanged={reload}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
        />
      )}
    </div>
  )
}

// --- All notes: unified search + filter across every semester/course ---------------

function AllNotesTab({
  semesters,
  subjects,
  notes,
  userId,
  busy,
  setBusy,
  setError,
}: {
  semesters: Semester[]
  subjects: Subject[]
  notes: Note[]
  userId?: string
  busy: boolean
  setBusy: (b: boolean) => void
  setError: (e: string | null) => void
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [semesterFilter, setSemesterFilter] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [showNewNote, setShowNewNote] = useState(false)
  const [newNoteSubject, setNewNoteSubject] = useState('')

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])
  const semesterById = useMemo(() => new Map(semesters.map((s) => [s.id, s])), [semesters])

  const subjectsInFilteredSemester = semesterFilter
    ? subjects.filter((s) => s.semesterId === semesterFilter)
    : subjects

  const filtered = notes
    .filter((n) => {
      const subject = subjectById.get(n.subjectId)
      if (subjectFilter && n.subjectId !== subjectFilter) return false
      if (semesterFilter && subject?.semesterId !== semesterFilter) return false
      if (query.trim()) {
        const q = query.trim().toLowerCase()
        if (!n.title.toLowerCase().includes(q) && !n.content.toLowerCase().includes(q)) return false
      }
      return true
    })
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))

  const handleStartNote = async (mode: 'manual' | 'voice' | 'photo') => {
    if (!userId || !newNoteSubject) return
    setBusy(true)
    setError(null)
    try {
      const date = todayISO()
      const existing = await findNoteForSubjectAndDate(newNoteSubject, date)
      if (existing) {
        navigate(`/notes/${existing.id}`, { state: mode === 'photo' ? { autoScan: true } : undefined })
        return
      }
      const note = await createNote(userId, newNoteSubject, date, mode)
      navigate(`/notes/${note.id}`, { state: mode === 'photo' ? { autoScan: true } : undefined })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start a new note.')
    } finally {
      setBusy(false)
    }
  }

  if (subjects.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center gap-2 rounded-2xl px-8 py-12 text-center">
        <GraduationCap size={26} className="text-indigo-400" />
        <p className="text-sm text-muted">
          Start on the "Semesters & courses" tab — add a semester, then a course inside it —
          notes live under a course.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes by title or content…"
            className="input-field pl-9"
          />
        </div>
        <select
          value={semesterFilter}
          onChange={(e) => {
            setSemesterFilter(e.target.value)
            setSubjectFilter('')
          }}
          className="input-field sm:w-40"
        >
          <option value="">All semesters</option>
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="input-field sm:w-40"
        >
          <option value="">All courses</option>
          {subjectsInFilteredSemester.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {!showNewNote ? (
        <button
          onClick={() => {
            setShowNewNote(true)
            setNewNoteSubject(subjectFilter || subjects[0]?.id || '')
          }}
          className="btn-primary self-start"
        >
          <Plus size={16} /> New note
        </button>
      ) : (
        <div className="glass-card flex flex-col gap-2 rounded-2xl p-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted">Which course is this for?</label>
            <button onClick={() => setShowNewNote(false)} className="text-muted">
              <X size={14} />
            </button>
          </div>
          <select
            value={newNoteSubject}
            onChange={(e) => setNewNoteSubject(e.target.value)}
            className="input-field"
          >
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
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy}
              onClick={() => handleStartNote('voice')}
              className="btn-primary flex-1 !py-2.5 text-xs"
            >
              <Mic size={14} /> Record class
            </button>
            <button
              disabled={busy}
              onClick={() => handleStartNote('photo')}
              className="btn-secondary flex-1 !py-2.5 text-xs"
            >
              <Camera size={14} /> Scan handwritten
            </button>
            <button
              disabled={busy}
              onClick={() => handleStartNote('manual')}
              className="btn-secondary flex-1 !py-2.5 text-xs"
            >
              <Pencil size={14} /> Type notes
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-xs text-muted">
          {notes.length === 0 ? 'Nothing captured yet.' : 'No notes match your search/filters.'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((n) => {
            const subject = subjectById.get(n.subjectId)
            const semester = subject ? semesterById.get(subject.semesterId) : undefined
            return (
              <button
                key={n.id}
                onClick={() => navigate(`/notes/${n.id}`)}
                className="glass-card flex items-center gap-3 rounded-2xl p-3 text-left transition-transform hover:-translate-y-0.5"
              >
                <span
                  className="h-9 w-9 shrink-0 rounded-xl"
                  style={{ backgroundColor: subject?.color ?? '#6366f1' }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
                  <p className="truncate text-xs text-muted">
                    {subject?.name ?? 'Unknown course'}
                    {semester ? ` · ${semester.name}` : ''} · {n.sessionDate} ·{' '}
                    {n.captureMode === 'voice' ? 'Recorded' : n.captureMode === 'photo' ? 'Scanned' : 'Typed'}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- Courses: manage the semester → course hierarchy itself -----------------------

function CoursesTab({
  semesters,
  subjects,
  userId,
  onChanged,
  busy,
  setBusy,
  setError,
}: {
  semesters: Semester[]
  subjects: Subject[]
  userId?: string
  onChanged: () => Promise<void>
  busy: boolean
  setBusy: (b: boolean) => void
  setError: (e: string | null) => void
}) {
  const [showNewSemester, setShowNewSemester] = useState(semesters.length === 0)
  const [newSemesterName, setNewSemesterName] = useState('')
  const [editingSemesterId, setEditingSemesterId] = useState<string | null>(null)
  const [editSemesterName, setEditSemesterName] = useState('')
  const [showNewSubjectFor, setShowNewSubjectFor] = useState<string | null>(null)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectProf, setNewSubjectProf] = useState('')
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null)
  const [editSubjectName, setEditSubjectName] = useState('')
  const [editSubjectProf, setEditSubjectProf] = useState('')

  const handleCreateSemester = async () => {
    if (!userId || !newSemesterName.trim()) return
    setBusy(true)
    setError(null)
    try {
      await createSemester(userId, newSemesterName.trim())
      setNewSemesterName('')
      setShowNewSemester(false)
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create semester.')
    } finally {
      setBusy(false)
    }
  }

  const handleRenameSemester = async (id: string) => {
    if (!editSemesterName.trim()) return
    setBusy(true)
    try {
      await renameSemester(id, editSemesterName.trim())
      setEditingSemesterId(null)
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename semester.')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteSemester = async (s: Semester) => {
    const count = subjects.filter((x) => x.semesterId === s.id).length
    const warning =
      count > 0
        ? `Delete "${s.name}"? This also deletes its ${count} course${count === 1 ? '' : 's'} and every note inside them. This cannot be undone.`
        : `Delete "${s.name}"? This cannot be undone.`
    if (!window.confirm(warning)) return
    setBusy(true)
    try {
      await deleteSemester(s.id)
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete semester.')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateSubject = async (semesterId: string) => {
    if (!userId || !newSubjectName.trim()) return
    setBusy(true)
    try {
      const color = SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length]
      await createSubject(userId, semesterId, newSubjectName.trim(), color, newSubjectProf.trim() || undefined)
      setNewSubjectName('')
      setNewSubjectProf('')
      setShowNewSubjectFor(null)
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create course.')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveSubject = async (id: string) => {
    if (!editSubjectName.trim()) return
    setBusy(true)
    try {
      await updateSubject(id, { name: editSubjectName.trim(), professorName: editSubjectProf.trim() })
      setEditingSubjectId(null)
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update course.')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteSubject = async (s: Subject) => {
    if (!window.confirm(`Delete "${s.name}"? This also deletes every note in it. This cannot be undone.`))
      return
    setBusy(true)
    try {
      await deleteSubject(s.id)
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete course.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted">
        A semester (or year/term) holds your courses; each course holds its own notes. Rename or
        remove either here.
      </p>

      {semesters.map((sem) => {
        const semSubjects = subjects.filter((s) => s.semesterId === sem.id)
        return (
          <div key={sem.id} className="glass-card flex flex-col gap-3 rounded-2xl p-4">
            <div className="flex items-center gap-2">
              {editingSemesterId === sem.id ? (
                <>
                  <input
                    autoFocus
                    value={editSemesterName}
                    onChange={(e) => setEditSemesterName(e.target.value)}
                    className="input-field flex-1 !py-1.5 text-sm"
                  />
                  <button
                    onClick={() => handleRenameSemester(sem.id)}
                    className="p-1.5 text-emerald-500"
                    aria-label="Save"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => setEditingSemesterId(null)}
                    className="p-1.5 text-muted"
                    aria-label="Cancel"
                  >
                    <X size={16} />
                  </button>
                </>
              ) : (
                <>
                  <h2 className="flex-1 text-sm font-semibold text-gray-900 dark:text-white">{sem.name}</h2>
                  <button
                    onClick={() => {
                      setEditingSemesterId(sem.id)
                      setEditSemesterName(sem.name)
                    }}
                    className="p-1.5 text-muted hover:text-indigo-500"
                    aria-label="Rename semester"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteSemester(sem)}
                    className="p-1.5 text-muted hover:text-red-500"
                    aria-label="Delete semester"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {semSubjects.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border border-black/5 p-2.5 dark:border-white/10"
                >
                  {editingSubjectId === s.id ? (
                    <div className="flex flex-1 flex-col gap-1.5">
                      <input
                        autoFocus
                        value={editSubjectName}
                        onChange={(e) => setEditSubjectName(e.target.value)}
                        placeholder="Course name"
                        className="input-field !py-1.5 text-sm"
                      />
                      <input
                        value={editSubjectProf}
                        onChange={(e) => setEditSubjectProf(e.target.value)}
                        placeholder="Professor (optional)"
                        className="input-field !py-1.5 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveSubject(s.id)}
                          className="btn-primary flex-1 !py-1.5 text-xs"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingSubjectId(null)}
                          className="btn-secondary flex-1 !py-1.5 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="h-7 w-7 shrink-0 rounded-lg" style={{ backgroundColor: s.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {s.name}
                        </p>
                        {s.professorName && <p className="truncate text-xs text-muted">{s.professorName}</p>}
                      </div>
                      <button
                        onClick={() => {
                          setEditingSubjectId(s.id)
                          setEditSubjectName(s.name)
                          setEditSubjectProf(s.professorName ?? '')
                        }}
                        className="p-1 text-muted hover:text-indigo-500"
                        aria-label={`Rename ${s.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteSubject(s)}
                        className="p-1 text-muted hover:text-red-500"
                        aria-label={`Delete ${s.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              ))}

              {showNewSubjectFor === sem.id ? (
                <div className="flex flex-col gap-2 rounded-xl border border-black/5 p-2.5 dark:border-white/10">
                  <input
                    autoFocus
                    placeholder="Course name (e.g. PSY 101)"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    className="input-field !py-1.5 text-sm"
                  />
                  <input
                    placeholder="Professor (optional)"
                    value={newSubjectProf}
                    onChange={(e) => setNewSubjectProf(e.target.value)}
                    className="input-field !py-1.5 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => handleCreateSubject(sem.id)}
                      className="btn-primary flex-1 !py-1.5 text-xs"
                    >
                      Add course
                    </button>
                    <button
                      onClick={() => setShowNewSubjectFor(null)}
                      className="btn-secondary flex-1 !py-1.5 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewSubjectFor(sem.id)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-black/10 py-2.5 text-xs text-muted dark:border-white/15"
                >
                  <Plus size={14} /> Add a course to {sem.name}
                </button>
              )}
            </div>
          </div>
        )
      })}

      {showNewSemester ? (
        <div className="glass-card flex flex-col gap-2 rounded-2xl p-4">
          <label className="text-xs font-medium text-muted">
            Semester or term name — courses like "PSY 101" go inside it, once it exists
          </label>
          <div className="flex gap-2">
            <input
              autoFocus
              placeholder="e.g. Fall 2026, or Year 2"
              value={newSemesterName}
              onChange={(e) => setNewSemesterName(e.target.value)}
              className="input-field flex-1"
            />
            <button disabled={busy} onClick={handleCreateSemester} className="btn-primary">
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowNewSemester(true)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-black/10 py-4 text-sm text-muted dark:border-white/15"
        >
          <Plus size={16} /> Add another semester
        </button>
      )}
    </div>
  )
}
