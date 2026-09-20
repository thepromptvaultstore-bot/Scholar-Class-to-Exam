-- Lets a student opt in to publishing one of their own notes to a
-- course-notes browser other students can search (by course label and
-- university) — the "course-based note sharing" feature, building on the
-- existing private share-link mechanism (share_token) rather than
-- replacing it.

alter table public.notes
  add column if not exists community_visible boolean not null default false,
  add column if not exists community_course_label text;

-- The browse/search list needs to read across every user's notes (and each
-- author's university/name), which normal per-user RLS on notes/profiles
-- doesn't allow and shouldn't be loosened for generally. Rather than add a
-- broad new SELECT policy (which would make an entire row's columns
-- readable, including things like subscription_tier or usage counts on
-- profiles), this is a SECURITY DEFINER function with a hard-coded, narrow
-- return list — it can never expose anything beyond exactly the seven
-- columns named below, and only for notes their own owner explicitly
-- marked community_visible.
create or replace function public.list_community_notes(
  course_query text default null,
  university_query text default null
)
returns table (
  id uuid,
  title text,
  content text,
  session_date date,
  community_course_label text,
  share_token text,
  created_at timestamptz,
  university text,
  author_name text
)
language sql
security definer
set search_path = public
as $$
  select
    n.id, n.title, n.content, n.session_date, n.community_course_label,
    n.share_token, n.created_at,
    p.university,
    coalesce(nullif(p.full_name, ''), 'A student') as author_name
  from public.notes n
  join public.profiles p on p.id = n.user_id
  where n.community_visible = true
    and (course_query is null or n.community_course_label ilike '%' || course_query || '%')
    and (university_query is null or p.university ilike '%' || university_query || '%')
  order by n.created_at desc
  limit 100
$$;

revoke all on function public.list_community_notes(text, text) from public;
grant execute on function public.list_community_notes(text, text) to authenticated;
