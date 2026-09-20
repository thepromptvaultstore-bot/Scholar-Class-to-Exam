import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import {
  createSemester,
  createSubject,
  getProfile,
  listSemesters,
  listSubjects,
  updateProfile,
} from '../lib/data'
import {
  addScaleEntry,
  computeGpa,
  computeWeightedPercent,
  deleteScaleEntry,
  letterForPercent,
  listCourseGrades,
  listGradeScale,
  resetToDefaultScale,
  upsertCourseGrade,
} from '../lib/grades'
import type { Profile, Semester, Subject } from '../types/domain'
import type { GradingSystem } from '../types/database'
import type { CourseGrade, GradeScaleEntry } from '../types/grades'

const GRADE_SUBJECT_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#06b6d4', '#4f46e5', '#64748b']

// Grades used to live as a second tab bundled into the Timetable page, which
// buried it behind a click and made it feel like a minor add-on rather than
// something a student would open on its own. It's its own top-level page
// (and nav tab) now, with its own data loading — it no longer depends on
// Schedule having already fetched semesters/subjects.
export default function GradesPage() {
  const { user } = useAuthStore()
  const userId = user?.id

  const [semesters, setSemesters] = useState<Semester[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [scale, setScale] = useState<GradeScaleEntry[]>([])
  const [courses, setCourses] = useState<CourseGrade[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showScaleEditor, setShowScaleEditor] = useState(false)
  const [newLetter, setNewLetter] = useState('')
  const [newGpa, setNewGpa] = useState('')
  const [newMinPercent, setNewMinPercent] = useState('')

  // Adding a past (or any untracked) course's grade right from this page —
  // it doesn't need to be a course you're taking notes for.
  const [showAddCourse, setShowAddCourse] = useState(false)
  const [addCourseSemesterId, setAddCourseSemesterId] = useState('')
  const [addCourseNewSemesterName, setAddCourseNewSemesterName] = useState('')
  const [addCourseName, setAddCourseName] = useState('')
  const [addCourseCredit, setAddCourseCredit] = useState('3')

  // A CGPA (or aggregate %, in yearly mode) the student already had before
  // tracking courses here, plus the degree's total credit requirement —
  // both one-time settings, entered once instead of re-adding every past
  // course or looking up "how many credits do I have left" by hand.
  const [priorValue, setPriorValue] = useState('')
  const [priorCredits, setPriorCredits] = useState('')
  const [requiredCredits, setRequiredCredits] = useState('')
  const [savingDegree, setSavingDegree] = useState(false)

  const reload = async () => {
    const [sem, subj, s, c, p] = await Promise.all([
      listSemesters(),
      listSubjects(),
      listGradeScale(),
      listCourseGrades(),
      userId ? getProfile(userId, null) : Promise.resolve(null),
    ])
    setSemesters(sem)
    setSubjects(subj)
    setScale(s)
    setCourses(c)
    if (p) {
      setProfile(p)
      setPriorValue(p.priorGpa !== null ? String(p.priorGpa) : '')
      setPriorCredits(p.priorCreditHours > 0 ? String(p.priorCreditHours) : '')
      setRequiredCredits(p.totalCreditsRequired !== null ? String(p.totalCreditsRequired) : '')
    }
  }

  useEffect(() => {
    reload()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your grades.'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const gradingSystem: GradingSystem = profile?.gradingSystem ?? 'semester'
  const isYearly = gradingSystem === 'yearly'

  const handleSetSystem = async (system: GradingSystem) => {
    if (!userId || system === gradingSystem) return
    setBusy(true)
    try {
      const updated = await updateProfile(userId, { gradingSystem: system }, null)
      setProfile(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not switch grading system.')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveDegreeSettings = async () => {
    if (!userId) return
    setSavingDegree(true)
    setError(null)
    try {
      const updated = await updateProfile(
        userId,
        {
          priorGpa: priorValue.trim() === '' ? null : Number(priorValue),
          priorCreditHours: priorCredits.trim() === '' ? 0 : Number(priorCredits),
          totalCreditsRequired: requiredCredits.trim() === '' ? null : Number(requiredCredits),
        },
        null,
      )
      setProfile(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your degree settings.')
    } finally {
      setSavingDegree(false)
    }
  }

  const handleResetScale = async () => {
    if (!userId) return
    setBusy(true)
    try {
      const s = await resetToDefaultScale(userId, gradingSystem)
      setScale(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the grading scale.')
    } finally {
      setBusy(false)
    }
  }

  const handleAddScaleEntry = async () => {
    if (!userId || !newLetter.trim() || !newMinPercent || (!isYearly && !newGpa)) return
    setBusy(true)
    try {
      await addScaleEntry(userId, newLetter.trim(), isYearly ? 0 : Number(newGpa), Number(newMinPercent))
      setNewLetter('')
      setNewGpa('')
      setNewMinPercent('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that grade.')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteScaleEntry = async (id: string) => {
    await deleteScaleEntry(id)
    await reload()
  }

  const handleAddCourse = async () => {
    if (!userId || !addCourseName.trim()) return
    const creatingNewSemester = addCourseSemesterId === '__new__'
    if (creatingNewSemester && !addCourseNewSemesterName.trim()) return
    if (!creatingNewSemester && !addCourseSemesterId) return
    setBusy(true)
    setError(null)
    try {
      const semesterId = creatingNewSemester
        ? (await createSemester(userId, addCourseNewSemesterName.trim())).id
        : addCourseSemesterId
      const color = GRADE_SUBJECT_COLORS[subjects.length % GRADE_SUBJECT_COLORS.length]
      const subject = await createSubject(userId, semesterId, addCourseName.trim(), color)
      // Seed the grade row with the credit hours entered here, rather than
      // silently discarding them in favor of the row's own 3-credit default.
      const credit = Number(addCourseCredit) || 3
      await upsertCourseGrade(userId, subject.id, credit, null, null)
      setAddCourseName('')
      setAddCourseCredit('3')
      setAddCourseNewSemesterName('')
      setAddCourseSemesterId('')
      setShowAddCourse(false)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that course.')
    } finally {
      setBusy(false)
    }
  }

  const courseFor = (subjectId: string) => courses.find((c) => c.subjectId === subjectId)

  const handleUpdateCourse = async (
    subjectId: string,
    field: 'creditHours' | 'gradePercent' | 'letterGrade',
    value: string,
  ) => {
    if (!userId) return
    const existing = courseFor(subjectId)
    const creditHours = field === 'creditHours' ? Number(value) || 0 : (existing?.creditHours ?? 3)
    const gradePercent =
      field === 'gradePercent' ? (value === '' ? null : Number(value)) : (existing?.gradePercent ?? null)
    const letterGrade =
      field === 'letterGrade' ? (value === '' ? null : value) : (existing?.letterGrade ?? null)
    try {
      await upsertCourseGrade(userId, subjectId, creditHours, gradePercent, letterGrade)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that grade.')
    }
  }

  const baseline = { gpa: profile?.priorGpa ?? null, credits: profile?.priorCreditHours ?? 0 }
  const { gpa, totalCredits } = computeGpa(scale, courses, baseline)
  const { percent, totalCredits: yearlyCredits } = computeWeightedPercent(courses, {
    percent: profile?.priorGpa ?? null,
    credits: profile?.priorCreditHours ?? 0,
  })
  const yearlyClass = percent !== null ? letterForPercent(scale, percent) : null
  const creditsCompleted = isYearly ? yearlyCredits : totalCredits
  const requiredNum = requiredCredits.trim() === '' ? null : Number(requiredCredits)
  const degreePct =
    requiredNum && requiredNum > 0 ? Math.min(100, Math.round((creditsCompleted / requiredNum) * 100)) : null

  const semesterGroups = useMemo(
    () =>
      semesters
        .map((sem) => ({
          semester: sem,
          subjects: subjects.filter((s) => s.semesterId === sem.id),
        }))
        .filter((g) => g.subjects.length > 0),
    [semesters, subjects],
  )
  const ungrouped = subjects.filter((s) => !semesters.some((sem) => sem.id === s.semesterId))

  return (
    <div className="flex flex-col gap-5 px-5 pt-6 pb-10">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Grades & GPA</h1>

      {error && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-500">{error}</p>}

      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <>
          <div className="flex gap-1.5 rounded-full bg-black/[0.03] p-1 dark:bg-white/[0.06]">
            {(['semester', 'yearly'] as GradingSystem[]).map((sys) => (
              <button
                key={sys}
                onClick={() => handleSetSystem(sys)}
                disabled={busy}
                className={`flex-1 rounded-full py-1.5 text-xs font-medium transition-colors ${
                  gradingSystem === sys
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-white'
                    : 'text-muted'
                }`}
              >
                {sys === 'semester' ? 'Semester (GPA)' : 'Yearly (%/Class)'}
              </button>
            ))}
          </div>

          <div
            className="rounded-2xl p-5 text-white"
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 55%, #0891b2 120%)',
              boxShadow: '0 12px 28px -10px rgba(37, 99, 235, 0.55)',
            }}
          >
            {isYearly ? (
              <>
                <p className="text-xs font-medium uppercase tracking-wide opacity-80">Overall average</p>
                <p className="mt-1 text-3xl font-semibold">{percent !== null ? `${percent.toFixed(1)}%` : '—'}</p>
                <p className="mt-1 text-xs opacity-80">
                  {yearlyClass ? `${yearlyClass} · ` : ''}
                  {yearlyCredits} credit hour{yearlyCredits === 1 ? '' : 's'} graded across{' '}
                  {semesterGroups.length} year{semesterGroups.length === 1 ? '' : 's'}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-medium uppercase tracking-wide opacity-80">Cumulative GPA / CGPA</p>
                <p className="mt-1 text-3xl font-semibold">{gpa !== null ? gpa.toFixed(2) : '—'}</p>
                <p className="mt-1 text-xs opacity-80">
                  {totalCredits} credit hour{totalCredits === 1 ? '' : 's'} graded across {semesterGroups.length}{' '}
                  semester{semesterGroups.length === 1 ? '' : 's'}
                </p>
              </>
            )}

            {requiredNum !== null && requiredNum > 0 && (
              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: `${degreePct}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs opacity-80">
                  {creditsCompleted} of {requiredNum} credits completed ({degreePct}%)
                </p>
              </div>
            )}
          </div>

          <div className="glass-card flex flex-col gap-2 rounded-2xl p-3">
            <p className="text-xs font-medium text-gray-900 dark:text-white">Your degree</p>
            <p className="text-xs text-muted">
              Already have a {isYearly ? 'running average' : 'CGPA'} from before you started using this app?
              Enter it once as a starting point — no need to re-add every past course. Add your total
              credit requirement too and this page tracks progress toward it, same as your university
              portal.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                value={priorValue}
                onChange={(e) => setPriorValue(e.target.value)}
                type="number"
                step={0.01}
                placeholder={isYearly ? 'Prior average %' : 'Prior CGPA'}
                className="input-field flex-1 !py-1.5 text-xs"
              />
              <input
                value={priorCredits}
                onChange={(e) => setPriorCredits(e.target.value)}
                type="number"
                min={0}
                step={0.5}
                placeholder="Prior credit hours"
                className="input-field flex-1 !py-1.5 text-xs"
              />
              <input
                value={requiredCredits}
                onChange={(e) => setRequiredCredits(e.target.value)}
                type="number"
                min={0}
                step={1}
                placeholder="Credits required (e.g. 120)"
                className="input-field flex-1 !py-1.5 text-xs"
              />
            </div>
            <button
              onClick={handleSaveDegreeSettings}
              disabled={savingDegree}
              className="btn-primary self-start !px-3 !py-1.5 text-xs"
            >
              {savingDegree ? 'Saving…' : 'Save'}
            </button>
          </div>

          <section>
            {!showAddCourse ? (
              <button
                onClick={() => setShowAddCourse(true)}
                className="btn-secondary w-full border-dashed !py-2"
              >
                <Plus size={14} /> Add a previous or current course's grade
              </button>
            ) : (
              <div className="glass-card flex flex-col gap-2 rounded-2xl p-3">
                <p className="text-xs text-muted">
                  Doesn't need to be a course you're taking notes for — great for logging grades from a
                  past semester.
                </p>
                <select
                  value={addCourseSemesterId}
                  onChange={(e) => setAddCourseSemesterId(e.target.value)}
                  className="input-field !py-1.5 text-xs"
                >
                  <option value="">Choose a semester…</option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value="__new__">+ New semester…</option>
                </select>
                {addCourseSemesterId === '__new__' && (
                  <input
                    value={addCourseNewSemesterName}
                    onChange={(e) => setAddCourseNewSemesterName(e.target.value)}
                    placeholder="e.g. Spring 2023, or Year 1"
                    className="input-field !py-1.5 text-xs"
                  />
                )}
                <div className="flex gap-2">
                  <input
                    value={addCourseName}
                    onChange={(e) => setAddCourseName(e.target.value)}
                    placeholder="Course name"
                    className="input-field flex-1 !py-1.5 text-xs"
                  />
                  <input
                    value={addCourseCredit}
                    onChange={(e) => setAddCourseCredit(e.target.value)}
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="Credits"
                    className="input-field w-20 !py-1.5 text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddCourse(false)}
                    className="btn-secondary flex-1 !py-1.5 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={
                      busy ||
                      !addCourseName.trim() ||
                      (addCourseSemesterId === '__new__'
                        ? !addCourseNewSemesterName.trim()
                        : !addCourseSemesterId)
                    }
                    onClick={handleAddCourse}
                    className="btn-primary flex-1 !py-1.5 text-xs"
                  >
                    {busy ? 'Adding…' : 'Add course'}
                  </button>
                </div>
              </div>
            )}
          </section>

          {subjects.length === 0 && !showAddCourse && (
            <p className="text-xs text-muted">
              No courses yet — add one above, or add a course on the Notes tab and it'll show up here.
            </p>
          )}

          {[...semesterGroups, ...(ungrouped.length > 0 ? [{ semester: null, subjects: ungrouped }] : [])].map(
            (group, gi) => {
              const groupCourses = courses.filter((c) => group.subjects.some((s) => s.id === c.subjectId))
              const { gpa: semGpa, totalCredits: semCredits } = computeGpa(scale, groupCourses)
              const { percent: groupPercent, totalCredits: groupPercentCredits } =
                computeWeightedPercent(groupCourses)
              const groupClass = groupPercent !== null ? letterForPercent(scale, groupPercent) : null
              return (
                <section key={group.semester?.id ?? `ungrouped-${gi}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {group.semester?.name ?? 'Other courses'}
                    </h2>
                    <span className="text-xs text-muted">
                      {isYearly
                        ? `${groupPercent !== null ? groupPercent.toFixed(1) + '%' : '—'}${groupClass ? ` · ${groupClass}` : ''} (${groupPercentCredits} cr)`
                        : `Semester GPA: ${semGpa !== null ? semGpa.toFixed(2) : '—'} (${semCredits} cr)`}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {group.subjects.map((s) => {
                      const c = courseFor(s.id)
                      return (
                        <div key={s.id} className="glass-card flex flex-wrap items-center gap-2 rounded-2xl p-3">
                          <span className="h-6 w-6 shrink-0 rounded-md" style={{ backgroundColor: s.color }} />
                          <p className="min-w-[7rem] flex-1 truncate text-sm font-medium text-gray-900 dark:text-white">
                            {s.name}
                          </p>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            defaultValue={c?.creditHours ?? 3}
                            onBlur={(e) => handleUpdateCourse(s.id, 'creditHours', e.target.value)}
                            className="input-field w-16 !py-1.5 text-xs"
                            title="Credit hours"
                          />
                          <input
                            type="number"
                            min={0}
                            max={100}
                            placeholder="%"
                            defaultValue={c?.gradePercent ?? ''}
                            onBlur={(e) => handleUpdateCourse(s.id, 'gradePercent', e.target.value)}
                            className="input-field w-16 !py-1.5 text-xs"
                            title="Grade percent"
                          />
                          {!isYearly && (
                            <select
                              defaultValue={c?.letterGrade ?? ''}
                              onChange={(e) => handleUpdateCourse(s.id, 'letterGrade', e.target.value)}
                              className="input-field w-20 !py-1.5 text-xs"
                              title="Letter grade (overrides %)"
                            >
                              <option value="">Letter</option>
                              {scale.map((e) => (
                                <option key={e.id} value={e.letter}>
                                  {e.letter}
                                </option>
                              ))}
                            </select>
                          )}
                          {isYearly && c?.gradePercent !== null && c?.gradePercent !== undefined && (
                            <span className="w-20 shrink-0 text-center text-xs text-muted">
                              {letterForPercent(scale, c.gradePercent) ?? '—'}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            },
          )}

          <section>
            <button onClick={() => setShowScaleEditor((v) => !v)} className="text-xs font-medium text-indigo-500">
              {showScaleEditor ? 'Hide' : 'Edit'} grading scale
            </button>
            {showScaleEditor && (
              <div className="mt-2 flex flex-col gap-2">
                {scale.length === 0 ? (
                  <button
                    disabled={busy}
                    onClick={handleResetScale}
                    className="btn-secondary w-full border-dashed"
                  >
                    {isYearly ? 'Use a starting Class/Division scale' : 'Use a standard 4.0 scale to start'}
                  </button>
                ) : (
                  <>
                    <div className="flex flex-col gap-1">
                      {scale.map((e) => (
                        <div
                          key={e.id}
                          className="glass-card flex items-center justify-between rounded-xl px-3 py-1.5 text-xs"
                        >
                          <span>
                            {e.letter} — {isYearly ? '' : `${e.gpa.toFixed(1)} GPA, `}
                            {e.minPercent}%+
                          </span>
                          <button onClick={() => handleDeleteScaleEntry(e.id)} className="text-muted hover:text-red-500">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button onClick={handleResetScale} disabled={busy} className="text-xs text-muted underline">
                      {isYearly ? 'Reset to starting Class/Division scale' : 'Reset to standard 4.0 scale'}
                    </button>
                  </>
                )}
                <div className="flex gap-2">
                  <input
                    value={newLetter}
                    onChange={(e) => setNewLetter(e.target.value)}
                    placeholder={isYearly ? 'Class name' : 'Letter'}
                    className="input-field w-20 !py-1.5 text-xs"
                  />
                  {!isYearly && (
                    <input
                      value={newGpa}
                      onChange={(e) => setNewGpa(e.target.value)}
                      type="number"
                      step={0.1}
                      placeholder="GPA"
                      className="input-field w-16 !py-1.5 text-xs"
                    />
                  )}
                  <input
                    value={newMinPercent}
                    onChange={(e) => setNewMinPercent(e.target.value)}
                    type="number"
                    placeholder="Min %"
                    className="input-field w-16 !py-1.5 text-xs"
                  />
                  <button
                    disabled={busy || !newLetter.trim() || !newMinPercent || (!isYearly && !newGpa)}
                    onClick={handleAddScaleEntry}
                    className="btn-primary flex-1 !py-1.5 text-xs"
                  >
                    Add grade
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
