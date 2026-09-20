import { supabase } from './supabaseClient'
import { semesterFromRow, subjectFromRow, noteFromRow, materialFromRow, profileFromRow } from './mappers'
import { awardNoteCaptured } from './gamification'
import type { Note, Semester, Subject, NoteMaterial, Profile } from '../types/domain'

// Every call assumes an authenticated session — RLS enforces that a user
// only ever sees their own rows, so no explicit user_id filters are needed
// on selects (they're still set on inserts).

export async function listSemesters(): Promise<Semester[]> {
  const { data, error } = await supabase
    .from('semesters')
    .select('*')
    .order('start_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(semesterFromRow)
}

export async function createSemester(userId: string, name: string): Promise<Semester> {
  const { data, error } = await supabase
    .from('semesters')
    .insert({ user_id: userId, name, is_active: true, start_date: null, end_date: null })
    .select()
    .single()
  if (error) throw error
  return semesterFromRow(data)
}

export async function renameSemester(id: string, name: string): Promise<Semester> {
  const { data, error } = await supabase
    .from('semesters')
    .update({ name })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return semesterFromRow(data)
}

// Cascades to that semester's subjects, notes, and materials (FK ON DELETE
// CASCADE) — the caller is responsible for confirming with the user first,
// since this is not reversible.
export async function deleteSemester(id: string): Promise<void> {
  const { error } = await supabase.from('semesters').delete().eq('id', id)
  if (error) throw error
}

export async function listSubjects(semesterId?: string): Promise<Subject[]> {
  let query = supabase.from('subjects').select('*').order('created_at', { ascending: true })
  if (semesterId) query = query.eq('semester_id', semesterId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(subjectFromRow)
}

export async function createSubject(
  userId: string,
  semesterId: string,
  name: string,
  color: string,
  professorName?: string,
): Promise<Subject> {
  const { data, error } = await supabase
    .from('subjects')
    .insert({
      user_id: userId,
      semester_id: semesterId,
      name,
      color,
      professor_name: professorName ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return subjectFromRow(data)
}

export async function updateSubject(
  id: string,
  patch: Partial<Pick<Subject, 'name' | 'professorName' | 'color'>>,
): Promise<Subject> {
  const dbPatch: Record<string, unknown> = {}
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.professorName !== undefined) dbPatch.professor_name = patch.professorName || null
  if (patch.color !== undefined) dbPatch.color = patch.color
  const { data, error } = await supabase.from('subjects').update(dbPatch).eq('id', id).select().single()
  if (error) throw error
  return subjectFromRow(data)
}

export async function deleteSubject(id: string): Promise<void> {
  const { error } = await supabase.from('subjects').delete().eq('id', id)
  if (error) throw error
}

export async function listNotes(subjectId?: string): Promise<Note[]> {
  let query = supabase.from('notes').select('*').order('session_date', { ascending: false })
  if (subjectId) query = query.eq('subject_id', subjectId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(noteFromRow)
}

export async function findNoteForSubjectAndDate(
  subjectId: string,
  sessionDate: string,
): Promise<Note | null> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('session_date', sessionDate)
    .maybeSingle()
  if (error) throw error
  return data ? noteFromRow(data) : null
}

export async function createNote(
  userId: string,
  subjectId: string,
  sessionDate: string,
  captureMode: Note['captureMode'],
): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: userId,
      subject_id: subjectId,
      session_date: sessionDate,
      title: `Class note — ${sessionDate}`,
      capture_mode: captureMode,
      content: '',
      raw_transcript: null,
      audio_path: null,
      transcription_status: captureMode === 'voice' ? 'pending' : 'none',
      transcription_engine: null,
    })
    .select()
    .single()
  if (error) throw error
  awardNoteCaptured(userId, subjectId)
  return noteFromRow(data)
}

export async function updateNote(
  id: string,
  patch: Partial<
    Pick<
      Note,
      | 'title'
      | 'content'
      | 'rawTranscript'
      | 'transcriptionStatus'
      | 'transcriptionEngine'
      | 'audioPath'
      | 'captureMode'
    >
  >,
): Promise<Note> {
  const dbPatch: Record<string, unknown> = {}
  if (patch.title !== undefined) dbPatch.title = patch.title
  if (patch.content !== undefined) dbPatch.content = patch.content
  if (patch.rawTranscript !== undefined) dbPatch.raw_transcript = patch.rawTranscript
  if (patch.transcriptionStatus !== undefined) dbPatch.transcription_status = patch.transcriptionStatus
  if (patch.transcriptionEngine !== undefined) dbPatch.transcription_engine = patch.transcriptionEngine
  if (patch.audioPath !== undefined) dbPatch.audio_path = patch.audioPath
  if (patch.captureMode !== undefined) dbPatch.capture_mode = patch.captureMode

  const { data, error } = await supabase.from('notes').update(dbPatch).eq('id', id).select().single()
  if (error) throw error
  return noteFromRow(data)
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}

// A short, URL-safe opaque token — not guessable, not tied to the note id
// (so revoking and re-sharing invalidates any link that's already gone out).
function newShareToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export async function shareNote(id: string): Promise<string> {
  const token = newShareToken()
  const { error } = await supabase.from('notes').update({ share_token: token }).eq('id', id)
  if (error) throw error
  return token
}

export async function unshareNote(id: string): Promise<void> {
  const { error } = await supabase.from('notes').update({ share_token: null }).eq('id', id)
  if (error) throw error
}

// Publishing to the course-notes community browser needs a working share
// link (the browse list's "open" action reuses the same /s/note/:token
// viewer as a private share), so this ensures one exists rather than
// requiring the student to have already shared the note manually first.
export async function publishNoteToCommunity(id: string, courseLabel: string): Promise<string> {
  const token = await shareNote(id)
  const { error } = await supabase
    .from('notes')
    .update({ community_visible: true, community_course_label: courseLabel })
    .eq('id', id)
  if (error) throw error
  return token
}

export async function unpublishNoteFromCommunity(id: string): Promise<void> {
  const { error } = await supabase.from('notes').update({ community_visible: false }).eq('id', id)
  if (error) throw error
}

export async function listMaterials(noteId: string): Promise<NoteMaterial[]> {
  const { data, error } = await supabase
    .from('note_materials')
    .select('*')
    .eq('note_id', noteId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(materialFromRow)
}

export async function attachMaterial(
  userId: string,
  noteId: string,
  file: File,
): Promise<NoteMaterial> {
  const path = `${userId}/${noteId}/${Date.now()}-${file.name}`
  const { error: uploadError } = await supabase.storage.from('note-materials').upload(path, file)
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('note_materials')
    .insert({
      user_id: userId,
      note_id: noteId,
      file_path: path,
      file_name: file.name,
      file_type: file.type || null,
    })
    .select()
    .single()
  if (error) throw error
  return materialFromRow(data)
}

export async function removeMaterial(material: NoteMaterial): Promise<void> {
  await supabase.storage.from('note-materials').remove([material.filePath])
  const { error } = await supabase.from('note_materials').delete().eq('id', material.id)
  if (error) throw error
}

export async function getMaterialUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('note-materials')
    .createSignedUrl(filePath, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

export async function uploadLectureAudio(userId: string, noteId: string, blob: Blob): Promise<string> {
  const path = `${userId}/${noteId}.webm`
  const { error } = await supabase.storage
    .from('lecture-audio')
    .upload(path, blob, { upsert: true, contentType: blob.type || 'audio/webm' })
  if (error) throw error
  return path
}

// --- Profile -----------------------------------------------------------------

export async function getProfile(userId: string, email: string | null): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) throw error
  return profileFromRow(data, email)
}

export async function updateProfile(
  userId: string,
  patch: Partial<
    Pick<
      Profile,
      | 'fullName'
      | 'university'
      | 'avatarUrl'
      | 'dailyGoalXp'
      | 'priorGpa'
      | 'priorCreditHours'
      | 'gradingSystem'
      | 'totalCreditsRequired'
      | 'streakActiveDaysMask'
    >
  >,
  // `profiles` has no email column (it lives on the auth user), so without
  // this the mapper defaulted it to null and every save — rename, avatar
  // upload, daily-goal change — silently wiped the email shown on the
  // profile page until the next full reload. Optional so existing callers
  // that don't have it handy don't break; they just keep the old gap.
  email: string | null = null,
): Promise<Profile> {
  const dbPatch: Record<string, string | number | null> = {}
  if (patch.fullName !== undefined) dbPatch.full_name = patch.fullName
  if (patch.university !== undefined) dbPatch.university = patch.university
  if (patch.avatarUrl !== undefined) dbPatch.avatar_url = patch.avatarUrl
  if (patch.dailyGoalXp !== undefined) dbPatch.daily_goal_xp = patch.dailyGoalXp
  if (patch.priorGpa !== undefined) dbPatch.prior_gpa = patch.priorGpa
  if (patch.priorCreditHours !== undefined) dbPatch.prior_credit_hours = patch.priorCreditHours
  if (patch.gradingSystem !== undefined) dbPatch.grading_system = patch.gradingSystem
  if (patch.totalCreditsRequired !== undefined) dbPatch.total_credits_required = patch.totalCreditsRequired
  if (patch.streakActiveDaysMask !== undefined) dbPatch.streak_active_days_mask = patch.streakActiveDaysMask

  const { data, error } = await supabase
    .from('profiles')
    .update(dbPatch)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return profileFromRow(data, email)
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${userId}/avatar.${ext}`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  // Cache-bust so the new photo shows immediately, since the path is stable.
  return `${data.publicUrl}?t=${Date.now()}`
}
