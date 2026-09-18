-- Scholar: Class to Exam — Duolingo-style gamification v2
--
-- Adds: friend codes + friendships (for a friends-only weekly league —
-- global leaderboards would be near-empty with this few users, so ranking
-- is scoped to people you actually know), streak-freeze protection (auto
-- covers one missed day instead of resetting the streak to zero), a daily
-- XP goal per user, and a badge/achievement catalog. Deliberately no
-- hearts/lives and no gems currency — those don't fit a practice-exam tool.

-- 1. Profile additions ---------------------------------------------------------
alter table public.profiles add column if not exists friend_code text unique;
alter table public.profiles add column if not exists streak_freeze_count int not null default 2;
alter table public.profiles add column if not exists daily_goal_xp int not null default 30;
alter table public.profiles add column if not exists league_tier text not null default 'bronze'
  check (league_tier in ('bronze', 'silver', 'gold', 'platinum', 'diamond'));
alter table public.profiles add column if not exists league_week_key text;

-- Short, unambiguous code (no 0/O/1/I) — used to add a friend without
-- exposing email addresses or user ids.
create or replace function public.generate_friend_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  already_used boolean;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    select exists(select 1 from public.profiles where friend_code = code) into already_used;
    exit when not already_used;
  end loop;
  return code;
end;
$$;

update public.profiles set friend_code = public.generate_friend_code() where friend_code is null;

-- Signup trigger now also assigns a friend code.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, friend_code)
  values (new.id, new.raw_user_meta_data ->> 'full_name', public.generate_friend_code());
  return new;
end;
$$;

-- 2. Friendships (symmetric — adding writes both directions so "my
--    friends" is a plain select with no join direction logic) ---------------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

create index if not exists friendships_user_idx on public.friendships (user_id);

alter table public.friendships enable row level security;

create policy "friendships: read own" on public.friendships for select
  using (auth.uid() = user_id);
create policy "friendships: insert own" on public.friendships for insert
  with check (auth.uid() = user_id);
create policy "friendships: delete own" on public.friendships for delete
  using (auth.uid() = user_id);

-- 3. Streak freeze log — which missed dates were auto-covered, so streak
--    calculation can treat them as active without ever double-spending a
--    freeze on the same date. ---------------------------------------------
create table if not exists public.streak_freeze_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  covered_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, covered_date)
);

alter table public.streak_freeze_log enable row level security;

create policy "streak_freeze_log: all own" on public.streak_freeze_log for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. Badges — append-only "earned" log; the catalog of what a badge_key
--    means (label, icon, requirement) lives in the client, not the DB. -----
create table if not exists public.badges_earned (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_key text not null,
  earned_at timestamptz not null default now(),
  unique (user_id, badge_key)
);

alter table public.badges_earned enable row level security;

create policy "badges_earned: all own" on public.badges_earned for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

