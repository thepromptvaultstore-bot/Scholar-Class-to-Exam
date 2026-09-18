export type PresentationStatus = 'generating' | 'ready' | 'failed'

export interface Presentation {
  id: string
  subjectId: string
  noteIds: string[]
  topic: string
  status: PresentationStatus
  error: string | null
  createdAt: string
}

export interface Slide {
  id: string
  presentationId: string
  orderIndex: number
  title: string
  bullets: string[]
  speakerNotes: string
}
