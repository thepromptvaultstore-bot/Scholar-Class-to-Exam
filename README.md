# Scholar: Class to Exam

All 7 modules of the product plan are now built. Same stack as Rise Up / IELTSGate: React + Vite + TypeScript + Tailwind, Supabase backend, Vercel web hosting, Capacitor for the Android shell. Full responsive layout — a sidebar nav on desktop/tablet, a bottom tab bar on mobile — not a phone-width-only shell.

## Premium UI pass

- A dark-first "glass" design system (`src/index.css`): translucent blurred cards, gradient buttons, and a soft animated "aurora" gradient-mesh background rendered in pure CSS behind every screen. This was chosen over stock background photos on purpose — it costs nothing to load, stays crisp at any screen size, needs no image licensing, and keeps working offline in the packaged Android app, while still giving the premium look that was asked for.
- Notes was restructured: an **All notes** tab (search by text, filter by semester/course, browse everything you've ever captured in one place) plus a separate **Semesters & courses** tab for management — rename or delete a semester or a course right there (deleting a semester deletes its courses and notes, with a confirmation first).
- Timetable now has a real weekly grid (like a printed university routine) plus a "Today" agenda strip that highlights what's happening now vs. next, and a "Mark attended" button on today's classes that awards XP — attendance now feeds the leveling system directly.
- Grades/GPA groups courses by semester (or year, or term — whatever you name it), shows each group's own GPA plus one cumulative CGPA, so it works for both semester-system and year-system universities.

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

1. **Supabase**: create a project, then run every file in `supabase/migrations/` **in order** (`0001_init.sql` through `0007_attendance.sql`) in its SQL editor. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from Settings → API.
2. **Install & run**: `npm install`, then `npm run dev`.
3. **Deploy the edge functions** (needs the [Supabase CLI](https://supabase.com/docs/guides/cli)):
   ```
   supabase login
   supabase link --project-ref <your-project-ref>   # ref is the xxxx in https://xxxx.supabase.co
   supabase functions deploy transcribe-audio
   supabase functions deploy generate-practice
   supabase functions deploy grade-attempt
   supabase functions deploy generate-slides
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
   Get an Anthropic API key at console.anthropic.com — this is what powers practice/exam generation, grading, and slide/script generation (same Haiku-for-cost choice IELTSGate made).
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
