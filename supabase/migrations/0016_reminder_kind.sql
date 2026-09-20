-- Distinguishes real deadlines from one-off alerts on the reminders table
-- that already exists (0003_schedule.sql) — 'assignment' / 'exam' get
-- grouped and highlighted on the new Planner page and Home's "Due soon"
-- widget; plain 'reminder' keeps today's behavior exactly as-is (the
-- default), so existing rows need no backfill.
alter table public.reminders
  add column if not exists kind text not null default 'reminder'
  check (kind in ('assignment', 'exam', 'reminder'));
