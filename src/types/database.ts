// Hand-written mirror of the Phase 1 schema (supabase/migrations/0001_init.sql).
// Once the real project exists, regenerate with:
//   npx supabase gen types typescript --project-id <ref> > src/types/database.ts

export type CaptureMode = 'manual' | 'voice' | 'photo'
export type TranscriptionStatus = 'none' | 'pending' | 'processing' | 'done' | 'failed'
export type SubscriptionTier = 'free' | 'pro'
export type GradingSystem = 'semester' | 'yearly'

export interface ProfileRow {
  id: string
  full_name: string | null
  university: string | null
  avatar_url: string | null
  friend_code: string | null
  streak_freeze_count: number
  daily_goal_xp: number
  league_tier: LeagueTier
  league_week_key: string | null
  subscription_tier: SubscriptionTier
  subscription_expires_at: string | null
  subscription_product_id: string | null
  subscription_purchase_token: string | null
  usage_month_key: string | null
  usage_practice_count: number
  usage_slides_count: number
  usage_scan_count: number
  usage_audio_count: number
  prior_gpa: number | null
  prior_credit_hours: number
  grading_system: GradingSystem
  total_credits_required: number | null
  created_at: string
}

export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

export interface FriendshipRow {
  id: string
  user_id: string
  friend_id: string
  created_at: string
}

export interface BadgeEarnedRow {
  id: string
  user_id: string
  badge_key: string
  earned_at: string
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
  share_token: string | null
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
      friendships: {
        Row: FriendshipRow
        Insert: Omit<FriendshipRow, 'id' | 'created_at'> & { id?: string }
        Update: Partial<FriendshipRow>
      }
      badges_earned: {
        Row: BadgeEarnedRow
        Insert: Omit<BadgeEarnedRow, 'id' | 'earned_at'> & { id?: string }
        Update: Partial<BadgeEarnedRow>
      }
    }
  }
}
