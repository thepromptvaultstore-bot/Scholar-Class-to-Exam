export type PracticeFormat = 'quiz' | 'exam'
export type PracticeScope = 'single' | 'multi' | 'course'
export type PracticeSetStatus = 'generating' | 'ready' | 'failed'
export type QuestionType = 'mcq' | 'true_false' | 'fill_blank' | 'short_answer' | 'essay'
export type AttemptStatus = 'in_progress' | 'grading' | 'graded' | 'failed'

export interface PracticeSet {
  id: string
  subjectId: string
  noteIds: string[]
  title: string
  scope: PracticeScope
  format: PracticeFormat
  status: PracticeSetStatus
  error: string | null
  shareToken: string | null
  createdAt: string
}

export interface PracticeQuestion {
  id: string
  practiceSetId: string
  orderIndex: number
  type: QuestionType
  prompt: string
  choices: string[] | null
  correctAnswer: string | null
  rubric: string | null
  maxScore: number
}

export interface PracticeAttempt {
  id: string
  practiceSetId: string
  status: AttemptStatus
  totalScore: number | null
  startedAt: string
  completedAt: string | null
}

export interface PracticeAnswer {
  id: string
  attemptId: string
  questionId: string
  userAnswer: string
  score: number | null
  feedback: string | null
  isCorrect: boolean | null
}
