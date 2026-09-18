-- Scholar: Class to Exam — Phase 6 schema (Grades / GPA Calculator)

-- A user-customizable letter-grade → GPA-points scale, since universities
-- differ (some use a 4.0 scale, some a 4.3 scale with A+, etc). Seeded with
-- a standard US 4.0 scale on first use by the client (resetToDefaultScale),
-- not by a DB trigger, so it stays easy to see/change in one place.
create table if not exists public.grade_scale_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  letter text not null,
  gpa numeric not null,
  min_percent numeric not null,
  created_at timestamptz not null default now()
);

-- One final grade per subject, feeding the GPA calculation. `grade_percent`
-- is optional so a course-in-progress can be tracked before a final letter
-- is assigned; when both are set, letter_grade wins for GPA math.
create table if not exists public.course_grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  credit_hours numeric not null default 3,
  grade_percent numeric,
  letter_grade text,
  created_at timestamptz not null default now(),
  unique (subject_id)
);

alter table public.grade_scale_entries enable row level security;
alter table public.course_grades enable row level security;

create policy "grade_scale_entries: all own" on public.grade_scale_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "course_grades: all own" on public.course_grades for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
