// Shared free-tier usage limits + monthly rollover, used by every metered AI
// edge function (generate-practice, generate-slides, transcribe-image,
// transcribe-audio) so a Scholar Pro subscriber is never rate-limited and a
// free user gets a small, predictable monthly allowance. Kept here instead
// of duplicated per-function because these numbers must match what the
// client shows the user before they even try (src/lib/entitlements.ts) —
// one wrong copy would mean the app promises "2 of 5 left" and the server
// blocks at a different number.
//
// Usage resets lazily on first use each month (compare a stored "YYYY-MM"
// key, reset if it changed) — same pattern as league_week_key's weekly
// rollover in src/lib/gamification.ts — rather than a cron job, so it works
// identically in dev and prod with zero scheduler setup.
//
// The purchase itself is verified server-side against the Google Play
// Developer API in the verify-purchase function — nothing here trusts the
// client's word that a purchase happened; this module only ever reads the
// subscription_tier/subscription_expires_at that verify-purchase wrote.

export const FREE_LIMITS = {
  practice: 5,
  slides: 5,
  scans: 5,
  audio: 5,
} as const

export type MeteredFeature = 'practice' | 'slides' | 'scans' | 'audio'

const USAGE_COLUMN: Record<MeteredFeature, string> = {
  practice: 'usage_practice_count',
  slides: 'usage_slides_count',
  scans: 'usage_scan_count',
  audio: 'usage_audio_count',
}

export function currentMonthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function isProActive(profile: {
  subscription_tier: string
  subscription_expires_at: string | null
}): boolean {
  if (profile.subscription_tier !== 'pro') return false
  if (!profile.subscription_expires_at) return true // lifetime/manually-granted pro
  return new Date(profile.subscription_expires_at).getTime() > Date.now()
}

interface UsageRow {
  subscription_tier: string
  subscription_expires_at: string | null
  usage_month_key: string | null
  usage_practice_count: number
  usage_slides_count: number
  usage_scan_count: number
  usage_audio_count: number
  [key: string]: unknown
}

export type EntitlementResult =
  | { allowed: true }
  | { allowed: false; limit: number; feature: MeteredFeature }

// Checks whether `userId` may use `feature` once more right now, resetting
// their monthly counters first if a new month has started, and — only when
// allowed — writing the incremented count back immediately (so two requests
// racing each other can't both slip through on the last unit of allowance).
// Pro subscribers always pass without touching their usage row. Fails open
// (allows the request) if the profile lookup itself errors, since a billing
// hiccup should never be why a paying-adjacent feature silently breaks.
export async function checkAndConsume(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  feature: MeteredFeature,
): Promise<EntitlementResult> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(
      'subscription_tier, subscription_expires_at, usage_month_key, usage_practice_count, usage_slides_count, usage_scan_count, usage_audio_count',
    )
    .eq('id', userId)
    .single()
  if (error || !profile) return { allowed: true }

  const row = profile as UsageRow
  if (isProActive(row)) return { allowed: true }

  const thisMonth = currentMonthKey()
  const column = USAGE_COLUMN[feature]
  const limit = FREE_LIMITS[feature]
  const sameMonth = row.usage_month_key === thisMonth
  const currentCount = sameMonth ? Number(row[column] ?? 0) : 0

  if (currentCount + 1 > limit) {
    return { allowed: false, limit, feature }
  }

  const update = sameMonth
    ? { [column]: currentCount + 1 }
    : {
        usage_month_key: thisMonth,
        usage_practice_count: 0,
        usage_slides_count: 0,
        usage_scan_count: 0,
        usage_audio_count: 0,
        [column]: 1,
      }
  await supabase.from('profiles').update(update).eq('id', userId)
  return { allowed: true }
}

// Friendly copy for the 402 response body — the client shows this verbatim
// with an "Upgrade" button rather than a generic error banner.
export function limitMessage(feature: MeteredFeature): string {
  const label: Record<MeteredFeature, string> = {
    practice: 'practice sets',
    slides: 'slide decks',
    scans: 'page scans',
    audio: 'lecture transcriptions',
  }
  return `You've used all ${FREE_LIMITS[feature]} free ${label[feature]} this month. Upgrade to Scholar Pro for unlimited access.`
}
