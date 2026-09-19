import { useState, type FormEvent } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { useAuthStore } from '../store/authStore'

export default function AuthPage() {
  const { user } = useAuthStore()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
        if (signUpError) throw signUpError
        setNotice('Account created. Check your email to confirm, then sign in.')
        setMode('signin')
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
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
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Scholar</h1>
          <p className="text-sm text-muted">Class to Exam</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            Supabase isn't configured yet (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing), so
            sign-in will fail until that's wired up.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'signup' && (
            <input
              type="text"
              required
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field"
            />
          )}
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
          />

          {error && <p className="text-xs text-red-500">{error}</p>}
          {notice && <p className="text-xs text-emerald-500">{notice}</p>}

          <button type="submit" disabled={loading} className="btn-primary mt-1">
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
            setNotice(null)
          }}
          className="mt-4 w-full text-center text-xs text-muted"
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>

        <p className="mt-5 text-center text-[10.5px] text-muted">
          By continuing you agree to Scholar's{' '}
          <Link to="/terms" className="text-indigo-500">
            Terms
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="text-indigo-500">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
