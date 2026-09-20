// Client-side mirror of supabase/functions/_shared/entitlements.ts — same
// limits and rules, so the UI can show remaining allowance and disable a
// button *before* the user taps it and gets a 402 back. The edge functions
// are still the real enforcement (a modified client can never bypass them);
// this file only ever informs the display.
import type { Profile } from '../types/domain'

// practice / slides / scans: a ONE-TIME lifetime allowance for free
// accounts, not monthly — see the server file for why.
export const FREE_LIMITS = {
  practice: 5,
  slides: 5,
  scans: 5,
} as const

export type MeteredFeature = keyof typeof FREE_LIMITS

const USAGE_KEY: Record<MeteredFeature, keyof Profile> = {
  practice: 'usagePracticeCount',
  slides: 'usageSlidesCount',
  scans: 'usageScanCount',
}

// Audio (lecture transcription) is metered in seconds, not call count, and
// kept separate from FREE_LIMITS for that reason.
export const FREE_AUDIO_SECONDS = 30 * 60 // 30 minutes, lifetime, free tier
export const PRO_AUDIO_SECONDS_PER_MONTH = 12 * 60 * 60 // 12 hours/month, Scholar Pro

export function currentMonthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function isPro(profile: Pick<Profile, 'subscriptionTier' | 'subscriptionExpiresAt'>): boolean {
  if (profile.subscriptionTier !== 'pro') return false
  if (!profile.subscriptionExpiresAt) return true
  return new Date(profile.subscriptionExpiresAt).getTime() > Date.now()
}

// Free accounts' practice/slides/scans allowance is a lifetime total now, so
// this is just the stored counter — no month comparison, unlike before.
export function remaining(profile: Profile, feature: MeteredFeature): number {
  if (isPro(profile)) return Infinity
  return Math.max(0, FREE_LIMITS[feature] - Number(profile[USAGE_KEY[feature]] ?? 0))
}

export function canUseFeature(profile: Profile, feature: MeteredFeature): boolean {
  return isPro(profile) || Number(profile[USAGE_KEY[feature]] ?? 0) < FREE_LIMITS[feature]
}

// Seconds of lecture transcription this account can still use right now.
// Free accounts draw from a one-time lifetime allowance; Pro accounts draw
// from a monthly allowance (plus any purchased bonus balance) that resets
// with usageMonthKey.
export function audioSecondsRemaining(profile: Profile): number {
  if (!isPro(profile)) {
    return Math.max(0, FREE_AUDIO_SECONDS - Number(profile.audioFreeSecondsUsed ?? 0))
  }
  const sameMonth = profile.usageMonthKey === currentMonthKey()
  const periodUsed = sameMonth ? Number(profile.audioPeriodSecondsUsed ?? 0) : 0
  const bonus = Number(profile.audioBonusSeconds ?? 0)
  return Math.max(0, PRO_AUDIO_SECONDS_PER_MONTH - periodUsed) + bonus
}

// "1h 20m" / "45 min" — for the remaining-allowance display.
export function formatMinutes(totalSeconds: number): string {
  const mins = Math.round(Math.max(0, totalSeconds) / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export const FEATURE_LABEL: Record<MeteredFeature, string> = {
  practice: 'Practice sets',
  slides: 'Slide decks',
  scans: 'Page scans',
}

// A gated edge function returns 402 + { error, code: 'limit_reached' } when a
// free user is over their cap (see supabase/functions/_shared/
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
  constructor(message = "You've reached your free allowance for this feature.") {
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
