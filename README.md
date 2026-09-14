# Scholar: Class to Exam

Phase 1 (Capture & Notes) of the product plan, built and building clean. Same stack as Rise Up / IELTSGate: React + Vite + TypeScript + Tailwind, Supabase backend, Vercel web hosting, Capacitor for the Android shell.

## What's built (Phase 2)

- AI practice/exam generation from one note, several notes, or a whole subject (`supabase/functions/generate-practice`), using Claude to write quiz-format (MCQ/true-false/fill-blank) or exam-format (short-answer/essay) questions matching the plan's spec
- Rubric-based grading (`supabase/functions/grade-attempt`): objective questions checked directly, essay/short-answer graded against an AI-generated rubric with partial credit — a real academic standard, not keyword matching
- A Practice tab: pick a subject + notes → generate → take it → see per-question scored feedback and past attempts

## What's built (Phase 1)

- Auth (Supabase email/password, PKCE flow)
- Semesters → subjects/courses → one note per class session
- Voice recording (browser `MediaRecorder`) and manual typed notes, both fully editable
- Attach lecturer materials (PDFs/slides) to a note
- Export (plain text) and print
- A pluggable transcription layer (`supabase/functions/transcribe-audio`) with adapters for Deepgram, OpenAI, AssemblyAI, and ElevenLabs — no engine is picked yet (see "Open decision" below), so until one is configured, voice notes save with a placeholder instead of a real transcript
- App shell with Home / Notes / Practice / Slides / Schedule tabs — the last three are "Coming soon" placeholders for later phases

## Not built yet (later phases, per the plan's build order)

3. Timetable with reminders
4. Gamified knowledge score / streaks / levels
5. Slides + presentation script generator
6. GPA calculator
7. Full commercial-launch polish (this already uses per-user accounts from day one, so no rearchitecture needed later)

## Setup

1. **Supabase**: create a project, then run `supabase/migrations/0001_init.sql` and `0002_practice.sql` (in that order) in its SQL editor. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from Settings → API.
2. **Install & run**: `npm install`, then `npm run dev`.
3. **Deploy the edge functions** (needs the [Supabase CLI](https://supabase.com/docs/guides/cli)):
   ```
   supabase login
   supabase link --project-ref <your-project-ref>   # ref is the xxxx in https://xxxx.supabase.co
   supabase functions deploy transcribe-audio
   supabase functions deploy generate-practice
   supabase functions deploy grade-attempt
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
   Get an Anthropic API key at console.anthropic.com — this is what powers practice/exam generation and grading (same Haiku-for-cost choice IELTSGate made).
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
