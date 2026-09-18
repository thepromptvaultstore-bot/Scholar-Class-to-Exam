-- Scholar: Class to Exam — handwritten-note scanning + a real profile page
--
-- Two additions from user feedback on the original product plan:
-- 1. "Upload hand written notes ... so all notes can be bought together" —
--    a new capture_mode 'photo': the student photographs a handwritten page,
--    it's OCR'd (via Claude vision, see supabase/functions/transcribe-image)
--    straight into the note's `content`, exactly like a voice note's audio
--    gets STT'd into `content` — so every note (typed, recorded, or
--    scanned) lives in the same `notes` table and shows up together in the
--    "All notes" tab and in AI practice/exam generation, no separate path.
--    Reuses transcription_status/transcription_engine for OCR status too —
--    no new columns needed for that part.
-- 2. "need a profile of my own" — an avatar to go with the existing
--    full_name/university fields on `profiles`.

alter table public.notes drop constraint if exists notes_capture_mode_check;
alter table public.notes
  add constraint notes_capture_mode_check
  check (capture_mode in ('manual', 'voice', 'photo'));

alter table public.profiles add column if not exists avatar_url text;

-- Public read (so an <img src> just works with no signed URL), write
-- restricted to the owner's own folder — same convention as the other
-- buckets below.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars: public read" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars: own folder write" on storage.objects for all
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
