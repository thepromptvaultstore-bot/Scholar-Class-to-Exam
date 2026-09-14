import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthStore()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    )
  }

  if (!user) return <Navigate to="/auth" replace />

  return <>{children}</>
}
