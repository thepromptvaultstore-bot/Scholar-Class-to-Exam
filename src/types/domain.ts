// App-facing shapes, kept separate from the raw DB rows so the UI never has
// to think in snake_case.
import type { CaptureMode, GradingSystem, LeagueTier, SubscriptionTier, TranscriptionStatus } from './database'

export interface Profile {
  id: string
  fullName: string | null
  university: string | null
  avatarUrl: string | null
  friendCode: string | null
  streakFreezeCount: number
  dailyGoalXp: number
  leagueTier: LeagueTier
  leagueWeekKey: string | null
  subscriptionTier: SubscriptionTier
  subscriptionExpiresAt: string | null
  subscriptionProductId: string | null
  usageMonthKey: string | null
  usagePracticeCount: number
  usageSlidesCount: number
  usageScanCount: number
  // Legacy — superseded by the three audio fields below; lecture
  // transcription is metered in seconds now, not call count.
  usageAudioCount: number
  // Lifetime free-tier lecture-transcription allowance used, in seconds
  // (30 min total, once — see lib/entitlements.ts).
  audioFreeSecondsUsed: number
  // This month's Scholar Pro allowance used, in seconds (resets with
  // usageMonthKey, 12 hours/month).
  audioPeriodSecondsUsed: number
  // Purchased top-up balance, in seconds — never auto-resets. Always 0
  // until top-up purchases ship.
  audioBonusSeconds: number
  // A CGPA the student already had before tracking courses in this app —
  // folded into computeGpa's weighted average as a starting balance.
  priorGpa: number | null
  priorCreditHours: number
  gradingSystem: GradingSystem
  // Total credits the degree requires (e.g. 120) — lets the Grades page show
  // progress toward graduation the way most university portals already do.
  totalCreditsRequired: number | null
  // Which weekdays count toward the streak — see database.ts. Days outside
  // this set don't need activity to keep the streak alive, and freezes
  // aren't spent covering them.
  streakActiveDaysMask: number
  email: string | null
  createdAt: string
}

export interface Semester {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  isActive: boolean
}

export interface Subject {
  id: string
  semesterId: string
  name: string
  professorName: string | null
  color: string
}

export interface NoteMaterial {
  id: string
  noteId: string
  filePath: string
  fileName: string
  fileType: string | null
}

export interface Note {
  id: string
  subjectId: string
  sessionDate: string
  title: string
  captureMode: CaptureMode
  content: string
  rawTranscript: string | null
  audioPath: string | null
  transcriptionStatus: TranscriptionStatus
  transcriptionEngine: string | null
  shareToken: string | null
  createdAt: string
  updatedAt: string
}

export interface ClassScheduleEntry {
  id: string
  subjectId: string
  dayOfWeek: number // 0 = Sunday .. 6 = Saturday
  startTime: string // 'HH:MM' or 'HH:MM:SS'
  endTime: string
  location: string | null
}

// 'assignment' / 'exam' distinguish real deadlines (shown on the Planner
// page and Home's "Due soon" widget) from a plain one-off 'reminder' —
// purely a display/grouping hint, all three share the same due-date and
// notification mechanics.
export type ReminderKind = 'assignment' | 'exam' | 'reminder'

export interface Reminder {
  id: string
  subjectId: string | null
  title: string
  note: string | null
  remindAt: string
  kind: ReminderKind
  notified: boolean
  isDone: boolean
  createdAt: string
}
