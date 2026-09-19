import { Component, type ErrorInfo, type ReactNode } from 'react'
import { GraduationCap, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

// Without a boundary, any uncaught render error anywhere in the tree (a bad
// AI response shape, a null field from a half-migrated row, etc.) unmounts
// the whole React tree and leaves the user staring at a blank white screen
// with no way back in — especially bad in the packaged Android app, where
// there's no browser console to explain what happened. This catches that
// and offers a reload instead.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Unhandled error in Scholar UI:', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="relative flex h-dvh w-full flex-col items-center justify-center gap-4 overflow-hidden px-6 text-center">
        <div className="aurora-bg">
          <div className="aurora-blob" />
        </div>
        <div className="grid-overlay" />
        <div
          className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl text-white"
          style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5 60%, #0891b2)' }}
        >
          <GraduationCap size={28} />
        </div>
        <div className="relative z-10">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Something went wrong</h1>
          <p className="mt-1 max-w-xs text-sm text-muted">
            Scholar hit an unexpected error. Your notes and progress are safe — reloading usually fixes this.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary relative z-10 !w-auto px-5"
        >
          <RefreshCw size={15} /> Reload
        </button>
      </div>
    )
  }
}
