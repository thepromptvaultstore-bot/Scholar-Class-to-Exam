# Play Console "Data safety" form — answers for Scholar: Class to Exam

This form is filled in directly inside Play Console (App content → Data safety) — it can't be uploaded as a file, so here's exactly what to select, based on what the app actually collects (verified against the codebase: Supabase Auth/Database/Storage, and the Anthropic Claude API for AI features; no analytics, ads, or crash-reporting SDKs are used).

## Does your app collect or share any of the required user data types?
**Yes**

## Data types to declare

### Personal info
- **Name** — collected (profile full name), not shared. Optional. Used for: App functionality, Account management.
- **Email address** — collected (Supabase Auth), not shared. Required. Used for: App functionality, Account management.

### Photos
- **Photos** — collected (profile photo, and photos of notes/handouts users choose to scan/attach). Not shared with third parties for their own purposes; processed by our AI provider (Anthropic) only to fulfill the user's own request (e.g. transcribing a scanned page). Optional. Used for: App functionality.

### Audio
- **Voice or sound recordings** — collected (short voice-note recordings of lectures). Not shared with third parties for their own purposes; processed by our AI provider (Anthropic or the configured transcription engine) only to fulfill the user's own request. Optional. Used for: App functionality.

### Files and docs
- **Other files** — collected (PDF study materials the user attaches to a note). Optional. Used for: App functionality.

### App activity
- **Other user-generated content** — collected (notes, practice sets/quizzes, presentations, schedule/attendance, grades). Not shared. Required (this is the core content of the app). Used for: App functionality.
- **App interactions** — *not collected* (no analytics SDK is present).

### App info and performance
- *Not collected* (no crash reporting or analytics SDK is present).

## For every data type above
- **Is this data encrypted in transit?** Yes (HTTPS/TLS to Supabase and to Anthropic).
- **Can users request that this data be deleted?** Yes — describe as: users can delete individual items in-app, and can request full account deletion by emailing thepromptvault.store@gmail.com (matches the Privacy Policy).
- **Is data collection required or optional?** Name/photos/audio/files are optional (users choose whether to add them); email and the notes/practice content the user creates are required for the app to function.

## "Data collected" vs "Data shared" — why almost everything is "collected, not shared"
Play's definition of "shared" specifically means transferring data to a *third party* for that third party's own purposes (e.g. their advertising or analytics). Sending a note's text or a scanned image to Anthropic's API to generate a quiz, transcript, or grade — solely to return the result back to the same user, as part of a feature they explicitly triggered — is a **service provider** relationship, not "sharing" under Play's definition. Declare these fields as *collected* with sharing set to **"No data shared with third parties"**, and (if the form asks about processors) list Supabase and Anthropic as service providers who process data on your behalf.

## Security practices section
- **Data is encrypted in transit:** Yes.
- **Data is encrypted at rest:** Yes (Supabase encrypts data at rest by default).
- **You can request data deletion:** Yes.
- **Independent security review:** No (unless you've had one done).
- **Committed to Play Families Policy / target audience:** Scholar targets university/college students (adults), not children — when Play Console asks for the app's target age group, select 18+ / not designed for children, consistent with the Privacy Policy's "not directed at children under 13" statement.

## A few things to double check yourself before submitting
- If you ever add the Google Sign-In option, an analytics SDK, or a push-notification/crash-reporting tool later, this form needs to be updated to match — Play periodically audits this against the actual APK.
- The **Privacy Policy URL** field in the main store listing should point to `https://<your deployed domain>/privacy` (the page just added to the app, e.g. `https://scholar-class-to-exam.vercel.app/privacy` if that's still your Vercel domain — check your actual production URL).
- This document reflects what the code does today; it is guidance for filling out Play Console, not a substitute for your own review of the finished form, and the in-app Privacy Policy / Terms of Service pages are drafts — worth a quick pass by a lawyer (or at least someone reviewing for your specific country's requirements) before you rely on them as your actual legal policy, especially if you plan to operate in the EU/UK (GDPR) or California (CCPA), which have additional required disclosures this draft doesn't fully cover.
