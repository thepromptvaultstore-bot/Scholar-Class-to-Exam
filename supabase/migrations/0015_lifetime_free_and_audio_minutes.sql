-- Reworks free-tier metering from "N per month, forever" to "N total, once"
-- (practice/slides/scans), and switches lecture transcription from a raw
-- call-count to actual seconds of audio, since a 3-minute clip and a
-- 90-minute lecture cost wildly different amounts to transcribe.
--
-- usage_audio_count (added in 0011) is superseded by the three columns
-- below and no longer written to — left in place rather than dropped, since
-- it costs nothing to leave an unused column and dropping it isn't reversible.

alter table public.profiles
  add column if not exists audio_free_seconds_used integer not null default 0,
  add column if not exists audio_period_seconds_used integer not null default 0,
  add column if not exists audio_bonus_seconds integer not null default 0;

-- Column-level grants are a full replacement, not additive (see 0014's
-- comment) — re-declare the complete client-writable list. None of the new
-- audio_* columns are added here on purpose: entitlement counters must only
-- ever be written by service-role edge functions, never by the client
-- directly, the same as the existing usage_* columns.
revoke update on public.profiles from authenticated;
grant update (
  full_name, university, avatar_url, daily_goal_xp,
  streak_freeze_count, league_week_key, league_tier,
  prior_gpa, prior_credit_hours, grading_system, total_credits_required,
  streak_active_days_mask
) on public.profiles to authenticated;
