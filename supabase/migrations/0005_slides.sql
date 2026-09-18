-- Scholar: Class to Exam — Phase 5 schema (Slides & Presentation Generator)

create table if not exists public.presentations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  note_ids uuid[] not null default '{}',
  topic text not null,
  status text not null default 'generating'
    check (status in ('generating', 'ready', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.presentation_slides (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations (id) on delete cascade,
  order_index int not null default 0,
  title text not null,
  bullets jsonb not null default '[]',   -- string[]
  speaker_notes text not null default ''  -- the matching presentation script for this slide
);

alter table public.presentations enable row level security;
alter table public.presentation_slides enable row level security;

create policy "presentations: all own" on public.presentations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "presentation_slides: via own presentation" on public.presentation_slides for all
  using (exists (
    select 1 from public.presentations p
    where p.id = presentation_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.presentations p
    where p.id = presentation_id and p.user_id = auth.uid()
  ));
