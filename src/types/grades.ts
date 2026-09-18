export interface GradeScaleEntry {
  id: string
  letter: string
  gpa: number
  minPercent: number
}

export interface CourseGrade {
  id: string
  subjectId: string
  creditHours: number
  gradePercent: number | null
  letterGrade: string | null
}

export const DEFAULT_GRADE_SCALE: Omit<GradeScaleEntry, 'id'>[] = [
  { letter: 'A', gpa: 4.0, minPercent: 93 },
  { letter: 'A-', gpa: 3.7, minPercent: 90 },
  { letter: 'B+', gpa: 3.3, minPercent: 87 },
  { letter: 'B', gpa: 3.0, minPercent: 83 },
  { letter: 'B-', gpa: 2.7, minPercent: 80 },
  { letter: 'C+', gpa: 2.3, minPercent: 77 },
  { letter: 'C', gpa: 2.0, minPercent: 73 },
  { letter: 'C-', gpa: 1.7, minPercent: 70 },
  { letter: 'D', gpa: 1.0, minPercent: 60 },
  { letter: 'F', gpa: 0.0, minPercent: 0 },
]
