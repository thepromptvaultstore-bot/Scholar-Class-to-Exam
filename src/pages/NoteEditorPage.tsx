import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Camera, ChevronLeft, Download, Mic, Paperclip, Printer, Square, Trash2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import {
  attachMaterial,
  deleteNote,
  getMaterialUrl,
  listMaterials,
  removeMaterial,
  uploadLectureAudio,
  updateNote,
} from '../lib/data'
import { requestImageTranscription, requestTranscription } from '../lib/transcription'
import { useRecorder } from '../lib/useRecorder'
import { supabase } from '../lib/supabaseClient'
import type { Note, NoteMaterial } from '../types/domain'

function formatElapsed(ms: number) {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function NoteEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const recorder = useRecorder()
  const autoScan = Boolean((location.state as { autoScan?: boolean } | null)?.autoScan)
  const autoScanTriggered = useRef(false)

  const [note, setNote] = useState<Note | null>(null)
  const [materials, setMaterials] = useState<NoteMaterial[]>([])
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null)
  const [materialUrls, setMaterialUrls] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      try {
        const { data, error: fetchError } = await supabase
          .from('notes')
          .select('*')
          .eq('id', id)
          .single()
        if (fetchError) throw fetchError
        if (cancelled) return
        const n: Note = {
          id: data.id,
          subjectId: data.subject_id,
          sessionDate: data.session_date,
          title: data.title,
          captureMode: data.capture_mode,
          content: data.content,
          rawTranscript: data.raw_transcript,
          audioPath: data.audio_path,
          transcriptionStatus: data.transcription_status,
          transcriptionEngine: data.transcription_engine,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }
        setNote(n)
        setContent(n.content)
        setTitle(n.title)
        setMaterials(await listMaterials(n.id))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this note.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  // Debounced autosave for manual edits.
  useEffect(() => {
    if (!note || loading) return
    if (content === note.content && title === note.title) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(async () => {
      setSaving(true)
      try {
        await updateNote(note.id, { content, title })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save.')
      } finally {
        setSaving(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 800)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, title])

  const handleStopAndUpload = async () => {
    recorder.stop()
  }

  // Once the recorder produces a final blob, upload it and kick off transcription.
  useEffect(() => {
    async function process() {
      if (!recorder.blob || !note || !user) return
      setTranscribing(true)
      setError(null)
      try {
        const path = await uploadLectureAudio(user.id, note.id, recorder.blob)
        await updateNote(note.id, { audioPath: path })
        const { transcript } = await requestTranscription(path)
        const merged = content ? `${content}\n\n${transcript}` : transcript
        setContent(merged)
        await updateNote(note.id, {
          content: merged,
          rawTranscript: transcript,
          transcriptionStatus: 'done',
        })
        setNote((prev) => (prev ? { ...prev, transcriptionStatus: 'done' } : prev))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Transcription failed.')
        if (note) await updateNote(note.id, { transcriptionStatus: 'failed' })
      } finally {
        setTranscribing(false)
        recorder.reset()
      }
    }
    process()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.blob])

  // Coming from the "Scan handwritten" quick action — open the camera/photo
  // picker automatically instead of making the student tap the icon again.
  useEffect(() => {
    if (autoScan && !loading && note && !autoScanTriggered.current) {
      autoScanTriggered.current = true
      photoInputRef.current?.click()
    }
  }, [autoScan, loading, note])

  // Thumbnail previews for image materials (signed URLs, so fetched lazily
  // whenever the material list changes rather than kept as public links).
  useEffect(() => {
    let cancelled = false
    async function loadThumbnails() {
      const images = materials.filter((m) => m.fileType?.startsWith('image/') && !materialUrls[m.id])
      for (const m of images) {
        try {
          const url = await getMaterialUrl(m.filePath)
          if (!cancelled) setMaterialUrls((prev) => ({ ...prev, [m.id]: url }))
        } catch {
          // A thumbnail failing to load isn't worth surfacing as an error.
        }
      }
    }
    loadThumbnails()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials])

  const handleAttach = async (file: File) => {
    if (!user || !note) return
    setError(null)
    try {
      const material = await attachMaterial(user.id, note.id, file)
      setMaterials((prev) => [...prev, material])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not attach that file.')
    }
  }

  // Photographed handwritten (or printed) pages: attach each as a material
  // for reference, then OCR it straight into the note's text content — the
  // same "capture → merge into content" pattern the voice recorder uses, so
  // scanned notes end up living in the exact same place as typed/recorded ones.
  const handleScanPhotos = async (files: FileList) => {
    if (!user || !note || files.length === 0) return
    setError(null)
    setScanning(true)
    setScanProgress({ done: 0, total: files.length })
    let merged = content
    try {
      for (let i = 0; i < files.length; i++) {
        try {
          const material = await attachMaterial(user.id, note.id, files[i])
          setMaterials((prev) => [...prev, material])
          const { transcript } = await requestImageTranscription(material.filePath)
          if (transcript && !transcript.startsWith('[No readable text')) {
            merged = merged ? `${merged}\n\n${transcript}` : transcript
            setContent(merged)
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not scan one of the photos.')
        } finally {
          setScanProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev))
        }
      }
      if (merged !== note.content) {
        await updateNote(note.id, {
          content: merged,
          captureMode: note.captureMode === 'manual' ? 'photo' : note.captureMode,
          transcriptionStatus: 'done',
          transcriptionEngine: 'claude-vision',
        })
        setNote((prev) => (prev ? { ...prev, transcriptionStatus: 'done' } : prev))
      }
    } finally {
      setScanning(false)
      setScanProgress(null)
    }
  }

  const handleRemoveMaterial = async (m: NoteMaterial) => {
    try {
      await removeMaterial(m)
      setMaterials((prev) => prev.filter((x) => x.id !== m.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that file.')
    }
  }

  const handleDeleteNote = async () => {
    if (!note) return
    if (!window.confirm('Delete this note? This cannot be undone.')) return
    try {
      await deleteNote(note.id)
      navigate(-1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this note.')
    }
  }

  const handleExport = () => {
    if (!note) return
    const blob = new Blob([`${title}\n${note.sessionDate}\n\n${content}`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted">Loading…</div>
  }
  if (!note) {
    return <div className="p-6 text-sm text-red-500">{error ?? 'Note not found.'}</div>
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-6 pb-10">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-1 text-muted">
          <ChevronLeft size={20} />
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 truncate bg-transparent text-lg font-semibold text-gray-900 outline-none dark:text-white"
        />
        <button onClick={handleDeleteNote} className="p-1 text-muted hover:text-red-500">
          <Trash2 size={16} />
        </button>
      </div>
      <p className="-mt-3 text-xs text-muted">
        {note.sessionDate} {saving && '· saving…'}
      </p>

      {error && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        {recorder.state === 'recording' ? (
          <button
            onClick={handleStopAndUpload}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 py-3 text-sm font-medium text-white shadow-lg shadow-red-500/30"
          >
            <Square size={15} /> Stop · {formatElapsed(recorder.elapsedMs)}
          </button>
        ) : (
          <button onClick={recorder.start} disabled={transcribing} className="btn-primary flex-1">
            <Mic size={15} /> {transcribing ? 'Transcribing…' : 'Record more'}
          </button>
        )}
        <button
          onClick={() => photoInputRef.current?.click()}
          disabled={scanning}
          className="btn-secondary !px-3"
          aria-label="Scan handwritten notes"
        >
          <Camera size={15} />
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="btn-secondary !px-3">
          <Paperclip size={15} />
        </button>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files
            if (files && files.length > 0) handleScanPhotos(files)
            e.target.value = ''
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleAttach(f)
            e.target.value = ''
          }}
        />
      </div>
      {recorder.error && <p className="text-xs text-red-500">{recorder.error}</p>}
      {scanning && (
        <p className="text-xs text-muted">
          Scanning page{scanProgress && scanProgress.total > 1 ? `s (${scanProgress.done}/${scanProgress.total})` : ''}…
        </p>
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type notes here, record the class, or scan a handwritten page — the text shows up here either way…"
        className="input-field min-h-56 flex-1 resize-none leading-relaxed"
      />

      {materials.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Attached materials</h2>
          <div className="flex flex-col gap-2">
            {materials.map((m) => (
              <div key={m.id} className="glass-card flex items-center gap-3 rounded-xl px-3 py-2 text-sm">
                {m.fileType?.startsWith('image/') && materialUrls[m.id] ? (
                  <img
                    src={materialUrls[m.id]}
                    alt={m.fileName}
                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  />
                ) : null}
                <span className="min-w-0 flex-1 truncate">{m.fileName}</span>
                <button onClick={() => handleRemoveMaterial(m)} className="text-muted hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 flex gap-2">
        <button onClick={handleExport} className="btn-secondary flex-1">
          <Download size={15} /> Export
        </button>
        <button onClick={() => window.print()} className="btn-secondary flex-1">
          <Printer size={15} /> Print
        </button>
      </div>
    </div>
  )
}
