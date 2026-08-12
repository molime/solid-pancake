import type { ReactNode } from 'react'
import { ShieldAlert } from 'lucide-react'
import { usePlatformAdmin } from '../usePlatformAdmin'

export function PlatformGate({ children }: { children: ReactNode }) {
  const isAdmin = usePlatformAdmin()

  if (isAdmin === undefined) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center">
        <div className="text-sm text-[#9aa6a8]">Checking access…</div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <ShieldAlert className="h-10 w-10 text-[#ef4444]" />
          <div>
            <p className="text-[15px] font-medium text-[#f5f7f6]">
              Access denied
            </p>
            <p className="mt-1 text-[13px] text-[#9aa6a8]">
              Platform admin privileges are required to view this page.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
