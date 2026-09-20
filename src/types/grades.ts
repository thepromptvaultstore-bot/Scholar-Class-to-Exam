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

// A starter set for "yearly" (aggregate-marks) programs — the ones that
// grade a whole year on total percentage rather than a per-course GPA
// point. These bands are a common Commonwealth-style shape (used, with
// variations, across South Asia and beyond) meant purely as an editable
// starting point — every field here is just another grade_scale_entries
// row, so a student can rename or re-band these to match their exact
// university's rules. `gpa` is unused in yearly mode (percent is the
// number that matters) but kept at a sane 0-4 spread so the row still
// makes sense if someone switches back to semester mode.
export const DEFAULT_YEARLY_SCALE: Omit<GradeScaleEntry, 'id'>[] = [
  { letter: 'Distinction', gpa: 4.0, minPercent: 80 },
  { letter: 'First Class', gpa: 3.5, minPercent: 60 },
  { letter: 'Second Class', gpa: 2.5, minPercent: 45 },
  { letter: 'Third Class', gpa: 1.5, minPercent: 40 },
  { letter: 'Fail', gpa: 0.0, minPercent: 0 },
]
