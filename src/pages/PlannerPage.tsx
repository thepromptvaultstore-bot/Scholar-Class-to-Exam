import { useEffect, useMemo, useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { listSubjects } from '../lib/data'
import { createReminder, deleteReminder, listReminders, toggleReminderDone } from '../lib/schedule'
import { requestNotificationPermission } from '../lib/useReminderNotifications'
import type { Reminder, ReminderKind, Subject } from '../types/domain'

// Deadlines you'd actually plan around get pulled out of Timetable and given
// a real page here — a weekly class grid and "what's due" are different
// mental models, the same reasoning that moved Grades out earlier.

const KIND_LABEL: Record<ReminderKind, string> = {
  assignment: 'Assignment',
  exam: 'Exam',
  reminder: 'Reminder',
}

const KIND_STYLE: Record<ReminderKind, string> = {
  assignment: 'bg-indigo-500/10 text-indigo-500',
  exam: 'bg-red-500/10 text-red-500',
  reminder: 'bg-black/5 text-muted dark:bg-white/10',
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function dueLabel(remindAt: string, now: Date): string {
  const due = new Date(remindAt)
  const dueDay = startOfLocalDay(due)
  const today = startOfLocalDay(now)
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000)
  const time = due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (diffDays === 0) return `Today, ${time}`
  if (diffDays === 1) return `Tomorrow, ${time}`
  if (diffDays === -1) return `Yesterday, ${time}`
  if (diffDays < 0) return `${due.toLocaleDateString([], { month: 'short', day: 'numeric' })} (overdue)`
  return `${due.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}, ${time}`
}

type Bucket = 'overdue' | 'today' | 'week' | 'later'

function bucketOf(remindAt: string, now: Date): Bucket {
  const due = new Date(remindAt)
  const dueDay = startOfLocalDay(due)
  const today = startOfLocalDay(now)
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000)
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays <= 7) return 'week'
  return 'later'
}

const BUCKET_TITLE: Record<Bucket, string> = {
  overdue: 'Overdue',
  today: 'Today',
  week: 'This week',
  later: 'Later',
}

export default function PlannerPage() {
  const { user } = useAuthStore()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now] = useState(new Date())

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<ReminderKind>('assignment')
  const [subjectId, setSubjectId] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [note, setNote] = useState('')

  const reload = async () => {
    const [s, r] = await Promise.all([listSubjects(), listReminders()])
    setSubjects(s)
    setReminders(r)
  }

  useEffect(() => {
    reload()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your planner.'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const subjectName = (id: string | null) => subjects.find((s) => s.id === id)?.name ?? null
  const subjectColor = (id: string | null) => subjects.find((s) => s.id === id)?.color ?? '#6366f1'

  const active = reminders.filter((r) => !r.isDone)
  const done = reminders.filter((r) => r.isDone)

  const grouped = useMemo(() => {
    const buckets: Record<Bucket, Reminder[]> = { overdue: [], today: [], week: [], later: [] }
    for (const r of active) buckets[bucketOf(r.remindAt, now)].push(r)
    for (const key of Object.keys(buckets) as Bucket[]) {
      buckets[key].sort((a, b) => a.remindAt.localeCompare(b.remindAt))
    }
    return buckets
  }, [active, now])

  const handleAdd = async () => {
    if (!user || !title.trim() || !dueAt) return
    setBusy(true)
    setError(null)
    try {
      requestNotificationPermission()
      await createReminder(user.id, title.trim(), new Date(dueAt).toISOString(), subjectId || null, note.trim(), kind)
      setTitle('')
      setDueAt('')
      setNote('')
      setSubjectId('')
      setKind('assignment')
      setShowForm(false)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that.')
    } finally {
      setBusy(false)
    }
  }

  const handleToggleDone = async (r: Reminder) => {
    setReminders((prev) => prev.map((x) => (x.id === r.id ? { ...x, isDone: !x.isDone } : x)))
    try {
      await toggleReminderDone(r.id, !r.isDone)
    } catch {
      await reload()
    }
  }

  const handleDelete = async (id: string) => {
    setReminders((prev) => prev.filter((x) => x.id !== id))
    try {
      await deleteReminder(id)
    } catch {
      await reload()
    }
  }

  return (
    <div className="flex flex-col gap-5 px-5 pt-6 pb-10">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Planner</h1>
      <p className="-mt-3 text-xs text-muted">Assignments, exams, and anything else with a due date.</p>

      {error && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-500">{error}</p>}

      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <>
          {active.length === 0 && (
            <p className="text-xs text-muted">Nothing due — add an assignment or exam below.</p>
          )}

          {(['overdue', 'today', 'week', 'later'] as Bucket[]).map(
            (bucket) =>
              grouped[bucket].length > 0 && (
                <section key={bucket}>
                  <h2
                    className={`mb-2 text-sm font-semibold ${
                      bucket === 'overdue' ? 'text-red-500' : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {BUCKET_TITLE[bucket]}
                  </h2>
                  <div className="flex flex-col gap-1.5">
                    {grouped[bucket].map((r) => (
                      <div key={r.id} className="glass-card flex items-center gap-3 rounded-2xl p-3">
                        <button
                          onClick={() => handleToggleDone(r)}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-black/15 dark:border-white/20"
                          aria-label="Mark done"
                        />
                        <span
                          className="h-8 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: subjectColor(r.subjectId) }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{r.title}</p>
                            <span
                              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${KIND_STYLE[r.kind]}`}
                            >
                              {KIND_LABEL[r.kind]}
                            </span>
                          </div>
                          <p className={`text-xs ${bucket === 'overdue' ? 'text-red-500' : 'text-muted'}`}>
                            {dueLabel(r.remindAt, now)}
                            {subjectName(r.subjectId) ? ` · ${subjectName(r.subjectId)}` : ''}
                          </p>
                          {r.note && <p className="mt-0.5 truncate text-xs text-muted">{r.note}</p>}
                        </div>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1 text-muted hover:text-red-500"
                          aria-label="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ),
          )}

          {done.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-muted">{done.length} completed</summary>
              <div className="mt-2 flex flex-col gap-1.5">
                {done.map((r) => (
                  <div key={r.id} className="glass-card flex items-center gap-3 rounded-2xl p-2.5 opacity-60">
                    <Check size={15} className="shrink-0 text-emerald-500" />
                    <p className="min-w-0 flex-1 truncate text-sm line-through">{r.title}</p>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="p-1 text-muted hover:text-red-500"
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}

          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="btn-secondary">
              <Plus size={16} /> Add assignment, exam, or reminder
            </button>
          ) : (
            <div className="glass-card flex flex-col gap-2 rounded-2xl p-3">
              <div className="grid grid-cols-3 gap-1.5">
                {(['assignment', 'exam', 'reminder'] as ReminderKind[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className={`rounded-xl border py-2 text-center text-xs font-semibold transition-colors ${
                      kind === k
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500'
                        : 'border-black/10 text-muted dark:border-white/15'
                    }`}
                  >
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Marketing essay, Midterm exam"
                className="input-field"
              />
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="input-field"
              />
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="input-field">
                <option value="">No specific course</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                rows={2}
                className="input-field resize-none"
              />
              <div className="flex gap-2">
                <button disabled={busy || !title.trim() || !dueAt} onClick={handleAdd} className="btn-primary flex-1">
                  Add
                </button>
                <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-center">
            {'Notification' in window && Notification.permission !== 'granted' && (
              <button onClick={requestNotificationPermission} className="text-xs font-medium text-indigo-500">
                Enable browser notifications
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
