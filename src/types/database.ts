// Hand-written mirror of the Phase 1 schema (supabase/migrations/0001_init.sql).
// Once the real project exists, regenerate with:
//   npx supabase gen types typescript --project-id <ref> > src/types/database.ts

export type CaptureMode = 'manual' | 'voice' | 'photo'
export type TranscriptionStatus = 'none' | 'pending' | 'processing' | 'done' | 'failed'

export interface ProfileRow {
  id: string
  full_name: string | null
  university: string | null
  avatar_url: string | null
  created_at: string
}

export interface SemesterRow {
  id: string
  user_id: string
  name: string
  start_date: string | null
  end_date: string | null
  is_active: boolean
  created_at: string
}

export interface SubjectRow {
  id: string
  user_id: string
  semester_id: string
  name: string
  professor_name: string | null
  color: string
  created_at: string
}

export interface NoteRow {
  id: string
  user_id: string
  subject_id: string
  session_date: string
  title: string
  capture_mode: CaptureMode
  content: string
  raw_transcript: string | null
  audio_path: string | null
  transcription_status: TranscriptionStatus
  transcription_engine: string | null
  created_at: string
  updated_at: string
}

export interface NoteMaterialRow {
  id: string
  user_id: string
  note_id: string
  file_path: string
  file_name: string
  file_type: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: ProfileRow; Insert: Partial<ProfileRow>; Update: Partial<ProfileRow> }
      semesters: {
        Row: SemesterRow
        Insert: Omit<SemesterRow, 'id' | 'created_at'> & { id?: string }
        Update: Partial<SemesterRow>
      }
      subjects: {
        Row: SubjectRow
        Insert: Omit<SubjectRow, 'id' | 'created_at'> & { id?: string }
        Update: Partial<SubjectRow>
      }
      notes: {
        Row: NoteRow
        Insert: Omit<NoteRow, 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<NoteRow>
      }
      note_materials: {
        Row: NoteMaterialRow
        Insert: Omit<NoteMaterialRow, 'id' | 'created_at'> & { id?: string }
        Update: Partial<NoteMaterialRow>
      }
    }
  }
}
