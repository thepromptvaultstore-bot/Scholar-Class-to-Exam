import type { NoteRow, SemesterRow, SubjectRow, NoteMaterialRow, ProfileRow } from '../types/database'
import type { Note, Semester, Subject, NoteMaterial, Profile } from '../types/domain'

export const profileFromRow = (r: ProfileRow, email: string | null = null): Profile => ({
  id: r.id,
  fullName: r.full_name,
  university: r.university,
  avatarUrl: r.avatar_url,
  friendCode: r.friend_code,
  streakFreezeCount: r.streak_freeze_count,
  dailyGoalXp: r.daily_goal_xp,
  leagueTier: r.league_tier,
  leagueWeekKey: r.league_week_key,
  email,
  createdAt: r.created_at,
})

export const semesterFromRow = (r: SemesterRow): Semester => ({
  id: r.id,
  name: r.name,
  startDate: r.start_date,
  endDate: r.end_date,
  isActive: r.is_active,
})

export const subjectFromRow = (r: SubjectRow): Subject => ({
  id: r.id,
  semesterId: r.semester_id,
  name: r.name,
  professorName: r.professor_name,
  color: r.color,
})

export const noteFromRow = (r: NoteRow): Note => ({
  id: r.id,
  subjectId: r.subject_id,
  sessionDate: r.session_date,
  title: r.title,
  captureMode: r.capture_mode,
  content: r.content,
  rawTranscript: r.raw_transcript,
  audioPath: r.audio_path,
  transcriptionStatus: r.transcription_status,
  transcriptionEngine: r.transcription_engine,
  shareToken: r.share_token,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export const materialFromRow = (r: NoteMaterialRow): NoteMaterial => ({
  id: r.id,
  noteId: r.note_id,
  filePath: r.file_path,
  fileName: r.file_name,
  fileType: r.file_type,
})

