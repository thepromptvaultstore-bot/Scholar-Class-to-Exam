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
  subscriptionTier: r.subscription_tier,
  subscriptionExpiresAt: r.subscription_expires_at,
  subscriptionProductId: r.subscription_product_id,
  usageMonthKey: r.usage_month_key,
  usagePracticeCount: r.usage_practice_count,
  usageSlidesCount: r.usage_slides_count,
  usageScanCount: r.usage_scan_count,
  usageAudioCount: r.usage_audio_count,
  audioFreeSecondsUsed: Number(r.audio_free_seconds_used ?? 0),
  audioPeriodSecondsUsed: Number(r.audio_period_seconds_used ?? 0),
  audioBonusSeconds: Number(r.audio_bonus_seconds ?? 0),
  priorGpa: r.prior_gpa === null ? null : Number(r.prior_gpa),
  priorCreditHours: Number(r.prior_credit_hours),
  gradingSystem: r.grading_system,
  totalCreditsRequired: r.total_credits_required === null ? null : Number(r.total_credits_required),
  streakActiveDaysMask: r.streak_active_days_mask,
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
  communityVisible: r.community_visible,
  communityCourseLabel: r.community_course_label,
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
