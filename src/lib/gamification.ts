import { supabase } from './supabaseClient'
import type { LevelInfo, SubjectKnowledge, XpKind, BadgeDef, BadgeStats, EarnedBadge } from '../types/gamification'
import { BADGE_CATALOG, FREEZE_GRANTING_BADGES } from '../types/gamification'
import type { LeagueTier } from '../types/database'
import { fetchFriendsBoard } from './friends'

// XP awarded per activity. Practice-graded XP additionally scales with score
// (see awardPracticeGraded), so a strong exam result earns more than a weak one.
export const XP_NOTE_CAPTURED = 10
export const XP_PRACTICE_GENERATED = 5
export const XP_CLASS_ATTENDED = 8
const XP_PER_LEVEL = 100

async function logXp(userId: string, kind: XpKind, amount: number, subjectId?: string | null) {
  // Best-effort: gamification should never block the primary action (saving
  // a note, generating practice) it's attached to.
  try {
    await supabase
      .from('xp_events')
      .insert({ user_id: userId, kind, amount, subject_id: subjectId || null })
  } catch {
    // ignore
  }
}

export const awardNoteCaptured = (userId: string, subjectId: string) =>
  logXp(userId, 'note_captured', XP_NOTE_CAPTURED, subjectId)

export const awardPracticeGenerated = (userId: string, subjectId: string) =>
  logXp(userId, 'practice_generated', XP_PRACTICE_GENERATED, subjectId)

export const awardClassAttended = (userId: string, subjectId: string) =>
  logXp(userId, 'class_attended', XP_CLASS_ATTENDED, subjectId)

// A graded attempt earns 1 XP per percentage point scored (so a perfect
// score earns 100, a 50% earns 50) — rewards doing well, not just doing it.
export const awardPracticeGraded = (userId: string, subjectId: string, scorePercent: number) =>
  logXp(userId, 'practice_graded', Math.round(scorePercent), subjectId)

export function levelFromXp(totalXp: number): LevelInfo {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1
  const xpIntoLevel = totalXp % XP_PER_LEVEL
  return { totalXp, level, xpIntoLevel, xpForNextLevel: XP_PER_LEVEL }
}

export async function getLevelInfo(): Promise<LevelInfo> {
  const { data, error } = await supabase.from('xp_events').select('amount')
  if (error) throw error
  const totalXp = (data ?? []).reduce((sum: number, r: { amount: number }) => sum + (r.amount ?? 0), 0)
  return levelFromXp(totalXp)
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Sum of XP logged today (UTC calendar day) — what the daily-goal ring on
// Home compares against the user's chosen goal.
export async function getTodayXp(): Promise<number> {
  const { data, error } = await supabase
    .from('xp_events')
    .select('amount, created_at')
    .gte('created_at', `${todayISO()}T00:00:00.000Z`)
  if (error) throw error
  return (data ?? []).reduce((sum: number, r: { amount: number }) => sum + (r.amount ?? 0), 0)
}

// Consecutive days (ending today or yesterday) with at least one XP-earning
// activity, OR a date a streak freeze covered — a "study streak" like the
// plan describes, with Duolingo-style freeze protection folded in.
export async function getStreakDays(): Promise<number> {
  const [eventsRes, freezeRes] = await Promise.all([
    supabase.from('xp_events').select('created_at').order('created_at', { ascending: false }).limit(500),
    supabase.from('streak_freeze_log').select('covered_date').order('covered_date', { ascending: false }).limit(50),
  ])
  if (eventsRes.error) throw eventsRes.error
  if (freezeRes.error) throw freezeRes.error

  const dates = new Set(
    (eventsRes.data ?? []).map((r: { created_at: string }) => r.created_at.slice(0, 10)),
  )
  for (const r of freezeRes.data ?? []) dates.add((r as { covered_date: string }).covered_date)
  if (dates.size === 0) return 0

  const toISO = (d: Date) => d.toISOString().slice(0, 10)
  const today = new Date()
  let cursor = toISO(today)
  if (!dates.has(cursor)) {
    // Streak can still be "alive" if the last activity was yesterday.
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    cursor = toISO(yesterday)
    if (!dates.has(cursor)) return 0
  }

  let streak = 0
  const cursorDate = new Date(cursor + 'T00:00:00Z')
  while (dates.has(toISO(cursorDate))) {
    streak += 1
    cursorDate.setDate(cursorDate.getDate() - 1)
  }
  return streak
}

// Best-effort, called once per app load. If exactly one day was missed
// (activity two days ago, nothing yesterday) and a freeze is available and
// hasn't already been spent on that date, auto-covers it so the streak
// doesn't reset — same as Duolingo's streak freeze, minus the shop: freezes
// are earned back only via streak-milestone badges (see checkAndAwardBadges).
export async function applyStreakFreezeIfNeeded(userId: string): Promise<void> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('streak_freeze_count')
      .eq('id', userId)
      .single()
    if (profileError || !profile || profile.streak_freeze_count <= 0) return

    const { data, error } = await supabase
      .from('xp_events')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) throw error
    const dates = new Set((data ?? []).map((r: { created_at: string }) => r.created_at.slice(0, 10)))

    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const twoDaysAgo = new Date(today)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const toISO = (d: Date) => d.toISOString().slice(0, 10)

    const missedYesterday = !dates.has(toISO(yesterday))
    const activeTwoDaysAgo = dates.has(toISO(twoDaysAgo))
    if (!missedYesterday || !activeTwoDaysAgo) return

    const { error: insertError } = await supabase
      .from('streak_freeze_log')
      .insert({ user_id: userId, covered_date: toISO(yesterday) })
    if (insertError) {
      // Unique-constraint hit means this date was already covered — fine.
      return
    }
    await supabase
      .from('profiles')
      .update({ streak_freeze_count: profile.streak_freeze_count - 1 })
      .eq('id', userId)
  } catch {
    // Gamification should never block anything it's attached to.
  }
}

// Weighted-recent average score for a subject's graded practice attempts —
// more recent attempts count more, so improving pulls the score up faster
// than one old bad attempt drags it down.
export async function getSubjectKnowledge(subjectId: string): Promise<SubjectKnowledge> {
  const { data: sets, error: setsError } = await supabase
    .from('practice_sets')
    .select('id')
    .eq('subject_id', subjectId)
  if (setsError) throw setsError
  const setIds = (sets ?? []).map((s: { id: string }) => s.id)
  if (setIds.length === 0) return { subjectId, score: null, attemptCount: 0 }

  const { data: attempts, error: attemptsError } = await supabase
    .from('practice_attempts')
    .select('total_score, started_at')
    .in('practice_set_id', setIds)
    .eq('status', 'graded')
    .order('started_at', { ascending: false })
    .limit(10)
  if (attemptsError) throw attemptsError

  const scored = (attempts ?? []).filter(
    (a: { total_score: number | null }) => a.total_score !== null,
  ) as { total_score: number }[]
  if (scored.length === 0) return { subjectId, score: null, attemptCount: 0 }

  let weightedSum = 0
  let weightTotal = 0
  scored.forEach((a, i) => {
    const weight = 1 / (i + 1) // most recent (i=0) weighted highest
    weightedSum += a.total_score * weight
    weightTotal += weight
  })

  return { subjectId, score: Math.round(weightedSum / weightTotal), attemptCount: scored.length }
}

export async function getKnowledgeForSubjects(
  subjectIds: string[],
): Promise<Record<string, SubjectKnowledge>> {
  const entries = await Promise.all(subjectIds.map((id) => getSubjectKnowledge(id)))
  return Object.fromEntries(entries.map((e) => [e.subjectId, e]))
}

// --- Badges ------------------------------------------------------------------

export async function listEarnedBadges(): Promise<EarnedBadge[]> {
  const { data, error } = await supabase
    .from('badges_earned')
    .select('badge_key, earned_at')
    .order('earned_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r: { badge_key: string; earned_at: string }) => ({
    key: r.badge_key,
    earnedAt: r.earned_at,
  }))
}

const MAX_STREAK_FREEZES = 2

// Best-effort, called once per app load. Computes the user's current stats,
// compares against the badge catalog, and inserts any newly-qualifying
// badges (the unique constraint on badges_earned makes this safe to call
// repeatedly). Returns the badges newly earned this call, for a toast.
export async function checkAndAwardBadges(userId: string): Promise<BadgeDef[]> {
  try {
    const [level, streakDays, alreadyEarned, notesRes, practiceRes, attemptsRes, freezeProfileRes] =
      await Promise.all([
        getLevelInfo(),
        getStreakDays(),
        listEarnedBadges(),
        supabase.from('notes').select('id', { count: 'exact', head: true }),
        supabase.from('practice_sets').select('id', { count: 'exact', head: true }),
        supabase.from('practice_attempts').select('total_score').eq('status', 'graded'),
        supabase.from('profiles').select('streak_freeze_count').eq('id', userId).single(),
      ])

    const stats: BadgeStats = {
      level: level.level,
      streakDays,
      noteCount: notesRes.count ?? 0,
      practiceGeneratedCount: practiceRes.count ?? 0,
      perfectScoreCount: (attemptsRes.data ?? []).filter(
        (a: { total_score: number | null }) => a.total_score === 100,
      ).length,
    }

    const earnedKeys = new Set(alreadyEarned.map((b) => b.key))
    const newlyEarned = BADGE_CATALOG.filter((b) => !earnedKeys.has(b.key) && b.isEarned(stats))
    if (newlyEarned.length === 0) return []

    const { error: insertError } = await supabase
      .from('badges_earned')
      .insert(newlyEarned.map((b) => ({ user_id: userId, badge_key: b.key })))
    if (insertError) return []

    const freezesToGrant = newlyEarned.filter((b) => FREEZE_GRANTING_BADGES.has(b.key)).length
    if (freezesToGrant > 0 && !freezeProfileRes.error && freezeProfileRes.data) {
      const next = Math.min(MAX_STREAK_FREEZES, freezeProfileRes.data.streak_freeze_count + freezesToGrant)
      await supabase.from('profiles').update({ streak_freeze_count: next }).eq('id', userId)
    }

    return newlyEarned
  } catch {
    return []
  }
}

// --- Weekly friends league ---------------------------------------------------

function mondayOfThisWeekUTC(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = (day + 6) % 7
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff))
  return monday.toISOString().slice(0, 10)
}

// Best-effort, called once per app load. Advances the user's league tier
// based on how they ranked among friends last week: top third promotes,
// bottom third demotes, the rest holds — same shape as Duolingo's leagues,
// scoped to friends since the app's user base is too small for a
// meaningful global pool right now.
export async function checkWeeklyLeagueRollover(
  userId: string,
  currentTier: LeagueTier,
  currentWeekKey: string | null,
): Promise<LeagueTier | null> {
  try {
    const thisWeek = mondayOfThisWeekUTC()
    if (currentWeekKey === thisWeek) return null // already processed

    if (!currentWeekKey) {
      // First time seeing this user — just stamp the current week, no
      // promotion/demotion without a prior week to judge.
      await supabase.from('profiles').update({ league_week_key: thisWeek }).eq('id', userId)
      return null
    }

    const board = await fetchFriendsBoard(userId, 1) // last week
    const standings = [
      { id: userId, weeklyXp: board.self.weeklyXp },
      ...board.friends.map((f) => ({ id: f.id, weeklyXp: f.weeklyXp })),
    ].sort((a, b) => b.weeklyXp - a.weeklyXp)

    let newTier = currentTier
    if (standings.length > 1) {
      const rank = standings.findIndex((s) => s.id === userId)
      const third = Math.ceil(standings.length / 3)
      if (rank < third) newTier = nextTier(currentTier)
      else if (rank >= standings.length - third) newTier = prevTier(currentTier)
    }

    await supabase
      .from('profiles')
      .update({ league_week_key: thisWeek, league_tier: newTier })
      .eq('id', userId)
    return newTier !== currentTier ? newTier : null
  } catch {
    return null
  }
}

const TIER_ORDER: LeagueTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond']
function nextTier(t: LeagueTier): LeagueTier {
  return TIER_ORDER[Math.min(TIER_ORDER.indexOf(t) + 1, TIER_ORDER.length - 1)]
}
function prevTier(t: LeagueTier): LeagueTier {
  return TIER_ORDER[Math.max(TIER_ORDER.indexOf(t) - 1, 0)]
}

