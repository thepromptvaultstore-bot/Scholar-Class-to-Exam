-- Scholar: Class to Exam — Phase 3 schema (Timetable & Time Management)

-- Weekly recurring class schedule (one row per class meeting slot).
create table if not exists public.class_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  location text,
  created_at timestamptz not null default now()
);

-- Standalone reminders (assignments due, study sessions, exams, etc).
-- `notified` tracks whether the in-app notifier has already fired for this
-- reminder, so it only alerts once even though the client polls repeatedly.
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null,
  note text,
  remind_at timestamptz not null,
  notified boolean not null default false,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists reminders_user_remind_at_idx
  on public.reminders (user_id, remind_at);

alter table public.class_schedule enable row level security;
alter table public.reminders enable row level security;

create policy "class_schedule: all own" on public.class_schedule for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "reminders: all own" on public.reminders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
