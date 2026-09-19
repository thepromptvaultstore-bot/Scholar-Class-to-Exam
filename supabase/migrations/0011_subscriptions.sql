-- Scholar: Class to Exam — subscriptions (Scholar Pro) + AI usage metering
--
-- Free tier gets a small monthly allowance of each AI feature (practice-set
-- generation, slide-deck generation, scanned-page transcription, and lecture
-- audio transcriptions); Scholar Pro removes the caps. Usage resets lazily
-- on first use each month (same "compare a stored period key, reset if it
-- changed" pattern as league_week_key in 0010_gamification_v2.sql) rather
-- than a cron job, so it works the same in dev and prod with zero scheduler
-- setup.
--
-- The purchase itself is verified server-side against the Google Play
-- Developer API in the verify-purchase edge function — nothing here trusts
-- the client's word that a purchase happened.

alter table public.profiles add column if not exists subscription_tier text not null default 'free'
  check (subscription_tier in ('free', 'pro'));
alter table public.profiles add column if not exists subscription_expires_at timestamptz;
alter table public.profiles add column if not exists subscription_product_id text;
alter table public.profiles add column if not exists subscription_purchase_token text;

alter table public.profiles add column if not exists usage_month_key text;
alter table public.profiles add column if not exists usage_practice_count int not null default 0;
alter table public.profiles add column if not exists usage_slides_count int not null default 0;
alter table public.profiles add column if not exists usage_scan_count int not null default 0;
alter table public.profiles add column if not exists usage_audio_count int not null default 0;

-- One purchase token should only ever back one account.
create unique index if not exists profiles_subscription_purchase_token_idx
  on public.profiles (subscription_purchase_token)
  where subscription_purchase_token is not null;

-- Lock down which columns a signed-in user can write directly. The existing
-- "profiles: update own" RLS policy only restricts which ROW you can touch
-- (auth.uid() = id) — it says nothing about which COLUMNS, so without this a
-- user could open the browser console and call
-- `supabase.from('profiles').update({ subscription_tier: 'pro' })` and grant
-- themselves Scholar Pro for free. Only the columns the client's own code
-- actually writes directly get column-level UPDATE; every subscription and
-- usage-counter column is only ever written by an edge function running
-- under the service-role key, which bypasses RLS and column grants entirely.
revoke update on public.profiles from authenticated;
grant update (
  full_name, university, avatar_url, daily_goal_xp,
  streak_freeze_count, league_week_key, league_tier
) on public.profiles to authenticated;
