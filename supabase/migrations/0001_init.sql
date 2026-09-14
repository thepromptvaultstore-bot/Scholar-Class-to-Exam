-- Scholar: Class to Exam — Phase 1 schema (Capture & Notes)
-- Run this in the Supabase SQL editor (or `supabase db push`) on a fresh project.

-- 1. Profiles ---------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  university text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Semesters ----------------------------------------------------------------
create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. Subjects / courses ---------------------------------------------------------
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  semester_id uuid not null references public.semesters (id) on delete cascade,
  name text not null,
  professor_name text,
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

-- 4. Notes (one per class session) ----------------------------------------------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  session_date date not null default current_date,
  title text not null default 'Class note',
  capture_mode text not null default 'manual' check (capture_mode in ('manual', 'voice')),
  content text not null default '',           -- manual notes / edited transcript, markdown
  raw_transcript text,                         -- untouched STT output, kept for reference
  audio_path text,                             -- storage path in the 'lecture-audio' bucket
  transcription_status text not null default 'none'
    check (transcription_status in ('none', 'pending', 'processing', 'done', 'failed')),
  transcription_engine text,                   -- which STT engine produced raw_transcript
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Not a hard DB constraint: the app looks up an existing note for the same
-- subject + date and offers to continue it before creating a new one, but a
-- second note the same day (e.g. a makeup class) is still allowed.
create index if not exists notes_subject_date_idx
  on public.notes (subject_id, session_date);

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute procedure public.set_updated_at();

-- 5. Attached materials (lecturer slides/PDFs/handouts per note) ----------------
create table if not exists public.note_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  file_path text not null,     -- storage path in the 'note-materials' bucket
  file_name text not null,
  file_type text,
  created_at timestamptz not null default now()
);

-- 6. Row Level Security ---------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.semesters enable row level security;
alter table public.subjects enable row level security;
alter table public.notes enable row level security;
alter table public.note_materials enable row level security;

create policy "profiles: read own" on public.profiles for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update using (auth.uid() = id);

create policy "semesters: all own" on public.semesters for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "subjects: all own" on public.subjects for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notes: all own" on public.notes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "note_materials: all own" on public.note_materials for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 7. Storage buckets --------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('lecture-audio', 'lecture-audio', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('note-materials', 'note-materials', false)
on conflict (id) do nothing;

-- Users may only touch objects inside a folder named after their own uid,
-- e.g. lecture-audio/<user_id>/<note_id>.webm
create policy "lecture-audio: own folder" on storage.objects for all
  using (bucket_id = 'lecture-audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'lecture-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "note-materials: own folder" on storage.objects for all
  using (bucket_id = 'note-materials' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'note-materials' and (storage.foldername(name))[1] = auth.uid()::text);
