import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import {
  getAttempt,
  getPracticeSet,
  listAnswers,
  listAttempts,
  listQuestions,
  saveAnswer,
  startAttempt,
  submitAttempt,
} from '../lib/practice'
import type { PracticeAnswer, PracticeAttempt, PracticeQuestion, PracticeSet } from '../types/practice'

export default function PracticeSetPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [set, setSet] = useState<PracticeSet | null>(null)
  const [questions, setQuestions] = useState<PracticeQuestion[]>([])
  const [pastAttempts, setPastAttempts] = useState<PracticeAttempt[]>([])
  const [attempt, setAttempt] = useState<PracticeAttempt | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [gradedAnswers, setGradedAnswers] = useState<PracticeAnswer[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      try {
        const s = await getPracticeSet(id!)
        if (cancelled) return
        setSet(s)

        if (s.status === 'generating') {
          pollRef.current = window.setTimeout(load, 1500)
          return
        }
        if (s.status === 'failed') {
          setLoading(false)
          return
        }

        const [qs, atts] = await Promise.all([listQuestions(id!), listAttempts(id!)])
        if (cancelled) return
        setQuestions(qs)
        setPastAttempts(atts)
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load this practice set.')
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

  const handleStart = async () => {
    if (!user || !id) return
    setError(null)
    try {
      const a = await startAttempt(user.id, id)
      setAttempt(a)
      setAnswers({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start.')
    }
  }

  const handleViewResult = async (attemptId: string) => {
    setError(null)
    try {
      const [a, ans] = await Promise.all([getAttempt(attemptId), listAnswers(attemptId)])
      setAttempt(a)
      setGradedAnswers(ans)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load that attempt.')
    }
  }

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleAnswerBlur = async (questionId: string) => {
    if (!attempt) return
    try {
      await saveAnswer(attempt.id, questionId, answers[questionId] ?? '')
    } catch {
      // Autosave failures aren't fatal here — the answer is still submitted
      // with the final grading request.
    }
  }

  const handleSubmit = async () => {
    if (!attempt) return
    setSubmitting(true)
    setError(null)
    try {
      // Make sure every answer is persisted before grading.
      await Promise.all(
        questions.map((q) => saveAnswer(attempt.id, q.id, answers[q.id] ?? '')),
      )
      await submitAttempt(attempt.id, user?.id, set?.subjectId)
      await handleViewResult(attempt.id)
      const atts = await listAttempts(id!)
      setPastAttempts(atts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grading failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-gray-400">
        <Loader2 size={16} className="animate-spin" /> Generating your {set?.format ?? 'practice set'}…
      </div>
    )
  }

  if (!set || set.status === 'failed') {
    return (
      <div className="px-5 pt-6 text-sm text-red-600">
        {set?.error ?? error ?? 'This practice set failed to generate. Try again from the Practice tab.'}
      </div>
    )
  }

  const gradedResult = attempt && attempt.status === 'graded'

  return (
    <div className="flex flex-col gap-4 px-5 pt-6 pb-10">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/practice')} className="p-1 text-gray-500">
          <ChevronLeft size={20} />
        </button>
        <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-white">{set.title}</h1>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}

      {!attempt && (
        <>
          {pastAttempts.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Past attempts</h2>
              <div className="flex flex-col gap-2">
                {pastAttempts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => handleViewResult(a.id)}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-800"
                  >
                    <span>{new Date(a.startedAt).toLocaleString()}</span>
                    <span className="font-medium text-indigo-600">
                      {a.status === 'graded' ? `${a.totalScore}%` : a.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={handleStart}
            className="rounded-xl bg-indigo-600 py-3 text-sm font-medium text-white"
          >
            {pastAttempts.length > 0 ? 'Try again' : 'Start'}
          </button>
        </>
      )}

      {attempt && !gradedResult && (
        <div className="flex flex-col gap-4">
          {questions.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
              <p className="mb-2 text-sm font-medium text-gray-900 dark:text-white">
                {i + 1}. {q.prompt}
              </p>
              {q.type === 'mcq' && q.choices && (
                <div className="flex flex-col gap-1.5">
                  {q.choices.map((choice) => (
                    <label key={choice} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={q.id}
                        checked={answers[q.id] === choice}
                        onChange={() => {
                          handleAnswerChange(q.id, choice)
                          saveAnswer(attempt.id, q.id, choice).catch(() => {})
                        }}
                      />
                      {choice}
                    </label>
                  ))}
                </div>
              )}
              {q.type === 'true_false' && (
                <div className="flex gap-3">
                  {['True', 'False'].map((choice) => (
                    <label key={choice} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={q.id}
                        checked={answers[q.id] === choice}
                        onChange={() => {
                          handleAnswerChange(q.id, choice)
                          saveAnswer(attempt.id, q.id, choice).catch(() => {})
                        }}
                      />
                      {choice}
                    </label>
                  ))}
                </div>
              )}
              {q.type === 'fill_blank' && (
                <input
                  value={answers[q.id] ?? ''}
                  onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                  onBlur={() => handleAnswerBlur(q.id)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
              )}
              {(q.type === 'short_answer' || q.type === 'essay') && (
                <textarea
                  value={answers[q.id] ?? ''}
                  onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                  onBlur={() => handleAnswerBlur(q.id)}
                  rows={q.type === 'essay' ? 5 : 3}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
              )}
            </div>
          ))}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? 'Grading…' : 'Submit for grading'}
          </button>
        </div>
      )}

      {attempt && gradedResult && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-4 text-center text-white">
            <p className="text-xs uppercase tracking-wide opacity-80">Score</p>
            <p className="text-3xl font-semibold">{attempt.totalScore}%</p>
          </div>
          {questions.map((q, i) => {
            const a = gradedAnswers.find((x) => x.questionId === q.id)
            return (
              <div key={q.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {i + 1}. {q.prompt}
                </p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Your answer: {a?.userAnswer || <span className="italic text-gray-400">blank</span>}
                </p>
                <p
                  className={`mt-1 text-xs font-medium ${
                    a?.isCorrect ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {a?.score ?? 0}/{q.maxScore} {a?.feedback ? `· ${a.feedback}` : ''}
                </p>
              </div>
            )
          })}
          <button
            onClick={() => {
              setAttempt(null)
              setGradedAnswers([])
            }}
            className="rounded-xl border border-gray-300 py-2.5 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-200"
          >
            Back to overview
          </button>
        </div>
      )}
    </div>
  )
}
