-- Scholar: Class to Exam — Phase 2 schema (AI Practice & Test Generation)

create table if not exists public.practice_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  note_ids uuid[] not null default '{}',       -- notes this set was generated from
  title text not null default 'Practice set',
  scope text not null default 'single'
    check (scope in ('single', 'multi', 'course')),
  format text not null default 'quiz'
    check (format in ('quiz', 'exam')),          -- quiz = objective, exam = topic/essay-based
  status text not null default 'generating'
    check (status in ('generating', 'ready', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.practice_questions (
  id uuid primary key default gen_random_uuid(),
  practice_set_id uuid not null references public.practice_sets (id) on delete cascade,
  order_index int not null default 0,
  type text not null check (type in ('mcq', 'true_false', 'fill_blank', 'short_answer', 'essay')),
  prompt text not null,
  choices jsonb,              -- for mcq: string[]
  correct_answer text,        -- for mcq/true_false/fill_blank: the expected answer
  rubric text,                -- for short_answer/essay: grading criteria the AI generated
  max_score int not null default 1
);

create table if not exists public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  practice_set_id uuid not null references public.practice_sets (id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'grading', 'graded', 'failed')),
  total_score numeric,     -- percentage 0-100, filled once graded
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.practice_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.practice_attempts (id) on delete cascade,
  question_id uuid not null references public.practice_questions (id) on delete cascade,
  user_answer text not null default '',
  score numeric,           -- 0..max_score, filled once graded
  feedback text,           -- short rubric-based feedback, filled once graded
  is_correct boolean
);

-- One answer row per question per attempt; the client upserts on this pair
-- as the student works through a set (answer now, possibly revise before
-- submitting).
create unique index if not exists practice_answers_attempt_question_idx
  on public.practice_answers (attempt_id, question_id);

alter table public.practice_sets enable row level security;
alter table public.practice_questions enable row level security;
alter table public.practice_attempts enable row level security;
alter table public.practice_answers enable row level security;

create policy "practice_sets: all own" on public.practice_sets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "practice_questions: via own set" on public.practice_questions for all
  using (exists (
    select 1 from public.practice_sets s
    where s.id = practice_set_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.practice_sets s
    where s.id = practice_set_id and s.user_id = auth.uid()
  ));

create policy "practice_attempts: all own" on public.practice_attempts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "practice_answers: via own attempt" on public.practice_answers for all
  using (exists (
    select 1 from public.practice_attempts a
    where a.id = attempt_id and a.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.practice_attempts a
    where a.id = attempt_id and a.user_id = auth.uid()
  ));
