import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Loader2, Printer } from 'lucide-react'
import { getPresentation, listSlides } from '../lib/slides'
import type { Presentation, Slide } from '../types/slides'

export default function SlideDeckPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [deck, setDeck] = useState<Presentation | null>(null)
  const [slides, setSlides] = useState<Slide[]>([])
  const [index, setIndex] = useState(0)
  const [showScript, setShowScript] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      try {
        const d = await getPresentation(id!)
        if (cancelled) return
        setDeck(d)

        if (d.status === 'generating') {
          pollRef.current = window.setTimeout(load, 1500)
          return
        }
        if (d.status === 'failed') {
          setLoading(false)
          return
        }

        const s = await listSlides(id!)
        if (cancelled) return
        setSlides(s)
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load this presentation.')
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      cancelled = true
      if (pollRef.current) window.clearTimeout(pollRef.current)
    }
  }, [id])

  const handleExport = () => {
    if (!deck) return
    const text = slides
      .map(
        (s, i) =>
          `Slide ${i + 1}: ${s.title}\n${s.bullets.map((b) => `- ${b}`).join('\n')}\n\nScript:\n${s.speakerNotes}`,
      )
      .join('\n\n---\n\n')
    const blob = new Blob([`${deck.topic}\n\n${text}`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${deck.topic.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'presentation'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-gray-400">
        <Loader2 size={16} className="animate-spin" /> Building your slides and script…
      </div>
    )
  }

  if (!deck || deck.status === 'failed') {
    return (
      <div className="px-5 pt-6 text-sm text-red-600">
        {deck?.error ?? error ?? 'This presentation failed to generate. Try again from the Slides tab.'}
      </div>
    )
  }

  const slide = slides[index]

  return (
    <div className="flex flex-col gap-4 px-5 pt-6 pb-10">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <button onClick={() => navigate('/slides')} className="p-1 text-gray-500">
            <ChevronLeft size={20} />
          </button>
          <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-white">{deck.topic}</h1>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
          >
            <Download size={14} /> Export
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700 print:hidden">{error}</p>}

      {/* Single-slide viewer (screen only) */}
      {slide && (
        <div className="flex flex-col gap-3 print:hidden">
          <div className="flex aspect-video w-full flex-col justify-center gap-4 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{slide.title}</h2>
            <ul className="flex flex-col gap-2">
              {slide.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="text-xs text-gray-400">
              {index + 1} / {slides.length}
            </span>
            <button
              onClick={() => setIndex((i) => Math.min(slides.length - 1, i + 1))}
              disabled={index === slides.length - 1}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>

          <button
            onClick={() => setShowScript((v) => !v)}
            className="self-start text-xs font-medium text-indigo-600"
          >
            {showScript ? 'Hide' : 'Show'} presentation script for this slide
          </button>
          {showScript && (
            <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              {slide.speakerNotes || <span className="italic text-gray-400">No script for this slide.</span>}
            </div>
          )}
        </div>
      )}

      {/* Full deck + script, print-friendly (also usable as a scroll-through view) */}
      <div className="hidden flex-col gap-6 print:flex">
        <h1 className="text-xl font-semibold">{deck.topic}</h1>
        {slides.map((s, i) => (
          <div key={s.id} className="break-inside-avoid border-b border-gray-200 pb-4">
            <h2 className="text-base font-semibold">
              {i + 1}. {s.title}
            </h2>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {s.bullets.map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm italic text-gray-600">{s.speakerNotes}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
