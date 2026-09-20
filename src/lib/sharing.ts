// Client side of "share a note/practice set via a link" — reads go through
// the public `get-shared` edge function (no auth needed to view), writes
// (cloning a shared item into your own account) are normal authenticated
// inserts, since at that point it's just "create a note/practice set for
// me" with content copied from what the link returned.
import { supabase } from './supabaseClient'
import { awardNoteCaptured } from './gamification'
import type { Note } from '../types/domain'
import type { PracticeQuestion, PracticeSet } from '../types/practice'

export interface SharedNotePayload {
  title: string
  sessionDate: string
  content: string
  captureMode: string
}

export interface SharedQuestionPayload {
  orderIndex: number
  type: PracticeQuestion['type']
  prompt: string
  choices: string[] | null
  correctAnswer: string | null
  rubric: string | null
  maxScore: number
}

export interface SharedPracticeSetPayload {
  title: string
  format: 'quiz' | 'exam'
  questionCount: number
}

export type SharedContent =
  | { found: false }
  | { found: true; kind: 'note'; note: SharedNotePayload }
  | { found: true; kind: 'practice'; practiceSet: SharedPracticeSetPayload; questions: SharedQuestionPayload[] }

export async function getSharedContent(token: string, kind: 'note' | 'practice'): Promise<SharedContent> {
  const { data, error } = await supabase.functions.invoke('get-shared', { body: { token, kind } })
  if (error) throw error
  return data
}

export async function cloneSharedNote(
  userId: string,
  subjectId: string,
  shared: SharedNotePayload,
): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: userId,
      subject_id: subjectId,
      session_date: new Date().toISOString().slice(0, 10),
      title: `${shared.title} (shared)`,
      capture_mode: 'manual',
      content: shared.content,
      raw_transcript: null,
      audio_path: null,
      transcription_status: 'none',
      transcription_engine: null,
    })
    .select()
    .single()
  if (error) throw error
  awardNoteCaptured(userId, subjectId)
  return {
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
    shareToken: data.share_token,
    communityVisible: false,
    communityCourseLabel: null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export async function cloneSharedPracticeSet(
  userId: string,
  subjectId: string,
  shared: SharedPracticeSetPayload,
  questions: SharedQuestionPayload[],
): Promise<PracticeSet> {
  const { data: set, error: setError } = await supabase
    .from('practice_sets')
    .insert({
      user_id: userId,
      subject_id: subjectId,
      note_ids: [],
      title: `${shared.title} (shared)`,
      scope: 'multi',
      format: shared.format,
      status: 'ready',
    })
    .select()
    .single()
  if (setError) throw setError

  const rows = questions.map((q) => ({
    practice_set_id: set.id,
    order_index: q.orderIndex,
    type: q.type,
    prompt: q.prompt,
    choices: q.choices,
    correct_answer: q.correctAnswer,
    rubric: q.rubric,
    max_score: q.maxScore,
  }))
  if (rows.length > 0) {
    const { error: qError } = await supabase.from('practice_questions').insert(rows)
    if (qError) throw qError
  }

  return {
    id: set.id,
    subjectId: set.subject_id,
    noteIds: [],
    title: set.title,
    scope: set.scope,
    format: set.format,
    status: set.status,
    error: null,
    shareToken: null,
    createdAt: set.created_at,
  }
}
