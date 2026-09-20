-- Degree-progress tracking for the Grades page: a total-credits-required
-- figure (e.g. 120 for a bachelor's) so "credits completed" (already
-- computed from prior_credit_hours + tracked courses, see 0012) can be
-- shown as progress toward the degree, matching what most university
-- portals already show (Credit Required / Credit Completed / CGPA).

alter table public.profiles add column if not exists total_credits_required numeric;

revoke update on public.profiles from authenticated;
grant update (
  full_name, university, avatar_url, daily_goal_xp,
  streak_freeze_count, league_week_key, league_tier,
  prior_gpa, prior_credit_hours, grading_system, total_credits_required
) on public.profiles to authenticated;
