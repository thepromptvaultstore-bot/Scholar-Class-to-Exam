-- Scholar: Class to Exam — Phase 4 schema (Gamified Knowledge Stats & Leveling)
--
-- XP is logged as an append-only event stream rather than a single running
-- total, so the client can both show a lifetime level and derive streaks
-- (distinct activity dates) from the same table without a second write path.

create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  kind text not null check (kind in ('note_captured', 'practice_generated', 'practice_graded')),
  amount int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists xp_events_user_created_idx
  on public.xp_events (user_id, created_at);

alter table public.xp_events enable row level security;

create policy "xp_events: all own" on public.xp_events for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
