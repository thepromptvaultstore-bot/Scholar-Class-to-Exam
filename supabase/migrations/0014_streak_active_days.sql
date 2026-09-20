-- The streak was built as a strict daily requirement, which doesn't match
-- how most students actually use the app: a student with class 4 days a
-- week naturally has no coursework (and so no XP-earning activity) on the
-- other 3 — but only 2 streak freezes ever exist at once, nowhere near
-- enough to cover a routine weekly pattern. This adds a per-user "which
-- days count toward my streak" setting, stored as a 7-bit mask (bit 0 =
-- Sunday .. bit 6 = Saturday, matching JS Date#getDay()). Days outside the
-- mask are simply skipped for streak purposes — they neither extend nor
-- break it — so freezes stay a real safety net for an active day missed by
-- accident, not something burned through every weekend.
--
-- Default 127 (all 7 bits set) reproduces the old daily-every-day behavior
-- exactly, so nobody's existing streak changes until they actively pick
-- their study days.
alter table public.profiles add column if not exists streak_active_days_mask smallint not null default 127
  check (streak_active_days_mask between 1 and 127);

revoke update on public.profiles from authenticated;
grant update (
  full_name, university, avatar_url, daily_goal_xp,
  streak_freeze_count, league_week_key, league_tier,
  prior_gpa, prior_credit_hours, grading_system, total_credits_required,
  streak_active_days_mask
) on public.profiles to authenticated;
