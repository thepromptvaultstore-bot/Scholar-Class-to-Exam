import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
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
    <div className="mx-auto flex h-dvh max-w-md flex-col justify-center bg-white px-6 dark:bg-[#161320]">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white">
          <GraduationCap size={28} />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Scholar</h1>
        <p className="text-sm text-gray-500">Class to Exam</p>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
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
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-900"
          />
        )}
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-900"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-900"
        />

        {error && <p className="text-xs text-red-600">{error}</p>}
        {notice && <p className="text-xs text-emerald-600">{notice}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin')
          setError(null)
          setNotice(null)
        }}
        className="mt-4 text-center text-xs text-gray-500"
      >
        {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
      </button>
    </div>
  )
}
