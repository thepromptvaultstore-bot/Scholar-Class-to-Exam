import { useEffect, useState } from 'react'
import { BellRing, Check, Circle, Plus, Trash2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { listSubjects } from '../lib/data'
import {
  createClassScheduleEntry,
  createReminder,
  deleteClassScheduleEntry,
  deleteReminder,
  listAttendedForDate,
  listClassSchedule,
  listReminders,
  markClassAttended,
  toggleReminderDone,
  DAY_NAMES,
  DAY_SHORT,
} from '../lib/schedule'
import { requestNotificationPermission } from '../lib/useReminderNotifications'
import type { Subject } from '../types/domain'
import type { ClassScheduleEntry, Reminder } from '../types/domain'

// Deliberately local-calendar-day, NOT `.toISOString().slice(0, 10)` (which
// is UTC): this value is stored as `attended_date` and compared against
// `todayDow` below, which is local (`now.getDay()`). For anyone east of UTC,
// using a UTC date here used to go stale mid-local-day — e.g. mark a class
// attended in the morning (still "yesterday" in UTC), then reopen the app
// later the same local day once UTC has rolled over: the attendance lookup
// for the new UTC "today" wouldn't find that row, "Mark attended" would
// reappear, and clicking it again inserted a second row and double-awarded
// the XP for the same real-world attendance.
const todayISO = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Grades used to be a second tab bundled into this page — it's its own
// top-level page (and nav tab) now, see GradesPage.tsx, since burying a
// GPA calculator behind a tab inside "Timetable" made it easy to miss.
export default function SchedulePage() {
  const { user } = useAuthStore()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listSubjects()
      .then(setSubjects)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your courses.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col gap-5 px-5 pt-6 pb-10">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Timetable</h1>
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-500">{error}</p>}

      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : subjects.length === 0 ? (
        <p className="text-xs text-muted">Add a course on the Notes tab first.</p>
      ) : (
        <TimetableTab subjects={subjects} userId={user?.id} />
      )}
    </div>
  )
}

// --- Timetable: today agenda + full weekly grid + reminders ------------------------

const GRID_START_HOUR = 7
const GRID_END_HOUR = 22
const PX_PER_HOUR = 46
const GRID_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * PX_PER_HOUR

function minutesFromGridStart(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h - GRID_START_HOUR) * 60 + (m || 0)
}

function TimetableTab({ subjects, userId }: { subjects: Subject[]; userId?: string }) {
  const [entries, setEntries] = useState<ClassScheduleEntry[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [attendedToday, setAttendedToday] = useState<Set<string>>(new Set())
  const [now, setNow] = useState(new Date())
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
    const [c, r, attended] = await Promise.all([
      listClassSchedule(),
      listReminders(),
      listAttendedForDate(todayISO()),
    ])
    setEntries(c)
    setReminders(r)
    setAttendedToday(attended)
  }

  useEffect(() => {
    reload().catch((err) => setError(err instanceof Error ? err.message : 'Could not load your schedule.'))
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(t)
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

  const handleMarkAttended = async (entry: ClassScheduleEntry) => {
    if (!userId) return
    try {
      const awarded = await markClassAttended(userId, entry.id, entry.subjectId, todayISO())
      if (awarded) setAttendedToday((prev) => new Set(prev).add(entry.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark that class attended.')
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

  const todayDow = now.getDay()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const todaysClasses = entries
    .filter((e) => e.dayOfWeek === todayDow)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  const nextUpId = todaysClasses.find((e) => minutesFromGridStart(e.startTime) + GRID_START_HOUR * 60 > nowMinutes)?.id

  const byDay = DAY_NAMES.map((_, d) => entries.filter((e) => e.dayOfWeek === d))
  const activeReminders = reminders.filter((r) => !r.isDone)
  const doneReminders = reminders.filter((r) => r.isDone)

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-500">{error}</p>}

      {/* Today agenda strip */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
          Today · {DAY_NAMES[todayDow]}
        </h2>
        {todaysClasses.length === 0 ? (
          <p className="text-xs text-muted">No classes today.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {todaysClasses.map((e) => {
              const startAbs = GRID_START_HOUR * 60 + minutesFromGridStart(e.startTime)
              const endAbs = GRID_START_HOUR * 60 + minutesFromGridStart(e.endTime)
              const isNow = nowMinutes >= startAbs && nowMinutes < endAbs
              const isPast = nowMinutes >= endAbs
              const isNext = e.id === nextUpId
              const attended = attendedToday.has(e.id)
              return (
                <div
                  key={e.id}
                  className={`glass-card flex items-center gap-3 rounded-2xl p-3 transition-all ${
                    isNow ? 'ring-2 ring-indigo-500/60' : isNext ? 'ring-1 ring-indigo-400/30' : ''
                  }`}
                >
                  <span
                    className="h-9 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: subjectColor(e.subjectId) }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {subjectName(e.subjectId)}
                      {isNow && (
                        <span className="ml-2 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold text-indigo-500">
                          NOW
                        </span>
                      )}
                      {!isNow && isNext && (
                        <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold text-muted dark:bg-white/10">
                          NEXT
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {e.startTime.slice(0, 5)}–{e.endTime.slice(0, 5)}
                      {e.location ? ` · ${e.location}` : ''}
                    </p>
                  </div>
                  {isPast &&
                    (attended ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-500">
                        <Check size={14} /> +8 XP
                      </span>
                    ) : (
                      <button
                        onClick={() => handleMarkAttended(e)}
                        className="btn-secondary !px-2.5 !py-1.5 text-xs"
                      >
                        <Circle size={12} /> Mark attended
                      </button>
                    ))}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Full weekly grid */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Weekly routine</h2>
        {entries.length === 0 ? (
          <p className="text-xs text-muted">No classes scheduled yet — add your first one below.</p>
        ) : (
          <div className="glass-card overflow-x-auto rounded-2xl p-3">
            <div className="flex min-w-[640px]" style={{ height: GRID_HEIGHT + 28 }}>
              <div className="relative w-12 shrink-0 pt-7">
                {Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => (
                  <span
                    key={i}
                    className="absolute -translate-y-1/2 text-[10px] text-muted"
                    style={{ top: i * PX_PER_HOUR }}
                  >
                    {GRID_START_HOUR + i}:00
                  </span>
                ))}
              </div>
              {DAY_SHORT.map((label, d) => (
                <div key={d} className="relative flex-1 border-l border-black/5 pt-7 dark:border-white/10">
                  <p
                    className={`absolute -top-0.5 left-1/2 -translate-x-1/2 text-[11px] font-medium ${
                      d === todayDow ? 'text-indigo-500' : 'text-muted'
                    }`}
                  >
                    {label}
                  </p>
                  <div className="relative" style={{ height: GRID_HEIGHT }}>
                    {byDay[d].map((e) => {
                      const top = Math.max(0, minutesFromGridStart(e.startTime)) * (PX_PER_HOUR / 60)
                      const height = Math.max(
                        18,
                        (minutesFromGridStart(e.endTime) - minutesFromGridStart(e.startTime)) *
                          (PX_PER_HOUR / 60),
                      )
                      return (
                        <div
                          key={e.id}
                          title={`${subjectName(e.subjectId)} · ${e.startTime.slice(0, 5)}–${e.endTime.slice(0, 5)}`}
                          className="absolute left-0.5 right-0.5 overflow-hidden rounded-lg px-1.5 py-1 text-[10px] font-medium text-white shadow-sm"
                          style={{ top, height, backgroundColor: subjectColor(e.subjectId) }}
                        >
                          <p className="truncate">{subjectName(e.subjectId)}</p>
                          <p className="truncate opacity-80">{e.startTime.slice(0, 5)}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-2">
          {!showClassForm ? (
            <button onClick={() => setShowClassForm(true)} className="btn-secondary w-full">
              <Plus size={16} /> Add a class
            </button>
          ) : (
            <div className="glass-card flex flex-col gap-2 rounded-2xl p-3">
              <select
                value={classSubject}
                onChange={(e) => setClassSubject(e.target.value)}
                className="input-field"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select value={day} onChange={(e) => setDay(Number(e.target.value))} className="input-field">
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
                  className="input-field flex-1"
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="input-field flex-1"
                />
              </div>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Room / building (optional)"
                className="input-field"
              />
              <div className="flex gap-2">
                <button disabled={busy} onClick={handleAddClass} className="btn-primary flex-1">
                  Add
                </button>
                <button onClick={() => setShowClassForm(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {entries.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted">Manage / delete classes</summary>
            <div className="mt-2 flex flex-col gap-1.5">
              {DAY_NAMES.map(
                (name, d) =>
                  byDay[d].length > 0 && (
                    <div key={d}>
                      <p className="mb-1 text-[11px] font-medium text-muted">{name}</p>
                      {byDay[d].map((e) => (
                        <div
                          key={e.id}
                          className="mb-1 flex items-center gap-2 rounded-lg border border-black/5 px-2.5 py-1.5 text-xs dark:border-white/10"
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: subjectColor(e.subjectId) }}
                          />
                          <span className="flex-1 truncate">
                            {subjectName(e.subjectId)} · {e.startTime.slice(0, 5)}–{e.endTime.slice(0, 5)}
                          </span>
                          <button
                            onClick={() => handleDeleteClass(e.id)}
                            className="text-muted hover:text-red-500"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ),
              )}
            </div>
          </details>
        )}
      </section>

      {/* Reminders */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
            <BellRing size={15} /> Reminders
          </h2>
          <span className="text-[11px] text-muted">Alerts while the app is open</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {activeReminders.length === 0 && <p className="text-xs text-muted">No upcoming reminders.</p>}
          {activeReminders.map((r) => (
            <div key={r.id} className="glass-card flex items-center gap-3 rounded-2xl p-2.5">
              <button
                onClick={() => handleToggleDone(r)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-black/15 dark:border-white/20"
                aria-label="Mark done"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{r.title}</p>
                <p className="text-xs text-muted">
                  {new Date(r.remindAt).toLocaleString()}
                  {r.subjectId ? ` · ${subjectName(r.subjectId)}` : ''}
                </p>
              </div>
              <button
                onClick={() => handleDeleteReminder(r.id)}
                className="p-1 text-muted hover:text-red-500"
                aria-label="Delete reminder"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {doneReminders.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-muted">{doneReminders.length} completed</summary>
              <div className="mt-1.5 flex flex-col gap-1.5">
                {doneReminders.map((r) => (
                  <div key={r.id} className="glass-card flex items-center gap-3 rounded-2xl p-2.5 opacity-60">
                    <Check size={15} className="shrink-0 text-emerald-500" />
                    <p className="min-w-0 flex-1 truncate text-sm line-through">{r.title}</p>
                    <button
                      onClick={() => handleDeleteReminder(r.id)}
                      className="p-1 text-muted hover:text-red-500"
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
            <button onClick={() => setShowReminderForm(true)} className="btn-secondary">
              <Plus size={16} /> Add a reminder
            </button>
          ) : (
            <div className="glass-card flex flex-col gap-2 rounded-2xl p-3">
              <input
                value={reminderTitle}
                onChange={(e) => setReminderTitle(e.target.value)}
                placeholder="e.g. Essay due, Exam study session"
                className="input-field"
              />
              <input
                type="datetime-local"
                value={reminderAt}
                onChange={(e) => setReminderAt(e.target.value)}
                className="input-field"
              />
              <select
                value={reminderSubject}
                onChange={(e) => setReminderSubject(e.target.value)}
                className="input-field"
              >
                <option value="">No specific course</option>
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
                className="input-field resize-none"
              />
              <div className="flex gap-2">
                <button
                  disabled={busy || !reminderTitle.trim() || !reminderAt}
                  onClick={handleAddReminder}
                  className="btn-primary flex-1"
                >
                  Add
                </button>
                <button onClick={() => setShowReminderForm(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="flex justify-center">
        {'Notification' in window && Notification.permission !== 'granted' && (
          <button onClick={requestNotificationPermission} className="text-xs font-medium text-indigo-500">
            Enable browser notifications for reminders
          </button>
        )}
      </div>
    </div>
  )
}
