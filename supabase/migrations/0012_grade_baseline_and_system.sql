-- Two additions to the Grades / GPA feature:
--
-- 1. A "prior CGPA" baseline (prior_gpa + prior_credit_hours) so a student
--    who already has a running CGPA from courses completed before they
--    started using the app doesn't have to re-enter every past course —
--    they enter the one number their transcript already gives them, and it
--    gets folded into the weighted average alongside courses tracked here.
--
-- 2. A per-user grading_system choice ('semester' GPA/CGPA vs 'yearly'
--    aggregate-percentage/Division-Class), since not every university runs
--    a point-scale semester system — some run a yearly system that grades
--    on aggregate marks instead. Both modes reuse the same customizable
--    grade_scale_entries table (see 0009/0010) rather than adding a second
--    scale concept: in 'yearly' mode the scale's `letter` column just holds
--    class/division names (e.g. "First Class") instead of letter grades,
--    and the `gpa` column on each entry goes unused for computation.

alter table public.profiles add column if not exists prior_gpa numeric;
alter table public.profiles add column if not exists prior_credit_hours numeric not null default 0;
alter table public.profiles add column if not exists grading_system text not null default 'semester'
  check (grading_system in ('semester', 'yearly'));

-- Re-declare the full client-safe column allowlist (see 0011_subscriptions.sql)
-- rather than an incremental grant, since `grant update (cols)` replaces the
-- column list rather than adding to it.
revoke update on public.profiles from authenticated;
grant update (
  full_name, university, avatar_url, daily_goal_xp,
  streak_freeze_count, league_week_key, league_tier,
  prior_gpa, prior_credit_hours, grading_system
) on public.profiles to authenticated;
