import { Component, type ErrorInfo, type PropsWithChildren } from 'react'
import { Button } from '@/shared/ui/Button'

interface AppErrorBoundaryState {
  error: Error | null
}

export class AppErrorBoundary extends Component<
  PropsWithChildren,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ATRIA-X app error', error, errorInfo)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-atria-bg p-4">
        <div className="w-full max-w-md rounded-[8px] border border-atria-border bg-atria-surface p-6 text-center shadow-[0_18px_50px_rgba(16,24,40,0.08)]">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[8px] bg-atria-sidebar text-sm font-bold text-white">
            A
          </div>
          <h1 className="text-base font-semibold text-atria-ink">
            ATRIA-X needs a refresh
          </h1>
          <p className="mt-2 text-sm text-atria-muted">
            The app was updated while this session was open. Refresh to load the
            current version.
          </p>
          <Button
            className="mt-5"
            variant="primary"
            onClick={() => window.location.reload()}
          >
            Refresh app
          </Button>
        </div>
      </div>
    )
  }
}
