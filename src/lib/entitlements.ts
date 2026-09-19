// Client-side mirror of supabase/functions/_shared/entitlements.ts — same
// limits, same monthly-key logic, so the UI can show "3 of 5 left this
// month" and disable a button *before* the user taps it and gets a 402 back.
// The edge functions are still the real enforcement (a modified client can
// never bypass them); this file only ever informs the display.
import type { Profile } from '../types/domain'

export const FREE_LIMITS = {
  practice: 5,
  slides: 5,
  scans: 5,
  audio: 5,
} as const

export type MeteredFeature = keyof typeof FREE_LIMITS

const USAGE_KEY: Record<MeteredFeature, keyof Profile> = {
  practice: 'usagePracticeCount',
  slides: 'usageSlidesCount',
  scans: 'usageScanCount',
  audio: 'usageAudioCount',
}

export function currentMonthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function isPro(profile: Pick<Profile, 'subscriptionTier' | 'subscriptionExpiresAt'>): boolean {
  if (profile.subscriptionTier !== 'pro') return false
  if (!profile.subscriptionExpiresAt) return true
  return new Date(profile.subscriptionExpiresAt).getTime() > Date.now()
}

// Usage used so far THIS month for `feature` — 0 if the stored counter is
// from a previous month (mirrors the server's lazy reset without needing a
// write, since this is read-only display).
export function usedThisMonth(profile: Profile, feature: MeteredFeature): number {
  if (profile.usageMonthKey !== currentMonthKey()) return 0
  return Number(profile[USAGE_KEY[feature]] ?? 0)
}

export function remaining(profile: Profile, feature: MeteredFeature): number {
  if (isPro(profile)) return Infinity
  return Math.max(0, FREE_LIMITS[feature] - usedThisMonth(profile, feature))
}

export function canUseFeature(profile: Profile, feature: MeteredFeature): boolean {
  return isPro(profile) || usedThisMonth(profile, feature) < FREE_LIMITS[feature]
}

export const FEATURE_LABEL: Record<MeteredFeature, string> = {
  practice: 'Practice sets',
  slides: 'Slide decks',
  scans: 'Page scans',
  audio: 'Lecture transcriptions',
}

// A gated edge function returns 402 + { error, code: 'limit_reached' } when a
// free user is over their monthly cap (see supabase/functions/_shared/
// entitlements.ts). supabase-js surfaces a non-2xx response as a generic
// FunctionsHttpError whose real body lives on `error.context` (a Response,
// readable only once) rather than `error.message` — this reads it out so
// callers can tell "hit the free limit" apart from a real failure and route
// to /upgrade instead of a generic error banner.
// Thrown by the data-layer wrappers (practice.ts, slides.ts, transcription.ts)
// in place of the raw Supabase FunctionsHttpError once it's been identified
// as a limit-reached 402, so page components can `catch` and `instanceof`
// check without re-parsing the response body themselves.
export class LimitReachedError extends Error {
  constructor(message = "You've reached this month's free limit for this feature.") {
    super(message)
    this.name = 'LimitReachedError'
  }
}

export async function isLimitReachedError(error: unknown): Promise<boolean> {
  const context = (error as { context?: Response } | null)?.context
  if (!context || typeof context.json !== 'function') return false
  try {
    const body = await context.clone().json()
    return body?.code === 'limit_reached'
  } catch {
    return false
  }
}
