-- Scholar: Class to Exam — attendance XP follow-up
--
-- Lets a scheduled class be marked "attended" for a given date, awarding XP
-- once per class per day (the unique index blocks a second award for the
-- same class on the same date). This is what ties the timetable into the
-- leveling system — showing up for real classes earns real XP, per the
-- product plan's "true life format" leveling goal.

alter table public.xp_events drop constraint if exists xp_events_kind_check;
alter table public.xp_events
  add constraint xp_events_kind_check
  check (kind in ('note_captured', 'practice_generated', 'practice_graded', 'class_attended'));

create table if not exists public.class_attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  class_schedule_id uuid not null references public.class_schedule (id) on delete cascade,
  attended_date date not null,
  created_at timestamptz not null default now(),
  unique (class_schedule_id, attended_date)
);

alter table public.class_attendance enable row level security;

create policy "class_attendance: all own" on public.class_attendance for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
