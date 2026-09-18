import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Presentation, Sparkles } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { listSubjects, listNotes } from '../lib/data'
import { createPresentation, listPresentations } from '../lib/slides'
import type { Subject, Note } from '../types/domain'
import type { Presentation as PresentationDoc } from '../types/slides'

export default function SlidesPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectId, setSubjectId] = useState<string>('')
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([])
  const [topic, setTopic] = useState('')
  const [decks, setDecks] = useState<PresentationDoc[]>([])
  const [loading, setLoading] = useState(true)
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
    Promise.all([listNotes(subjectId), listPresentations(subjectId)])
      .then(([n, d]) => {
        setNotes(n)
        setDecks(d)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load notes.'))
  }, [subjectId])

  const toggleNote = (id: string) => {
    setSelectedNoteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleGenerate = async () => {
    if (!user || !subjectId || selectedNoteIds.length === 0 || !topic.trim()) return
    setGenerating(true)
    setError(null)
    try {
      const deck = await createPresentation(user.id, subjectId, selectedNoteIds, topic.trim())
      navigate(`/slides/${deck.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a presentation.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <div className="px-5 pt-6 text-sm text-muted">Loading…</div>

  if (subjects.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <Presentation size={26} className="text-indigo-400" />
        <p className="text-sm text-muted">Add a course and some notes first, then come back here.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 px-5 pt-6 pb-10">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Slides & Presentation</h1>
      <p className="-mt-3 text-xs text-muted">
        Turn a topic and your notes into a slide deck plus a matching presentation script.
      </p>
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-500">{error}</p>}

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
        <label className="mb-1 block text-xs font-medium text-muted">What's the presentation about?</label>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Photosynthesis overview for my group presentation"
          className="input-field"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-muted">Ground it in these notes</label>
          {notes.length > 0 && (
            <button
              onClick={() =>
                setSelectedNoteIds(selectedNoteIds.length === notes.length ? [] : notes.map((n) => n.id))
              }
              className="text-xs font-medium text-indigo-500"
            >
              {selectedNoteIds.length === notes.length ? 'Clear' : 'Select all'}
            </button>
          )}
        </div>
        {notes.length === 0 ? (
          <p className="text-xs text-muted">No notes for this course yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {notes.map((n) => (
              <label key={n.id} className="glass-card flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
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

      <button
        onClick={handleGenerate}
        disabled={generating || selectedNoteIds.length === 0 || !topic.trim()}
        className="btn-primary"
      >
        {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {generating ? 'Building your deck…' : 'Generate slides + script'}
      </button>

      {decks.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Previous decks</h2>
          <div className="flex flex-col gap-2 pb-6">
            {decks.map((d) => (
              <button
                key={d.id}
                onClick={() => navigate(`/slides/${d.id}`)}
                className="glass-card flex items-center justify-between rounded-2xl p-3 text-left text-sm transition-transform hover:-translate-y-0.5"
              >
                <span className="truncate">{d.topic}</span>
                <span className="shrink-0 text-xs text-muted">{d.status}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
