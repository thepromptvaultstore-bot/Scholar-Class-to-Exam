import type { NoteRow, SemesterRow, SubjectRow, NoteMaterialRow } from '../types/database'
import type { Note, Semester, Subject, NoteMaterial } from '../types/domain'

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
