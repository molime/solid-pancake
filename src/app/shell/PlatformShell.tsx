import { Outlet, useNavigate } from 'react-router-dom'
import { SignedInRouteGuard } from './RouteGuard'
import { useUser, useClerk } from '@clerk/react'
import { clearSessionData } from '@/shared/lib/clearSession'
import { LogOut } from 'lucide-react'

export function PlatformShell() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const navigate = useNavigate()

  const handleSignOut = () => {
    clearSessionData()
    signOut(() => navigate('/sign-in'))
  }

  return (
    <SignedInRouteGuard>
      <div className="flex h-screen overflow-hidden bg-atria-bg">
        <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[240px] flex-col bg-atria-sidebar text-atria-sidebar-text lg:flex">
          <div className="flex h-16 items-center gap-2 border-b border-white/5 px-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-atria-accent">
              <span className="text-xs font-bold text-white">A</span>
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">
              ATRIA-X
            </span>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            <a
              href="/platform"
              className="flex items-center gap-3 rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white"
            >
              Platform
            </a>
          </nav>
          <div className="border-t border-white/5 px-4 py-3 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-atria-accent/20">
                <span className="text-xs font-semibold text-atria-accent">
                  {user?.firstName?.[0] ?? 'U'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white">
                  {user?.fullName ?? 'User'}
                </p>
                <p className="truncate text-[11px] text-atria-sidebar-text/60">
                  platform admin
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-atria-sidebar-text/70 hover:bg-white/5 hover:text-white transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col lg:ml-[240px]">
          <header className="flex h-14 items-center justify-between border-b border-atria-border bg-atria-surface px-4 lg:px-6">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-atria-accent">
                <span className="text-xs font-bold text-white">A</span>
              </div>
              <span className="text-sm font-semibold text-atria-ink">
                ATRIA-X Platform
              </span>
            </div>
            <div className="hidden lg:block" />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-atria-muted hover:text-atria-ink hover:bg-atria-bg transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </header>
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SignedInRouteGuard>
  )
}
