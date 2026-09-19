import { Link } from 'react-router-dom'

// A plain error banner, or — when the error came from an edge function's
// free-tier limit (see src/lib/entitlements.ts's LimitReachedError) — the
// same banner with an inline "Upgrade" link, so hitting a monthly cap reads
// as "here's how to get more" rather than a dead-end failure.
export function ErrorBanner({ message, showUpgrade }: { message: string; showUpgrade?: boolean }) {
  return (
    <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-500">
      {message}
      {showUpgrade && (
        <>
          {' '}
          <Link to="/upgrade" className="font-semibold underline">
            Upgrade to Scholar Pro →
          </Link>
        </>
      )}
    </p>
  )
}
