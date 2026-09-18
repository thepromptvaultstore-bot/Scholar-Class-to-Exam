import { supabase } from './supabaseClient'
import { awardPracticeGenerated, awardPracticeGraded } from './gamification'
import type {
  PracticeAnswer,
  PracticeAttempt,
  PracticeFormat,
  PracticeQuestion,
  PracticeScope,
  PracticeSet,
} from '../types/practice'

const setFromRow = (r: Record<string, unknown>): PracticeSet => ({
  id: r.id as string,
  subjectId: r.subject_id as string,
  noteIds: (r.note_ids as string[]) ?? [],
  title: r.title as string,
  scope: r.scope as PracticeScope,
  format: r.format as PracticeFormat,
  status: r.status as PracticeSet['status'],
  error: (r.error as string) ?? null,
  shareToken: (r.share_token as string) ?? null,
  createdAt: r.created_at as string,
})

const questionFromRow = (r: Record<string, unknown>): PracticeQuestion => ({
  id: r.id as string,
  practiceSetId: r.practice_set_id as string,
  orderIndex: r.order_index as number,
  type: r.type as PracticeQuestion['type'],
  prompt: r.prompt as string,
  choices: (r.choices as string[]) ?? null,
  correctAnswer: (r.correct_answer as string) ?? null,
  rubric: (r.rubric as string) ?? null,
  maxScore: r.max_score as number,
})

const attemptFromRow = (r: Record<string, unknown>): PracticeAttempt => ({
  id: r.id as string,
  practiceSetId: r.practice_set_id as string,
  status: r.status as PracticeAttempt['status'],
  totalScore: (r.total_score as number) ?? null,
  startedAt: r.started_at as string,
  completedAt: (r.completed_at as string) ?? null,
})

const answerFromRow = (r: Record<string, unknown>): PracticeAnswer => ({
  id: r.id as string,
  attemptId: r.attempt_id as string,
  questionId: r.question_id as string,
  userAnswer: r.user_answer as string,
  score: (r.score as number) ?? null,
  feedback: (r.feedback as string) ?? null,
  isCorrect: (r.is_correct as boolean) ?? null,
})

export async function listPracticeSets(subjectId?: string): Promise<PracticeSet[]> {
  let query = supabase.from('practice_sets').select('*').order('created_at', { ascending: false })
  if (subjectId) query = query.eq('subject_id', subjectId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(setFromRow)
}

export async function createPracticeSet(
  userId: string,
  subjectId: string,
  noteIds: string[],
  scope: PracticeScope,
  format: PracticeFormat,
): Promise<PracticeSet> {
  const { data, error } = await supabase
    .from('practice_sets')
    .insert({
      user_id: userId,
      subject_id: subjectId,
      note_ids: noteIds,
      scope,
      format,
      status: 'generating',
      title: format === 'quiz' ? 'Quiz' : 'Exam prep',
    })
    .select()
    .single()
  if (error) throw error

  const set = setFromRow(data)

  // Fire the generation edge function; the row's `status` is the source of
  // truth for the UI, so callers should poll/refetch rather than await this
  // for long — generation can take a few seconds.
  const { error: fnError } = await supabase.functions.invoke('generate-practice', {
    body: { practiceSetId: set.id },
  })
  if (fnError) throw fnError

  awardPracticeGenerated(userId, subjectId)
  return set
}

export async function getPracticeSet(id: string): Promise<PracticeSet> {
  const { data, error } = await supabase.from('practice_sets').select('*').eq('id', id).single()
  if (error) throw error
  return setFromRow(data)
}

export async function listQuestions(practiceSetId: string): Promise<PracticeQuestion[]> {
  const { data, error } = await supabase
    .from('practice_questions')
    .select('*')
    .eq('practice_set_id', practiceSetId)
    .order('order_index', { ascending: true })
  if (error) throw error
  return (data ?? []).map(questionFromRow)
}

export async function startAttempt(userId: string, practiceSetId: string): Promise<PracticeAttempt> {
  const { data, error } = await supabase
    .from('practice_attempts')
    .insert({ user_id: userId, practice_set_id: practiceSetId, status: 'in_progress' })
    .select()
    .single()
  if (error) throw error
  return attemptFromRow(data)
}

export async function saveAnswer(
  attemptId: string,
  questionId: string,
  userAnswer: string,
): Promise<void> {
  const { error } = await supabase
    .from('practice_answers')
    .upsert(
      { attempt_id: attemptId, question_id: questionId, user_answer: userAnswer },
      { onConflict: 'attempt_id,question_id' },
    )
  if (error) throw error
}

export async function submitAttempt(
  attemptId: string,
  userId?: string,
  subjectId?: string,
): Promise<number> {
  const { data, error } = await supabase.functions.invoke('grade-attempt', {
    body: { attemptId },
  })
  if (error) throw error
  const totalScore = data.totalScore as number
  if (userId && subjectId) awardPracticeGraded(userId, subjectId, totalScore)
  return totalScore
}

export async function getAttempt(id: string): Promise<PracticeAttempt> {
  const { data, error } = await supabase.from('practice_attempts').select('*').eq('id', id).single()
  if (error) throw error
  return attemptFromRow(data)
}

export async function listAnswers(attemptId: string): Promise<PracticeAnswer[]> {
  const { data, error } = await supabase
    .from('practice_answers')
    .select('*')
    .eq('attempt_id', attemptId)
  if (error) throw error
  return (data ?? []).map(answerFromRow)
}

function newShareToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export async function sharePracticeSet(id: string): Promise<string> {
  const token = newShareToken()
  const { error } = await supabase.from('practice_sets').update({ share_token: token }).eq('id', id)
  if (error) throw error
  return token
}

export async function unsharePracticeSet(id: string): Promise<void> {
  const { error } = await supabase.from('practice_sets').update({ share_token: null }).eq('id', id)
  if (error) throw error
}

export async function listAttempts(practiceSetId: string): Promise<PracticeAttempt[]> {
  const { data, error } = await supabase
    .from('practice_attempts')
    .select('*')
    .eq('practice_set_id', practiceSetId)
    .order('started_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(attemptFromRow)
}
