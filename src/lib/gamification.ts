import { supabase } from './supabaseClient'
import type { LevelInfo, SubjectKnowledge, XpKind } from '../types/gamification'

// XP awarded per activity. Practice-graded XP additionally scales with score
// (see awardPracticeGraded), so a strong exam result earns more than a weak one.
export const XP_NOTE_CAPTURED = 10
export const XP_PRACTICE_GENERATED = 5
const XP_PER_LEVEL = 100

async function logXp(userId: string, kind: XpKind, amount: number, subjectId?: string | null) {
  // Best-effort: gamification should never block the primary action (saving
  // a note, generating practice) it's attached to.
  try {
    await supabase
      .from('xp_events')
      .insert({ user_id: userId, kind, amount, subject_id: subjectId || null })
  } catch {
    // ignore
  }
}

export const awardNoteCaptured = (userId: string, subjectId: string) =>
  logXp(userId, 'note_captured', XP_NOTE_CAPTURED, subjectId)

export const awardPracticeGenerated = (userId: string, subjectId: string) =>
  logXp(userId, 'practice_generated', XP_PRACTICE_GENERATED, subjectId)

// A graded attempt earns 1 XP per percentage point scored (so a perfect
// score earns 100, a 50% earns 50) — rewards doing well, not just doing it.
export const awardPracticeGraded = (userId: string, subjectId: string, scorePercent: number) =>
  logXp(userId, 'practice_graded', Math.round(scorePercent), subjectId)

export function levelFromXp(totalXp: number): LevelInfo {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1
  const xpIntoLevel = totalXp % XP_PER_LEVEL
  return { totalXp, level, xpIntoLevel, xpForNextLevel: XP_PER_LEVEL }
}

export async function getLevelInfo(): Promise<LevelInfo> {
  const { data, error } = await supabase.from('xp_events').select('amount')
  if (error) throw error
  const totalXp = (data ?? []).reduce((sum: number, r: { amount: number }) => sum + (r.amount ?? 0), 0)
  return levelFromXp(totalXp)
}

// Consecutive days (ending today or yesterday) with at least one XP-earning
// activity — a "study streak" like the plan describes.
export async function getStreakDays(): Promise<number> {
  const { data, error } = await supabase
    .from('xp_events')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error

  const dates = new Set(
    (data ?? []).map((r: { created_at: string }) => r.created_at.slice(0, 10)),
  )
  if (dates.size === 0) return 0

  const toISO = (d: Date) => d.toISOString().slice(0, 10)
  const today = new Date()
  let cursor = toISO(today)
  if (!dates.has(cursor)) {
    // Streak can still be "alive" if the last activity was yesterday.
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    cursor = toISO(yesterday)
    if (!dates.has(cursor)) return 0
  }

  let streak = 0
  const cursorDate = new Date(cursor + 'T00:00:00Z')
  while (dates.has(toISO(cursorDate))) {
    streak += 1
    cursorDate.setDate(cursorDate.getDate() - 1)
  }
  return streak
}

// Weighted-recent average score for a subject's graded practice attempts —
// more recent attempts count more, so improving pulls the score up faster
// than one old bad attempt drags it down.
export async function getSubjectKnowledge(subjectId: string): Promise<SubjectKnowledge> {
  const { data: sets, error: setsError } = await supabase
    .from('practice_sets')
    .select('id')
    .eq('subject_id', subjectId)
  if (setsError) throw setsError
  const setIds = (sets ?? []).map((s: { id: string }) => s.id)
  if (setIds.length === 0) return { subjectId, score: null, attemptCount: 0 }

  const { data: attempts, error: attemptsError } = await supabase
    .from('practice_attempts')
    .select('total_score, started_at')
    .in('practice_set_id', setIds)
    .eq('status', 'graded')
    .order('started_at', { ascending: false })
    .limit(10)
  if (attemptsError) throw attemptsError

  const scored = (attempts ?? []).filter(
    (a: { total_score: number | null }) => a.total_score !== null,
  ) as { total_score: number }[]
  if (scored.length === 0) return { subjectId, score: null, attemptCount: 0 }

  let weightedSum = 0
  let weightTotal = 0
  scored.forEach((a, i) => {
    const weight = 1 / (i + 1) // most recent (i=0) weighted highest
    weightedSum += a.total_score * weight
    weightTotal += weight
  })

  return { subjectId, score: Math.round(weightedSum / weightTotal), attemptCount: scored.length }
}

export async function getKnowledgeForSubjects(
  subjectIds: string[],
): Promise<Record<string, SubjectKnowledge>> {
  const entries = await Promise.all(subjectIds.map((id) => getSubjectKnowledge(id)))
  return Object.fromEntries(entries.map((e) => [e.subjectId, e]))
}
