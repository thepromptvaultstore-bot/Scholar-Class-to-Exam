-- Scholar: Class to Exam — share a note or practice set via a public link
--
-- "share notes between friends ... can be used as advertise of our app" —
-- adds an opaque, revocable share_token to notes and practice_sets. A note
-- or set is private by default (share_token is null); tapping "Share"
-- generates one. The public read path never queries these tables directly
-- with the anon key (that would need a permissive RLS policy on share_token
-- being non-null, which — since PostgREST callers can omit the token filter
-- entirely — would let anyone list every shared row from every user, not
-- just the one they have the link for). Instead the public share page goes
-- through the new `get-shared` edge function, which uses the service role
-- to look up the exact token server-side and returns only one sanitized
-- row. So RLS on these tables stays exactly as it was — fully owner-only.

alter table public.notes add column if not exists share_token text unique;
alter table public.practice_sets add column if not exists share_token text unique;

create index if not exists notes_share_token_idx on public.notes (share_token) where share_token is not null;
create index if not exists practice_sets_share_token_idx on public.practice_sets (share_token) where share_token is not null;
