import { useEffect, useState } from 'react'
import { useClerk } from '@clerk/react'
import { clearSessionData } from '@/shared/lib/clearSession'

interface AppLoaderProps {
  label?: string
  fullScreen?: boolean
}

// A loader that never resolves is usually a stale session (expired Clerk org
// context, revoked membership, dropped connection). Rather than spinning
// forever, surface a reset escape hatch after this threshold.
const STALL_THRESHOLD_MS = 15_000

export function AppLoader({
  label = 'Preparing ATRIA-X',
  fullScreen = false,
}: AppLoaderProps) {
  const { signOut } = useClerk()
  const [stalled, setStalled] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setStalled(true), STALL_THRESHOLD_MS)
    return () => clearTimeout(timer)
  }, [])

  const handleReset = () => {
    clearSessionData()
    void Promise.resolve(signOut?.())
      .catch(() => {})
      .finally(() => window.location.assign('/sign-in'))
  }

  return (
    <div
      className={`flex items-center justify-center bg-atria-bg ${
        fullScreen ? 'min-h-screen' : 'h-full min-h-[280px]'
      }`}
    >
      <div className="flex flex-col items-center gap-4 rounded-[var(--radius-atria-lg)] border border-atria-border bg-atria-surface px-8 py-7 shadow-[var(--shadow-atria-pop)]">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-atria-accent/15" />
          <div className="absolute inset-1 rounded-full border-2 border-atria-accent/20 border-t-atria-accent animate-spin" />
          <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-atria-md)] bg-atria-sidebar text-sm font-bold text-white">
            A
          </div>
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-atria-ink">{label}</p>
          <p className="mt-1 text-sm text-atria-text-secondary">
            Securing agency workspace
          </p>
          {stalled && (
            <div className="mt-3 border-t border-atria-border pt-3">
              <p className="text-xs text-atria-text-secondary">
                Taking longer than expected — your session may be stale.
              </p>
              <button
                type="button"
                onClick={handleReset}
                className="mt-1 text-xs font-medium text-atria-accent underline underline-offset-2 hover:text-atria-accent/80"
              >
                Sign out &amp; reset
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
