import { Link } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'

const LAST_UPDATED = 'September 19, 2026'
const CONTACT_EMAIL = 'thepromptvault.store@gmail.com'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  )
}

export default function PrivacyPolicyPage() {
  return (
    <div className="relative flex min-h-dvh w-full justify-center overflow-x-hidden px-5 py-10">
      <div className="aurora-bg">
        <div className="aurora-blob" />
      </div>
      <div className="grid-overlay" />

      <div className="relative z-10 flex w-full max-w-2xl flex-col gap-6">
        <Link to="/" className="flex items-center gap-2.5 self-start">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5 60%, #0891b2)' }}
          >
            <GraduationCap size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Scholar</p>
            <p className="text-[11px] text-muted">Class to Exam</p>
          </div>
        </Link>

        <div className="glass-card flex flex-col gap-6 rounded-3xl p-7">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Privacy Policy</h1>
            <p className="mt-1 text-xs text-muted">Last updated: {LAST_UPDATED}</p>
          </div>

          <p className="text-sm leading-relaxed text-muted">
            This policy explains what information Scholar: Class to Exam ("Scholar", "the app", "we") collects when
            you use the app, how it is used, and the choices you have. Scholar is built for students to capture
            class notes and turn them into study material; this policy is written to describe exactly what that
            requires and nothing more.
          </p>

          <Section title="1. Information we collect">
            <p>
              <strong className="text-gray-900 dark:text-white">Account information.</strong> When you create an
              account, we (through our backend provider, Supabase) collect your email address and the password you
              set, plus any profile details you choose to add: your name, university/college, and a profile photo.
            </p>
            <p>
              <strong className="text-gray-900 dark:text-white">Your content.</strong> Scholar stores the material
              you create in the app: typed and voice-recorded class notes, photos or PDFs of notes/handouts you
              scan or attach, AI-generated practice questions and quizzes, presentation slides and speaker scripts,
              practice-attempt answers and scores, your class schedule and attendance records, and grade entries you
              add yourself.
            </p>
            <p>
              <strong className="text-gray-900 dark:text-white">Gamification data.</strong> To power streaks, daily
              goals, levels, badges, and the friends leaderboard, we store your XP history, streak and streak-freeze
              counts, daily goal preference, earned badges, your friend code, and the list of friends you've added
              (which is just a link between two user IDs — we don't access your phone's contacts).
            </p>
            <p>
              <strong className="text-gray-900 dark:text-white">What we don't collect.</strong> Scholar does not use
              any third-party analytics, advertising, or crash-reporting SDKs. We don't track your location, and we
              don't access your device's contacts, calendar, or photo library beyond a single image you explicitly
              choose to upload.
            </p>
          </Section>

          <Section title="2. How your information is used">
            <p>Your information is used solely to provide and improve the app's features:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>To create and secure your account, and let you sign back in.</li>
              <li>To store and sync your notes, schedule, and practice history across your devices.</li>
              <li>
                To generate AI features you request — turning notes into quizzes/exams, building slide decks,
                transcribing a voice recording or a scanned photo into text, and grading short-answer/essay
                responses. Generating these requires sending the relevant note text, or the specific
                image/audio/PDF you selected, to the AI provider described in Section 3 — nothing is sent unless
                you trigger that specific feature.
              </li>
              <li>To calculate your XP, streaks, levels, badges, and league standing among the friends you've added.</li>
              <li>To operate a note or practice set you explicitly choose to share via a link with someone else.</li>
            </ul>
            <p>We do not sell your personal information, and we do not use your content to train AI models.</p>
          </Section>

          <Section title="3. Third-party services we use">
            <p>Scholar is built on a small number of infrastructure providers, each processing data only as needed:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-gray-900 dark:text-white">Supabase</strong> — our backend provider. Supabase
                hosts our database, handles sign-in/authentication, and stores uploaded files (note photos/PDFs,
                voice recordings, profile pictures) in secure cloud storage.
              </li>
              <li>
                <strong className="text-gray-900 dark:text-white">Anthropic (Claude API)</strong> — powers the app's
                AI features. When you ask Scholar to generate practice questions or slides, transcribe a recording
                or scanned image, or grade a written answer, the relevant note text or file is sent to Anthropic's
                API to produce that result. Anthropic processes this data to return the response and does not use
                it to train its models under Anthropic's API terms.
              </li>
              <li>
                <strong className="text-gray-900 dark:text-white">Vercel</strong> — hosts the web version of the
                app. Standard web server logs (such as IP address and request timing) are generated by normal web
                hosting and are not linked to your Scholar account content.
              </li>
            </ul>
          </Section>

          <Section title="4. Sharing your content">
            <p>
              Scholar lets you generate a shareable link for a note or a practice set. Anyone with that link can
              view the note, or take a copy of the quiz/exam — the link contains a random token and is not
              discoverable or listed publicly anywhere. You can only share content this way if you actively choose
              to (there is no "share by default" behavior).
            </p>
          </Section>

          <Section title="5. Data retention and deletion">
            <p>
              We keep your account and content for as long as your account is active. You can delete individual
              notes, practice sets, presentations, and other content directly in the app at any time. To delete
              your entire account and all associated data, contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-500">
                {CONTACT_EMAIL}
              </a>{' '}
              and we will remove it within a reasonable time.
            </p>
          </Section>

          <Section title="6. Security">
            <p>
              Data in transit between the app and our servers is encrypted (HTTPS/TLS). Access to your data in our
              database is restricted by row-level security rules so that, with a small number of narrow exceptions
              needed to power features like the friends leaderboard, only you can read your own content. No method
              of transmission or storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </Section>

          <Section title="7. Children's privacy">
            <p>
              Scholar is intended for university/college students and is not directed at children under 13. We do
              not knowingly collect personal information from children under 13. If you believe a child has
              provided us personal information, please contact us and we will delete it.
            </p>
          </Section>

          <Section title="8. Your choices and rights">
            <p>
              You can review and edit your profile information at any time from the Profile tab in the app.
              Depending on where you live, you may have additional rights over your personal data (such as
              access, correction, deletion, or portability) — contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-500">
                {CONTACT_EMAIL}
              </a>{' '}
              to exercise them.
            </p>
          </Section>

          <Section title="9. Changes to this policy">
            <p>
              We may update this policy from time to time. If we make material changes, we will update the "Last
              updated" date above. Continuing to use Scholar after a change means you accept the updated policy.
            </p>
          </Section>

          <Section title="10. Contact us">
            <p>
              Questions about this policy or your data? Email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-500">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>

        <p className="pb-4 text-center text-[11px] text-muted">
          <Link to="/terms" className="text-indigo-500">
            Terms of Service
          </Link>
        </p>
      </div>
    </div>
  )
}
