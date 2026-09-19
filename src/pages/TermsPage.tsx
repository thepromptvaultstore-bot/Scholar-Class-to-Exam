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

export default function TermsPage() {
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
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Terms of Service</h1>
            <p className="mt-1 text-xs text-muted">Last updated: {LAST_UPDATED}</p>
          </div>

          <p className="text-sm leading-relaxed text-muted">
            These terms govern your use of Scholar: Class to Exam ("Scholar", "the app", "we"). By creating an
            account or using the app, you agree to these terms. If you don't agree, please don't use Scholar.
          </p>

          <Section title="1. What Scholar is">
            <p>
              Scholar helps students capture class notes (typed, voice-recorded, or scanned) and turn them into
              study material — quizzes, exams, slide decks, and a study schedule — with the help of AI. It also
              includes optional gamification features (streaks, XP, levels, badges, and a friends-only weekly
              league) to help you build a consistent study habit.
            </p>
          </Section>

          <Section title="2. Your account">
            <p>
              You need an account to use Scholar. You're responsible for keeping your login credentials secure and
              for all activity under your account. You must provide accurate information and are responsible for
              keeping it up to date.
            </p>
          </Section>

          <Section title="3. Your content">
            <p>
              You own the notes, recordings, images, and other material you create or upload in Scholar ("your
              content"). By using the app, you grant us a limited license to store, process, and transmit your
              content solely as needed to operate the app's features — including sending the relevant note text or
              file to our AI provider when you use an AI-powered feature (see our{' '}
              <Link to="/privacy" className="text-indigo-500">
                Privacy Policy
              </Link>{' '}
              for details). We don't claim ownership of your content, and we don't use it to train AI models.
            </p>
            <p>
              You're responsible for the content you create and share, and for having the right to upload any
              material (such as a photo of a professor's handout) that isn't originally yours.
            </p>
          </Section>

          <Section title="4. AI-generated content">
            <p>
              Quizzes, exam questions, slide decks, transcriptions, and grading feedback in Scholar are generated
              by AI based on your notes. AI output can be incomplete or contain mistakes — treat generated practice
              questions, transcripts, and grades as a study aid, not as an authoritative or error-free source, and
              use your own judgment (or check with your instructor) for anything that matters academically.
            </p>
          </Section>

          <Section title="5. Acceptable use">
            <p>You agree not to use Scholar to:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Violate any law, or your school's academic integrity policy;</li>
              <li>Upload content you don't have the right to use, or that infringes someone else's rights;</li>
              <li>Upload malicious files or attempt to disrupt, reverse-engineer, or gain unauthorized access to the app or its infrastructure;</li>
              <li>Harass, impersonate, or share the private information of others, including other users you add as friends.</li>
            </ul>
          </Section>

          <Section title="6. Sharing and friends features">
            <p>
              Content you explicitly share via a link is accessible to anyone with that link. Friends you add via a
              friend code can see your display name, avatar, and your weekly/lifetime XP within the leaderboard —
              nothing else about your account or content is shared with friends.
            </p>
          </Section>

          <Section title="7. Third-party services">
            <p>
              Scholar relies on third-party infrastructure (Supabase for backend/storage, Anthropic's Claude API
              for AI features, and Vercel for web hosting) to operate. Your use of Scholar is also subject to
              those providers continuing to be available; we aren't responsible for outages or changes on their
              end that affect the app.
            </p>
          </Section>

          <Section title="8. Termination">
            <p>
              You can stop using Scholar and request deletion of your account at any time (see our Privacy Policy
              for how). We may suspend or terminate accounts that violate these terms or that we reasonably believe
              are being used abusively or unlawfully.
            </p>
          </Section>

          <Section title="9. Disclaimer and limitation of liability">
            <p>
              Scholar is provided "as is" without warranties of any kind, express or implied. We do not guarantee
              the app will be uninterrupted, error-free, or that AI-generated content will be accurate. To the
              fullest extent permitted by law, we are not liable for any indirect, incidental, or consequential
              damages arising from your use of the app, including academic outcomes based on AI-generated study
              material.
            </p>
          </Section>

          <Section title="10. Changes to these terms">
            <p>
              We may update these terms from time to time. If we make material changes, we'll update the "Last
              updated" date above. Continuing to use Scholar after a change means you accept the updated terms.
            </p>
          </Section>

          <Section title="11. Contact us">
            <p>
              Questions about these terms? Email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-500">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>

        <p className="pb-4 text-center text-[11px] text-muted">
          <Link to="/privacy" className="text-indigo-500">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  )
}
