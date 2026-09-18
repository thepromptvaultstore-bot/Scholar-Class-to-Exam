# Scholar: Class to Exam

All 7 modules of the product plan are now built. Same stack as Rise Up / IELTSGate: React + Vite + TypeScript + Tailwind, Supabase backend, Vercel web hosting, Capacitor for the Android shell. Full responsive layout — a sidebar nav on desktop/tablet, a bottom tab bar on mobile — not a phone-width-only shell.

## Premium UI pass

- A dark-first "glass" design system (`src/index.css`): translucent blurred cards, gradient buttons, and a soft animated "aurora" gradient-mesh background rendered in pure CSS behind every screen. This was chosen over stock background photos on purpose — it costs nothing to load, stays crisp at any screen size, needs no image licensing, and keeps working offline in the packaged Android app, while still giving the premium look that was asked for.
- Notes was restructured: an **All notes** tab (search by text, filter by semester/course, browse everything you've ever captured in one place) plus a separate **Semesters & courses** tab for management — rename or delete a semester or a course right there (deleting a semester deletes its courses and notes, with a confirmation first).
- Timetable now has a real weekly grid (like a printed university routine) plus a "Today" agenda strip that highlights what's happening now vs. next, and a "Mark attended" button on today's classes that awards XP — attendance now feeds the leveling system directly.
- Grades/GPA groups courses by semester (or year, or term — whatever you name it), shows each group's own GPA plus one cumulative CGPA, so it works for both semester-system and year-system universities.

## Handwritten notes, unified AI prep, and a real profile (post-launch feedback)

- **Scan handwritten notes.** Notes now has a third capture mode alongside typing and recording: "Scan handwritten." Photograph (or upload) one or more pages of a handwritten notebook and Claude's vision API (`supabase/functions/transcribe-image`, reusing the same `ANTHROPIC_API_KEY` already set for the other AI functions — no new key needed) OCRs each page straight into the note's text, the same way a recorded lecture's audio gets speech-to-text'd into the note. The original photos stay attached below as thumbnails for reference. Because scanned text lands in the exact same `content` field as typed and recorded notes, every note — typed, recorded, or scanned — shows up together in the **All notes** tab with no separate path to manage.
- **AI practice/exams now read study materials too, not just note text.** `generate-practice` was extended to pull in each selected note's attached images and PDFs (a scanned past exam, a textbook chapter, a slide PDF) as direct vision/document input to Claude alongside the notes' own text, so "make practice questions" or "take an exam" draws on both the notes *and* whatever study materials are attached to them — exactly the "notes and study materials" combination asked for. Capped at 8 attached files per generation to keep requests reasonable.
- **A real profile page** (`/profile`, linked from the avatar in the top-right on Home and at the bottom of the desktop sidebar): editable name and university, an uploadable profile photo (new `avatars` storage bucket), and a stats strip (level, XP, day streak, note/course counts). Sign-out now lives here instead of a stray icon on Home.
- New migration `0008_photo_notes_and_profile.sql`: adds `'photo'` to the notes capture-mode check constraint, adds `avatar_url` to `profiles`, and creates the public-read/owner-write `avatars` storage bucket.

## Share a note or practice set via a link

- Any note or generated practice set has a "Share" icon (top of the note editor / practice set page) that creates a public, revocable link — `/s/note/:token` or `/s/practice/:token`. No login is needed to *view* the shared page: it's a clean, branded page (Scholar logo, the note's content or the quiz's title/question count) that doubles as light organic advertising for the app, since anyone who gets sent a link sees what Scholar looks like even before signing up.
- Viewing needs no account; *keeping* it does. A signed-in visitor gets a "Save a copy to my notes" (notes) or "Take this quiz" (practice sets) button that clones the shared item into their own account under a course they pick — for a quiz, that clone is a full, independent copy (including the answer key, never shown in the UI) so it grades normally and the two of you can compare scores. A visitor without an account gets a "Sign up free" call to action instead.
- New edge function `get-shared` does the public lookup server-side by the exact share token (via the service role), rather than a relaxed RLS policy on `notes`/`practice_sets` — a policy that just checked "share_token is not null" would let anyone list every shared row from every user by omitting the token filter, not just fetch the one they have a link for. `get-shared` returns only the single matching, sanitized row, so the tables themselves stay exactly as owner-only as before.
- "Stop sharing" clears the token, immediately invalidating any link already sent out; sharing again issues a brand new one.
- New migration `0009_sharing.sql` adds the `share_token` column (unique, nullable) to both tables.

## Duolingo-style gamification: friends, streak freezes, daily goals, badges

- **Friend codes + a friends-only weekly league.** Every profile gets a short 6-character friend code (`/league`, also linked from Profile); add someone by entering their code — no email/search needed, so a stranger can't look you up. The weekly leaderboard (this week's XP) and promotion/demotion (top third of your friend group promotes a league tier — Bronze → Silver → Gold → Platinum → Diamond — bottom third demotes) is scoped to friends rather than all Scholar users: with the current user base, a global leaderboard would just show you alone in Bronze most weeks, which defeats the point of a league. Two new edge functions do the cross-user work RLS otherwise blocks: `add-friend` (looks up a code and writes both directions of the friendship) and `get-friends` (computes friends' this-week/last-week/lifetime XP for the board and the weekly promotion/demotion check).
- **Streak freezes.** Miss exactly one day and, if you have a freeze available, it's spent automatically to keep your streak alive instead of resetting to zero — same idea as Duolingo's, minus a gem shop: everyone starts with 2, and the only way to earn more (back up to a cap of 2) is hitting a 7/30/100-day streak badge. No hearts/lives system — this is a practice-exam tool, not something that should lock you out of studying for getting an answer wrong.
- **A daily XP goal**, picked on Profile (Casual 20 / Regular 30 / Serious 50 / Intense 80 XP) and shown as a progress ring on Home next to today's XP.
- **A badge/trophy case** on Profile — streak, level, note-count, practice-count, and perfect-score milestones, greyed out until earned, awarded automatically as soon as they're hit (`checkAndAwardBadges`, called on Home load).
- New migration `0010_gamification_v2.sql` adds `friend_code` / `streak_freeze_count` / `daily_goal_xp` / `league_tier` / `league_week_key` to `profiles`, plus new `friendships`, `streak_freeze_log`, and `badges_earned` tables (all owner-only RLS; cross-user reads go through the two new edge functions instead of relaxed policies, same reasoning as the share-link feature above).

## Theming fixes (post-launch feedback)

- The app now commits to a single always-dark theme instead of switching with the OS: `@custom-variant dark (&);` in `src/index.css` forces every `dark:` Tailwind class on unconditionally, and `color-scheme: dark` is set globally. This directly fixes native `<select>` dropdown popups (course picker, letter-grade picker, etc.) rendering with illegible light/white system chrome against the dark page — `select`/`input`/`textarea` get an explicit `color-scheme: dark`, and `option` elements get explicit dark background/text colors, so the popup list now matches the app instead of falling back to the OS's light theme.
- The color palette was swapped from an indigo→violet→fuchsia/pink gradient to a neutral indigo→blue→teal one (`#2563eb` / `#4f46e5` / `#0891b2`) across every gradient button, hero card, the aurora background, the sidebar, and the default note-subject color rotation — aiming for a look that reads as universal/tech-premium rather than gendered, for students of any gender worldwide.

## What's built (Phase 6 — Grades / GPA Calculator)

- A user-editable letter-grade → GPA-points scale (`grade_scale_entries`), seeded with a standard US 4.0 scale (A=4.0 … F=0.0) that can be reset or customized per entry
- Per-subject grade entry (credit hours + either a percent or a direct letter grade — a letter wins if both are set) on the Schedule tab's "Grades / GPA" view
- Live cumulative GPA, computed client-side from credit-weighted quality points

## What's built (Phase 5 — Slides & Presentation Generator)

- Topic + selected notes → a slide deck AND a matching presentation script, generated together in one AI call (`supabase/functions/generate-slides`) so the script actually matches what's on each slide
- A single-slide viewer (prev/next, bullets big, script toggle below) plus a print/export view that lays out the whole deck with its script for printing or plain-text download

## What's built (Phase 4 — Gamified Knowledge Stats & Leveling)

- An XP event log (`xp_events`) awarding points for capturing a note, generating a practice set, and — scaled to the score — completing a graded attempt
- A level/XP bar on Home (100 XP per level) and a day-streak counter (consecutive days with any XP-earning activity)
- Per-subject "knowledge score": a recency-weighted average of a subject's graded practice/exam attempts, shown as a mastery badge next to each subject

## What's built (Phase 3 — Timetable & Time Management)

- A weekly recurring class schedule (day, time, location) grouped by day on the Schedule tab
- Standalone reminders (assignment due dates, study sessions, exams) with an in-app browser-notification poller (`useReminderNotifications`) that fires while the app is open — see "Notes on choices made" below for why this isn't a true push-notification system yet
- Mark-done / delete for reminders, sorted upcoming-first

## What's built (Phase 2 — AI Practice & Test Generation)

- AI practice/exam generation from one note, several notes, or a whole subject (`supabase/functions/generate-practice`), using Claude to write quiz-format (MCQ/true-false/fill-blank) or exam-format (short-answer/essay) questions matching the plan's spec
- Rubric-based grading (`supabase/functions/grade-attempt`): objective questions checked directly, essay/short-answer graded against an AI-generated rubric with partial credit — a real academic standard, not keyword matching
- A Practice tab: pick a subject + notes → generate → take it → see per-question scored feedback and past attempts

## What's built (Phase 1 — Capture & Notes)

- Auth (Supabase email/password, PKCE flow)
- Semesters → subjects/courses → one note per class session
- Voice recording (browser `MediaRecorder`) and manual typed notes, both fully editable
- Attach lecturer materials (PDFs/slides) to a note
- Export (plain text) and print
- A pluggable transcription layer (`supabase/functions/transcribe-audio`) with adapters for Deepgram, OpenAI, AssemblyAI, and ElevenLabs — no engine is picked yet (see "Open decision" below), so until one is configured, voice notes save with a placeholder instead of a real transcript
- App shell with Home / Notes / Practice / Slides / Schedule tabs, responsive across phone/tablet/desktop widths

## Not built yet

7. Final commercial-launch polish pass (this already uses per-user accounts, RLS, and responsive layout from day one, so no rearchitecture is needed — this is copy/UX refinement once you've used the app for real)
- Picking and wiring a transcription engine (see "Open decision" below) — voice notes save with a placeholder transcript until one is configured
- True push notifications for reminders (current version only alerts while the app tab is open — see "Notes on choices made")

## Setup

1. **Supabase**: create a project, then run every file in `supabase/migrations/` **in order** (`0001_init.sql` through `0010_gamification_v2.sql`) in its SQL editor. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from Settings → API.
2. **Install & run**: `npm install`, then `npm run dev`.
3. **Deploy the edge functions** (needs the [Supabase CLI](https://supabase.com/docs/guides/cli)):
   ```
   supabase login
   supabase link --project-ref <your-project-ref>   # ref is the xxxx in https://xxxx.supabase.co
   supabase functions deploy transcribe-audio
   supabase functions deploy transcribe-image
   supabase functions deploy get-shared
   supabase functions deploy generate-practice
   supabase functions deploy grade-attempt
   supabase functions deploy generate-slides
   supabase functions deploy add-friend
   supabase functions deploy get-friends
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
   Get an Anthropic API key at console.anthropic.com — this is what powers practice/exam generation, grading, slide/script generation, and now handwritten-note OCR too (same Haiku-for-cost choice IELTSGate made; no separate OCR key needed). If you already have `generate-practice` deployed from before, redeploy it — it changed this round to also read attached study materials.
4. **Transcription engine (open decision)**: the plan flags this as the biggest technical risk — most STT is tuned for clean audio, not a real lecture hall. Before picking one, test 2-3 of Deepgram Nova-3 / GPT-4o Transcribe / AssemblyAI Universal-2 / ElevenLabs Scribe against a clean clip, a noisy classroom clip, and a jargon-heavy clip. Once decided:
   ```
   supabase secrets set TRANSCRIPTION_ENGINE=deepgram DEEPGRAM_API_KEY=...
   ```
5. **Android**: `npm run build && npx cap sync android`, then open `android/` in Android Studio, or let CI build it (see below).

## CI / deploy

- **Web**: connect this repo to Vercel (dashboard → New Project → import repo) and set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in the Vercel project's env vars. Every push to `main` auto-deploys.
- **Android**: `.github/workflows/android-build.yml` builds a signed `.aab` on every push touching app code. Required repo secrets: `ANDROID_KEYSTORE_BASE64`, `RELEASE_STORE_PASSWORD`, `RELEASE_KEY_ALIAS`, `RELEASE_KEY_PASSWORD`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Generate a release keystore locally, base64-encode it, and add it as a secret — keep the original somewhere safe, since losing it means you can never update the app under the same Play Store listing again.

## Notes on choices made

- **RLS everywhere**: every table is user-scoped with a policy checking `auth.uid() = user_id`; storage buckets (`lecture-audio`, `note-materials`) are scoped by a `<user_id>/...` folder prefix policy. Nothing here trusts the client.
- **One note per subject per day is a soft default, not a hard constraint**: the UI looks up an existing note for today before creating a new one (so recording twice the same day continues the same note), but there's no DB-level unique constraint blocking a genuine second session.
- **Transcript stays editable**: a voice note's transcript is merged into the same editable `content` field the manual-typing flow uses, with the raw untouched transcript kept separately in `raw_transcript` for reference — so "record → fix a few misheard words → done" is one continuous flow, not two separate views.
- **XP is an event log, not a counter**: `xp_events` stores one row per activity instead of a single running total, so both the lifetime level and the day-streak (distinct activity dates) come from the same table without a second write path that could drift out of sync.
- **Reminders are polled, not pushed**: real push notifications need a service worker plus a push server round-trip, which is meaningfully more infrastructure than this phase needs. Instead, `useReminderNotifications` polls every 30s while the app is open and fires a browser `Notification` for anything due — good enough for someone actively using the app, but it won't wake a closed tab. This is a deliberate scope line for this phase, not an oversight; upgrading to real push is a self-contained follow-up (a service worker + a scheduled server function) if you want a closed-app alert later.
- **A letter grade overrides a percent, not the other way round**: `course_grades` stores both so you can track an in-progress percent before a final letter is assigned, but GPA math always prefers an explicit letter when both are present.
- **Knowledge score is recency-weighted, not a flat average**: a subject's mastery badge weights its most recent graded attempts more heavily (harmonic weighting over the last 10), so recent improvement moves the number faster than one old bad attempt can hold it down.
