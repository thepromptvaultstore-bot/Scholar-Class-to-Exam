import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

// Landing page for the link in a "reset your password" email. Supabase's
// client (PKCE flow) auto-exchanges the `code` in the URL for a temporary
// recovery session as soon as this page loads — we just wait for either the
// PASSWORD_RECOVERY auth event or a session to show up, then let the user
// set a new password via supabase.auth.updateUser(). An expired/already-used
// link fails that exchange, so a timeout with no session means "invalid".
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error')) {
      setStatus('invalid')
      return
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStatus('ready')
    })
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStatus('ready')
    })
    const timer = window.setTimeout(() => {
      setStatus((s) => (s === 'checking' ? 'invalid' : s))
    }, 6000)

    return () => {
      subscription.unsubscribe()
      window.clearTimeout(timer)
    }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setDone(true)
      setTimeout(() => navigate('/'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex h-dvh w-full items-center justify-center overflow-hidden px-6">
      <div className="aurora-bg">
        <div className="aurora-blob" />
      </div>
      <div className="grid-overlay" />

      <div className="glass-card relative z-10 w-full max-w-sm rounded-3xl p-7 shadow-2xl">
        <div className="mb-8 flex flex-col items-center gap-2.5 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-white"
            style={{
              background: 'linear-gradient(135deg, #2563eb, #4f46e5 60%, #0891b2)',
              boxShadow: '0 10px 24px -8px rgba(37, 99, 235, 0.6)',
            }}
          >
            <GraduationCap size={28} />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Reset your password</h1>
        </div>

        {status === 'checking' && <p className="text-center text-sm text-muted">Verifying your reset link…</p>}

        {status === 'invalid' && (
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm text-red-500">
              This reset link is invalid or has expired. Request a new one from the sign-in page.
            </p>
            <Link to="/auth" className="btn-primary">
              Back to sign in
            </Link>
          </div>
        )}

        {status === 'ready' && !done && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="password"
              required
              minLength={6}
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              autoFocus
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input-field"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary mt-1">
              {loading ? 'Saving…' : 'Set new password'}
            </button>
          </form>
        )}

        {done && <p className="text-center text-sm text-emerald-500">Password updated — taking you back in…</p>}
      </div>
    </div>
  )
}
