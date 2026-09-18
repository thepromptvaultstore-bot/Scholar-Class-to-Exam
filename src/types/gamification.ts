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

// --- Daily goal ----------------------------------------------------------------

export type DailyGoalTier = 'casual' | 'regular' | 'serious' | 'intense'

export interface DailyGoalPreset {
  tier: DailyGoalTier
  label: string
  xp: number
}

export const DAILY_GOAL_PRESETS: DailyGoalPreset[] = [
  { tier: 'casual', label: 'Casual', xp: 20 },
  { tier: 'regular', label: 'Regular', xp: 30 },
  { tier: 'serious', label: 'Serious', xp: 50 },
  { tier: 'intense', label: 'Intense', xp: 80 },
]

// --- Badges ----------------------------------------------------------------------

export interface BadgeStats {
  level: number
  streakDays: number
  noteCount: number
  practiceGeneratedCount: number
  perfectScoreCount: number
}

export interface BadgeDef {
  key: string
  label: string
  description: string
  icon: 'flame' | 'sparkles' | 'book' | 'target' | 'trophy'
  isEarned: (s: BadgeStats) => boolean
}

export const BADGE_CATALOG: BadgeDef[] = [
  { key: 'streak_3', label: 'Warming Up', description: '3-day streak', icon: 'flame', isEarned: (s) => s.streakDays >= 3 },
  { key: 'streak_7', label: 'Week One', description: '7-day streak', icon: 'flame', isEarned: (s) => s.streakDays >= 7 },
  { key: 'streak_30', label: 'On a Roll', description: '30-day streak', icon: 'flame', isEarned: (s) => s.streakDays >= 30 },
  { key: 'streak_100', label: 'Unstoppable', description: '100-day streak', icon: 'flame', isEarned: (s) => s.streakDays >= 100 },
  { key: 'level_5', label: 'Rising Scholar', description: 'Reach level 5', icon: 'sparkles', isEarned: (s) => s.level >= 5 },
  { key: 'level_10', label: 'Dedicated Scholar', description: 'Reach level 10', icon: 'sparkles', isEarned: (s) => s.level >= 10 },
  { key: 'level_25', label: 'Master Scholar', description: 'Reach level 25', icon: 'sparkles', isEarned: (s) => s.level >= 25 },
  { key: 'notes_10', label: 'Note Taker', description: 'Capture 10 notes', icon: 'book', isEarned: (s) => s.noteCount >= 10 },
  { key: 'notes_50', label: 'Archivist', description: 'Capture 50 notes', icon: 'book', isEarned: (s) => s.noteCount >= 50 },
  { key: 'practice_10', label: 'Quiz Regular', description: 'Generate 10 practice sets', icon: 'target', isEarned: (s) => s.practiceGeneratedCount >= 10 },
  { key: 'perfect_1', label: 'Perfectionist', description: 'Score 100% on a practice set', icon: 'trophy', isEarned: (s) => s.perfectScoreCount >= 1 },
  { key: 'perfect_5', label: 'Flawless', description: 'Score 100% five times', icon: 'trophy', isEarned: (s) => s.perfectScoreCount >= 5 },
]

// Streak-length badges that also grant a bonus streak freeze (capped) — the
// only way to earn freezes back, since there's no gem/purchase economy.
export const FREEZE_GRANTING_BADGES = new Set(['streak_7', 'streak_30', 'streak_100'])

export interface EarnedBadge {
  key: string
  earnedAt: string
}

// --- Friends & weekly league -----------------------------------------------------

export interface Friend {
  id: string
  fullName: string | null
  avatarUrl: string | null
  weeklyXp: number
  totalXp: number
}

export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

export interface LeagueTierInfo {
  tier: LeagueTier
  label: string
  color: string
}

export const LEAGUE_TIERS: LeagueTierInfo[] = [
  { tier: 'bronze', label: 'Bronze League', color: '#b45309' },
  { tier: 'silver', label: 'Silver League', color: '#6b7280' },
  { tier: 'gold', label: 'Gold League', color: '#d97706' },
  { tier: 'platinum', label: 'Platinum League', color: '#0891b2' },
  { tier: 'diamond', label: 'Diamond League', color: '#4f46e5' },
]

export function nextLeagueTier(tier: LeagueTier): LeagueTier {
  const i = LEAGUE_TIERS.findIndex((t) => t.tier === tier)
  return LEAGUE_TIERS[Math.min(i + 1, LEAGUE_TIERS.length - 1)].tier
}

export function prevLeagueTier(tier: LeagueTier): LeagueTier {
  const i = LEAGUE_TIERS.findIndex((t) => t.tier === tier)
  return LEAGUE_TIERS[Math.max(i - 1, 0)].tier
}

