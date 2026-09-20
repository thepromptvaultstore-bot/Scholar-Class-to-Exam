import { supabase } from './supabaseClient'
import { DEFAULT_GRADE_SCALE, DEFAULT_YEARLY_SCALE } from '../types/grades'
import type { CourseGrade, GradeScaleEntry } from '../types/grades'
import type { GradingSystem } from '../types/database'

const scaleFromRow = (r: Record<string, unknown>): GradeScaleEntry => ({
  id: r.id as string,
  letter: r.letter as string,
  gpa: Number(r.gpa),
  minPercent: Number(r.min_percent),
})

const courseGradeFromRow = (r: Record<string, unknown>): CourseGrade => ({
  id: r.id as string,
  subjectId: r.subject_id as string,
  creditHours: Number(r.credit_hours),
  gradePercent: r.grade_percent === null ? null : Number(r.grade_percent),
  letterGrade: (r.letter_grade as string) ?? null,
})

export async function listGradeScale(): Promise<GradeScaleEntry[]> {
  const { data, error } = await supabase
    .from('grade_scale_entries')
    .select('*')
    .order('min_percent', { ascending: false })
  if (error) throw error
  return (data ?? []).map(scaleFromRow)
}

export async function resetToDefaultScale(
  userId: string,
  system: GradingSystem = 'semester',
): Promise<GradeScaleEntry[]> {
  const { error: deleteError } = await supabase
    .from('grade_scale_entries')
    .delete()
    .eq('user_id', userId)
  if (deleteError) throw deleteError

  const defaults = system === 'yearly' ? DEFAULT_YEARLY_SCALE : DEFAULT_GRADE_SCALE
  const { data, error } = await supabase
    .from('grade_scale_entries')
    .insert(defaults.map((e) => ({ user_id: userId, letter: e.letter, gpa: e.gpa, min_percent: e.minPercent })))
    .select()
  if (error) throw error
  return (data ?? []).map(scaleFromRow)
}

export async function addScaleEntry(
  userId: string,
  letter: string,
  gpa: number,
  minPercent: number,
): Promise<GradeScaleEntry> {
  const { data, error } = await supabase
    .from('grade_scale_entries')
    .insert({ user_id: userId, letter, gpa, min_percent: minPercent })
    .select()
    .single()
  if (error) throw error
  return scaleFromRow(data)
}

export async function deleteScaleEntry(id: string): Promise<void> {
  const { error } = await supabase.from('grade_scale_entries').delete().eq('id', id)
  if (error) throw error
}

export async function listCourseGrades(): Promise<CourseGrade[]> {
  const { data, error } = await supabase.from('course_grades').select('*')
  if (error) throw error
  return (data ?? []).map(courseGradeFromRow)
}

export async function upsertCourseGrade(
  userId: string,
  subjectId: string,
  creditHours: number,
  gradePercent: number | null,
  letterGrade: string | null,
): Promise<CourseGrade> {
  const { data, error } = await supabase
    .from('course_grades')
    .upsert(
      {
        user_id: userId,
        subject_id: subjectId,
        credit_hours: creditHours,
        grade_percent: gradePercent,
        letter_grade: letterGrade,
      },
      { onConflict: 'subject_id' },
    )
    .select()
    .single()
  if (error) throw error
  return courseGradeFromRow(data)
}

export async function deleteCourseGrade(id: string): Promise<void> {
  const { error } = await supabase.from('course_grades').delete().eq('id', id)
  if (error) throw error
}

// --- Pure GPA math (no network) -----------------------------------------------

export function letterForPercent(scale: GradeScaleEntry[], percent: number): string | null {
  const sorted = [...scale].sort((a, b) => b.minPercent - a.minPercent)
  const match = sorted.find((e) => percent >= e.minPercent)
  return match?.letter ?? null
}

export function gpaPointsForLetter(scale: GradeScaleEntry[], letter: string): number | null {
  const entry = scale.find((e) => e.letter.toLowerCase() === letter.toLowerCase())
  return entry ? entry.gpa : null
}

// Resolves a course grade to GPA points: an explicit letter wins, otherwise
// the percent is mapped through the scale.
export function gpaPointsForCourse(scale: GradeScaleEntry[], course: CourseGrade): number | null {
  if (course.letterGrade) return gpaPointsForLetter(scale, course.letterGrade)
  if (course.gradePercent !== null) {
    const letter = letterForPercent(scale, course.gradePercent)
    return letter ? gpaPointsForLetter(scale, letter) : null
  }
  return null
}

// `baseline` folds in a CGPA the student already had before tracking
// courses here (see profiles.prior_gpa/prior_credit_hours) — treated as a
// single pre-weighted entry so someone with a transcript full of past
// courses doesn't have to re-enter every one of them just to see an
// accurate running total.
export function computeGpa(
  scale: GradeScaleEntry[],
  courses: CourseGrade[],
  baseline?: { gpa: number | null; credits: number } | null,
): { gpa: number | null; totalCredits: number } {
  let qualityPoints = 0
  let totalCredits = 0
  if (baseline && baseline.gpa !== null && baseline.credits > 0) {
    qualityPoints += baseline.gpa * baseline.credits
    totalCredits += baseline.credits
  }
  for (const c of courses) {
    const points = gpaPointsForCourse(scale, c)
    if (points === null) continue
    qualityPoints += points * c.creditHours
    totalCredits += c.creditHours
  }
  return { gpa: totalCredits > 0 ? qualityPoints / totalCredits : null, totalCredits }
}

// The "yearly" aggregate-marks equivalent of computeGpa — a straight
// credit-weighted average of raw percentages rather than scale-mapped GPA
// points, since a Division/Class system grades on marks, not quality
// points. Letter/class overrides don't participate here (there's no
// percent to weight), matching how these programs are actually marked.
export function computeWeightedPercent(
  courses: CourseGrade[],
  baseline?: { percent: number | null; credits: number } | null,
): { percent: number | null; totalCredits: number } {
  let weighted = 0
  let totalCredits = 0
  if (baseline && baseline.percent !== null && baseline.credits > 0) {
    weighted += baseline.percent * baseline.credits
    totalCredits += baseline.credits
  }
  for (const c of courses) {
    if (c.gradePercent === null) continue
    weighted += c.gradePercent * c.creditHours
    totalCredits += c.creditHours
  }
  return { percent: totalCredits > 0 ? weighted / totalCredits : null, totalCredits }
}
