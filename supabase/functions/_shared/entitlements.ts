// Shared usage limits for every metered AI edge function (generate-practice,
// generate-slides, transcribe-image, transcribe-audio).
//
// Two different models on purpose:
//  - practice / slides / scans: a ONE-TIME lifetime allowance for free
//    accounts, not a monthly one — every call here is a real Claude API cost
//    with nothing coming back from a non-paying user, so letting it renew
//    every month forever would be a standing loss, not a trial. Once spent,
//    it's spent for good unless the account upgrades.
//  - audio (lecture transcription): metered in actual SECONDS of recording,
//    not call count, since a 3-minute clip and a 90-minute lecture cost
//    wildly different amounts to transcribe. Free gets a one-time lifetime
//    allowance (30 minutes), same reasoning as above. Scholar Pro gets a
//    real but capped monthly allowance (12 hours) that resets with
//    usage_month_key, plus an optional purchased bonus balance
//    (audio_bonus_seconds) that never expires and is only drawn down once
//    the monthly allowance runs out — ready for a future "buy more hours"
//    purchase; harmless (stays 0) until that ships.
//
// The purchase itself is verified server-side against the Google Play
// Developer API in the verify-purchase function — nothing here trusts the
// client's word that a purchase happened; this module only ever reads the
// subscription_tier/subscription_expires_at that verify-purchase wrote.

export const FREE_LIMITS = {
  practice: 5,
  slides: 5,
  scans: 5,
} as const

export type MeteredFeature = keyof typeof FREE_LIMITS

const USAGE_COLUMN: Record<MeteredFeature, string> = {
  practice: 'usage_practice_count',
  slides: 'usage_slides_count',
  scans: 'usage_scan_count',
}

// Audio allowances, in seconds — kept separate from FREE_LIMITS since audio
// is metered by duration, not call count.
export const FREE_AUDIO_SECONDS = 30 * 60 // 30 minutes, lifetime, free tier
export const PRO_AUDIO_SECONDS_PER_MONTH = 12 * 60 * 60 // 12 hours/month, Scholar Pro

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
  usage_practice_count: number
  usage_slides_count: number
  usage_scan_count: number
  [key: string]: unknown
}

export type EntitlementResult =
  | { allowed: true }
  | { allowed: false; limit: number; feature: MeteredFeature }

// Checks whether `userId` may use `feature` once more. practice/slides/scans
// are a ONE-TIME lifetime allowance for free accounts (see file header), so
// there is no monthly reset here — the stored count is a running lifetime
// total. Pro subscribers always pass without touching their usage row. Fails
// open (allows the request) if the profile lookup itself errors, since a
// billing hiccup should never be why a paying-adjacent feature silently breaks.
export async function checkAndConsume(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  feature: MeteredFeature,
): Promise<EntitlementResult> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('subscription_tier, subscription_expires_at, usage_practice_count, usage_slides_count, usage_scan_count')
    .eq('id', userId)
    .single()
  if (error || !profile) return { allowed: true }

  const row = profile as UsageRow
  if (isProActive(row)) return { allowed: true }

  const column = USAGE_COLUMN[feature]
  const limit = FREE_LIMITS[feature]
  const currentCount = Number(row[column] ?? 0)

  if (currentCount + 1 > limit) {
    return { allowed: false, limit, feature }
  }

  await supabase.from('profiles').update({ [column]: currentCount + 1 }).eq('id', userId)
  return { allowed: true }
}

// Friendly copy for the 402 response body — the client shows this verbatim
// with an "Upgrade" button rather than a generic error banner.
export function limitMessage(feature: MeteredFeature): string {
  const label: Record<MeteredFeature, string> = {
    practice: 'practice sets',
    slides: 'slide decks',
    scans: 'page scans',
  }
  return `You've used your ${FREE_LIMITS[feature]} free ${label[feature]} — a one-time allowance, not monthly. Upgrade to Scholar Pro for unlimited access.`
}

// --- Audio (duration-metered) ----------------------------------------------

export type AudioDenyReason = 'free_limit' | 'pro_limit'

export type AudioEntitlementResult =
  | { allowed: true }
  | { allowed: false; reason: AudioDenyReason; remainingSeconds: number }

interface AudioUsageRow {
  subscription_tier: string
  subscription_expires_at: string | null
  usage_month_key: string | null
  audio_free_seconds_used: number
  audio_period_seconds_used: number
  audio_bonus_seconds: number
  [key: string]: unknown
}

// Checks + consumes `requestedSeconds` of transcription time for `userId`,
// BEFORE the (paid, per-minute) transcription call actually runs, so a user
// who's already out of allowance never triggers a real STT API cost.
// requestedSeconds comes from the client's own recorded duration (see
// useRecorder.ts / NoteEditorPage.tsx) rather than being derived from the
// audio file server-side, since none of the transcribe-audio adapters
// currently surface duration in their response. That makes it a
// self-reported value — fine for a cost *control*, not a security boundary,
// since nothing sensitive is gated by it.
export async function checkAndConsumeAudio(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  requestedSeconds: number,
): Promise<AudioEntitlementResult> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(
      'subscription_tier, subscription_expires_at, usage_month_key, audio_free_seconds_used, audio_period_seconds_used, audio_bonus_seconds',
    )
    .eq('id', userId)
    .single()
  if (error || !profile) return { allowed: true }

  const row = profile as AudioUsageRow
  const seconds = Math.max(0, Math.round(requestedSeconds))

  if (!isProActive(row)) {
    const used = Number(row.audio_free_seconds_used ?? 0)
    if (used + seconds > FREE_AUDIO_SECONDS) {
      return { allowed: false, reason: 'free_limit', remainingSeconds: Math.max(0, FREE_AUDIO_SECONDS - used) }
    }
    await supabase.from('profiles').update({ audio_free_seconds_used: used + seconds }).eq('id', userId)
    return { allowed: true }
  }

  // Pro: a real monthly allowance (resets lazily via usage_month_key, same
  // pattern the free-tier reset used to use), topped up by any purchased
  // bonus balance once the monthly allowance runs out.
  const thisMonth = currentMonthKey()
  const sameMonth = row.usage_month_key === thisMonth
  const periodUsed = sameMonth ? Number(row.audio_period_seconds_used ?? 0) : 0
  const bonus = Number(row.audio_bonus_seconds ?? 0)
  const monthlyRemaining = Math.max(0, PRO_AUDIO_SECONDS_PER_MONTH - periodUsed)

  if (seconds <= monthlyRemaining) {
    await supabase
      .from('profiles')
      .update({ usage_month_key: thisMonth, audio_period_seconds_used: periodUsed + seconds })
      .eq('id', userId)
    return { allowed: true }
  }

  const overflow = seconds - monthlyRemaining
  if (overflow <= bonus) {
    await supabase
      .from('profiles')
      .update({
        usage_month_key: thisMonth,
        audio_period_seconds_used: periodUsed + seconds,
        audio_bonus_seconds: bonus - overflow,
      })
      .eq('id', userId)
    return { allowed: true }
  }

  return { allowed: false, reason: 'pro_limit', remainingSeconds: monthlyRemaining + bonus }
}

// Friendly copy for the 402 response body when audio is what's over the limit.
export function audioLimitMessage(reason: AudioDenyReason): string {
  if (reason === 'free_limit') {
    return "You've used your 30 free minutes of lecture transcription — a one-time allowance, not monthly. Upgrade to Scholar Pro for 12 hours every month."
  }
  return "You've used this month's 12 hours of lecture transcription included with Scholar Pro. More hours become available next month."
}
