import { useEffect, useState } from 'react'
import {
  BellRing,
  CalendarClock,
  Check,
  GraduationCap,
  Plus,
  Trash2,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { listSubjects } from '../lib/data'
import {
  createClassScheduleEntry,
  createReminder,
  deleteClassScheduleEntry,
  deleteReminder,
  listClassSchedule,
  listReminders,
  toggleReminderDone,
  DAY_NAMES,
} from '../lib/schedule'
import { requestNotificationPermission } from '../lib/useReminderNotifications'
import {
  addScaleEntry,
  computeGpa,
  deleteScaleEntry,
  listCourseGrades,
  listGradeScale,
  resetToDefaultScale,
  upsertCourseGrade,
} from '../lib/grades'
import type { Subject } from '../types/domain'
import type { ClassScheduleEntry, Reminder } from '../types/domain'
import type { CourseGrade, GradeScaleEntry } from '../types/grades'

type Tab = 'timetable' | 'grades'

export default function SchedulePage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('timetable')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listSubjects()
      .then(setSubjects)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load subjects.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col gap-5 px-5 pt-6 pb-10">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Timetable & Grades</h1>
      {error && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setTab('timetable')}
          className={`flex items-center gap-1.5 border-b-2 px-1 pb-2 text-sm font-medium ${
            tab === 'timetable'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500'
          }`}
        >
          <CalendarClock size={15} /> Timetable
        </button>
        <button
          onClick={() => setTab('grades')}
          className={`flex items-center gap-1.5 border-b-2 px-1 pb-2 text-sm font-medium ${
            tab === 'grades' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'
          }`}
        >
          <GraduationCap size={15} /> Grades / GPA
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : subjects.length === 0 ? (
        <p className="text-xs text-gray-400">Add a subject on the Notes tab first.</p>
      ) : tab === 'timetable' ? (
        <TimetableTab subjects={subjects} userId={user?.id} />
      ) : (
        <GradesTab subjects={subjects} userId={user?.id} />
      )}
    </div>
  )
}

// --- Timetable ------------------------------------------------------------------

function TimetableTab({ subjects, userId }: { subjects: Subject[]; userId?: string }) {
  const [entries, setEntries] = useState<ClassScheduleEntry[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showClassForm, setShowClassForm] = useState(false)
  const [classSubject, setClassSubject] = useState(subjects[0]?.id ?? '')
  const [day, setDay] = useState(1)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [location, setLocation] = useState('')

  const [showReminderForm, setShowReminderForm] = useState(false)
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderAt, setReminderAt] = useState('')
  const [reminderSubject, setReminderSubject] = useState('')
  const [reminderNote, setReminderNote] = useState('')

  const reload = async () => {
    const [c, r] = await Promise.all([listClassSchedule(), listReminders()])
    setEntries(c)
    setReminders(r)
  }

  useEffect(() => {
    reload().catch((err) => setError(err instanceof Error ? err.message : 'Could not load your schedule.'))
  }, [])

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? 'Unknown'
  const subjectColor = (id: string) => subjects.find((s) => s.id === id)?.color ?? '#6366f1'

  const handleAddClass = async () => {
    if (!userId || !classSubject) return
    setBusy(true)
    try {
      await createClassScheduleEntry(userId, classSubject, day, startTime, endTime, location)
      setLocation('')
      setShowClassForm(false)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add class.')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteClass = async (id: string) => {
    setBusy(true)
    try {
      await deleteClassScheduleEntry(id)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const handleAddReminder = async () => {
    if (!userId || !reminderTitle.trim() || !reminderAt) return
    setBusy(true)
    try {
      requestNotificationPermission()
      await createReminder(
        userId,
        reminderTitle.trim(),
        new Date(reminderAt).toISOString(),
        reminderSubject || null,
        reminderNote.trim(),
      )
      setReminderTitle('')
      setReminderAt('')
      setReminderNote('')
      setShowReminderForm(false)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add reminder.')
    } finally {
      setBusy(false)
    }
  }

  const handleToggleDone = async (r: Reminder) => {
    await toggleReminderDone(r.id, !r.isDone)
    await reload()
  }

  const handleDeleteReminder = async (id: string) => {
    await deleteReminder(id)
    await reload()
  }

  const byDay = DAY_NAMES.map((_, d) => entries.filter((e) => e.dayOfWeek === d)).map((list) =>
    list.sort((a, b) => a.startTime.localeCompare(b.startTime)),
  )
  const activeReminders = reminders.filter((r) => !r.isDone)
  const doneReminders = reminders.filter((r) => r.isDone)

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Weekly class schedule</h2>
        </div>
        <div className="flex flex-col gap-3">
          {DAY_NAMES.map((name, d) =>
            byDay[d].length === 0 ? null : (
              <div key={d}>
                <p className="mb-1 text-xs font-medium text-gray-500">{name}</p>
                <div className="flex flex-col gap-1.5">
                  {byDay[d].map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center gap-3 rounded-xl border border-gray-200 p-2.5 dark:border-gray-800"
                    >
                      <span
                        className="h-8 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: subjectColor(e.subjectId) }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {subjectName(e.subjectId)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {e.startTime.slice(0, 5)}–{e.endTime.slice(0, 5)}
                          {e.location ? ` · ${e.location}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteClass(e.id)}
                        className="p-1 text-gray-300 hover:text-red-500"
                        aria-label="Delete class"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}
          {entries.length === 0 && <p className="text-xs text-gray-400">No classes scheduled yet.</p>}

          {!showClassForm ? (
            <button
              onClick={() => setShowClassForm(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-3 text-sm text-gray-500 dark:border-gray-700"
            >
              <Plus size={16} /> Add a class
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
              <select
                value={classSubject}
                onChange={(e) => setClassSubject(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                {DAY_NAMES.map((n, d) => (
                  <option key={d} value={d}>
                    {n}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
              </div>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Room / building (optional)"
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={handleAddClass}
                  className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-sm font-medium text-white"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowClassForm(false)}
                  className="flex-1 rounded-lg border border-gray-300 py-1.5 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
            <BellRing size={15} /> Reminders
          </h2>
          <span className="text-[11px] text-gray-400">Alerts while the app is open</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {activeReminders.length === 0 && (
            <p className="text-xs text-gray-400">No upcoming reminders.</p>
          )}
          {activeReminders.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-xl border border-gray-200 p-2.5 dark:border-gray-800"
            >
              <button
                onClick={() => handleToggleDone(r)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 dark:border-gray-600"
                aria-label="Mark done"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{r.title}</p>
                <p className="text-xs text-gray-500">
                  {new Date(r.remindAt).toLocaleString()}
                  {r.subjectId ? ` · ${subjectName(r.subjectId)}` : ''}
                </p>
              </div>
              <button
                onClick={() => handleDeleteReminder(r.id)}
                className="p-1 text-gray-300 hover:text-red-500"
                aria-label="Delete reminder"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {doneReminders.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-gray-400">
                {doneReminders.length} completed
              </summary>
              <div className="mt-1.5 flex flex-col gap-1.5">
                {doneReminders.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-xl border border-gray-100 p-2.5 opacity-60 dark:border-gray-800"
                  >
                    <Check size={15} className="shrink-0 text-emerald-500" />
                    <p className="min-w-0 flex-1 truncate text-sm line-through">{r.title}</p>
                    <button
                      onClick={() => handleDeleteReminder(r.id)}
                      className="p-1 text-gray-300 hover:text-red-500"
                      aria-label="Delete reminder"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}

          {!showReminderForm ? (
            <button
              onClick={() => setShowReminderForm(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-3 text-sm text-gray-500 dark:border-gray-700"
            >
              <Plus size={16} /> Add a reminder
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
              <input
                value={reminderTitle}
                onChange={(e) => setReminderTitle(e.target.value)}
                placeholder="e.g. Essay due, Exam study session"
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
              <input
                type="datetime-local"
                value={reminderAt}
                onChange={(e) => setReminderAt(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
              <select
                value={reminderSubject}
                onChange={(e) => setReminderSubject(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="">No specific subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <textarea
                value={reminderNote}
                onChange={(e) => setReminderNote(e.target.value)}
                placeholder="Note (optional)"
                rows={2}
                className="resize-none rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
              <div className="flex gap-2">
                <button
                  disabled={busy || !reminderTitle.trim() || !reminderAt}
                  onClick={handleAddReminder}
                  className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowReminderForm(false)}
                  className="flex-1 rounded-lg border border-gray-300 py-1.5 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="flex justify-center">
        {'Notification' in window && Notification.permission !== 'granted' && (
          <button
            onClick={requestNotificationPermission}
            className="text-xs font-medium text-indigo-600"
          >
            Enable browser notifications for reminders
          </button>
        )}
      </div>
    </div>
  )
}

// --- Grades / GPA ----------------------------------------------------------------

function GradesTab({ subjects, userId }: { subjects: Subject[]; userId?: string }) {
  const [scale, setScale] = useState<GradeScaleEntry[]>([])
  const [courses, setCourses] = useState<CourseGrade[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showScaleEditor, setShowScaleEditor] = useState(false)
  const [newLetter, setNewLetter] = useState('')
  const [newGpa, setNewGpa] = useState('')
  const [newMinPercent, setNewMinPercent] = useState('')

  const reload = async () => {
    const [s, c] = await Promise.all([listGradeScale(), listCourseGrades()])
    setScale(s)
    setCourses(c)
  }

  useEffect(() => {
    reload().catch((err) => setError(err instanceof Error ? err.message : 'Could not load grades.'))
  }, [])

  const handleResetScale = async () => {
    if (!userId) return
    setBusy(true)
    try {
      const s = await resetToDefaultScale(userId)
      setScale(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the grading scale.')
    } finally {
      setBusy(false)
    }
  }

  const handleAddScaleEntry = async () => {
    if (!userId || !newLetter.trim() || !newGpa || !newMinPercent) return
    setBusy(true)
    try {
      await addScaleEntry(userId, newLetter.trim(), Number(newGpa), Number(newMinPercent))
      setNewLetter('')
      setNewGpa('')
      setNewMinPercent('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that grade.')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteScaleEntry = async (id: string) => {
    await deleteScaleEntry(id)
    await reload()
  }

  const courseFor = (subjectId: string) => courses.find((c) => c.subjectId === subjectId)

  const handleUpdateCourse = async (
    subjectId: string,
    field: 'creditHours' | 'gradePercent' | 'letterGrade',
    value: string,
  ) => {
    if (!userId) return
    const existing = courseFor(subjectId)
    const creditHours = field === 'creditHours' ? Number(value) || 0 : (existing?.creditHours ?? 3)
    const gradePercent =
      field === 'gradePercent' ? (value === '' ? null : Number(value)) : (existing?.gradePercent ?? null)
    const letterGrade =
      field === 'letterGrade' ? (value === '' ? null : value) : (existing?.letterGrade ?? null)
    try {
      await upsertCourseGrade(userId, subjectId, creditHours, gradePercent, letterGrade)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that grade.')
    }
  }

  const { gpa, totalCredits } = computeGpa(scale, courses)

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}

      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-4 text-white">
        <p className="text-xs font-medium uppercase tracking-wide opacity-80">Cumulative GPA</p>
        <p className="mt-1 text-3xl font-semibold">{gpa !== null ? gpa.toFixed(2) : '—'}</p>
        <p className="mt-1 text-xs opacity-80">
          {totalCredits} credit hour{totalCredits === 1 ? '' : 's'} graded
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Your courses</h2>
        <div className="flex flex-col gap-2">
          {subjects.map((s) => {
            const c = courseFor(s.id)
            return (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-800"
              >
                <span className="h-6 w-6 shrink-0 rounded-md" style={{ backgroundColor: s.color }} />
                <p className="min-w-[7rem] flex-1 truncate text-sm font-medium text-gray-900 dark:text-white">
                  {s.name}
                </p>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  defaultValue={c?.creditHours ?? 3}
                  onBlur={(e) => handleUpdateCourse(s.id, 'creditHours', e.target.value)}
                  className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
                  title="Credit hours"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="%"
                  defaultValue={c?.gradePercent ?? ''}
                  onBlur={(e) => handleUpdateCourse(s.id, 'gradePercent', e.target.value)}
                  className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
                  title="Grade percent"
                />
                <select
                  defaultValue={c?.letterGrade ?? ''}
                  onChange={(e) => handleUpdateCourse(s.id, 'letterGrade', e.target.value)}
                  className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
                  title="Letter grade (overrides %)"
                >
                  <option value="">Letter</option>
                  {scale.map((e) => (
                    <option key={e.id} value={e.letter}>
                      {e.letter}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <button
          onClick={() => setShowScaleEditor((v) => !v)}
          className="text-xs font-medium text-indigo-600"
        >
          {showScaleEditor ? 'Hide' : 'Edit'} grading scale
        </button>
        {showScaleEditor && (
          <div className="mt-2 flex flex-col gap-2">
            {scale.length === 0 ? (
              <button
                disabled={busy}
                onClick={handleResetScale}
                className="rounded-xl border border-dashed border-gray-300 py-3 text-sm text-gray-500 dark:border-gray-700"
              >
                Use a standard 4.0 scale to start
              </button>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  {scale.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-1.5 text-xs dark:border-gray-800"
                    >
                      <span>
                        {e.letter} — {e.gpa.toFixed(1)} GPA, {e.minPercent}%+
                      </span>
                      <button onClick={() => handleDeleteScaleEntry(e.id)} className="text-gray-300 hover:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={handleResetScale} disabled={busy} className="text-xs text-gray-500 underline">
                  Reset to standard 4.0 scale
                </button>
              </>
            )}
            <div className="flex gap-2">
              <input
                value={newLetter}
                onChange={(e) => setNewLetter(e.target.value)}
                placeholder="Letter"
                className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900"
              />
              <input
                value={newGpa}
                onChange={(e) => setNewGpa(e.target.value)}
                type="number"
                step={0.1}
                placeholder="GPA"
                className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900"
              />
              <input
                value={newMinPercent}
                onChange={(e) => setNewMinPercent(e.target.value)}
                type="number"
                placeholder="Min %"
                className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900"
              />
              <button
                disabled={busy || !newLetter.trim() || !newGpa || !newMinPercent}
                onClick={handleAddScaleEntry}
                className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Add grade
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
