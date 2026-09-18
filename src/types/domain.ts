// App-facing shapes, kept separate from the raw DB rows so the UI never has
// to think in snake_case.
import type { CaptureMode, TranscriptionStatus } from './database'

export interface Profile {
  id: string
  fullName: string | null
  university: string | null
  avatarUrl: string | null
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

export interface Reminder {
  id: string
  subjectId: string | null
  title: string
  note: string | null
  remindAt: string
  notified: boolean
  isDone: boolean
  createdAt: string
}
