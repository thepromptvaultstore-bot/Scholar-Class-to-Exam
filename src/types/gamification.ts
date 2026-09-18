export type XpKind = 'note_captured' | 'practice_generated' | 'practice_graded' | 'class_attended'

export interface XpEvent {
  id: string
  subjectId: string | null
  kind: XpKind
  amount: number
  createdAt: string
}

export interface LevelInfo {
  totalXp: number
  level: number
  xpIntoLevel: number
  xpForNextLevel: number
}

export interface SubjectKnowledge {
  subjectId: string
  score: number | null // 0-100, weighted recent average of graded attempts; null = no data yet
  attemptCount: number
}
