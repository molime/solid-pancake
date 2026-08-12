import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { SignedInRouteGuard } from './RouteGuard'
import { useUser, useClerk } from '@clerk/react'
import { clearSessionData } from '@/shared/lib/clearSession'
import { cn } from '@/shared/lib/cn'
import {
  CreditCard,
  FileText,
  HeartPulse,
  Building2,
  BarChart3,
  LifeBuoy,
  LogOut,
  ScrollText,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/platform/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/platform/agencies', label: 'Agencies', icon: Building2 },
  { to: '/platform/health', label: 'Tenant Health', icon: HeartPulse },
  { to: '/platform/reports', label: 'Reports', icon: BarChart3 },
  { to: '/platform/support', label: 'Support Access', icon: LifeBuoy },
  { to: '/platform/audit', label: 'Audit Log', icon: ScrollText },
  { to: '/platform/billing', label: 'Billing', icon: FileText },
]

function Wordmark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#22c55e]">
        <span className="text-base font-bold text-[#0b0f10]">A</span>
      </div>
      <div>
        <p className="text-[15px] font-bold leading-tight text-[#f5f7f6]">
          ATRIA-X
        </p>
        <p className="text-[10px] font-medium uppercase tracking-widest text-[#9aa6a8]">
          Platform Control
        </p>
      </div>
    </div>
  )
}

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
      <div className="min-h-screen bg-[#0b0f10]">
        <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[248px] flex-col bg-[#101517] lg:flex">
          <div className="border-b border-[#2a3437] px-5 py-5">
            <Wordmark />
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-colors',
                    isActive
                      ? 'bg-[rgba(34,197,94,0.16)] text-[#22c55e]'
                      : 'text-[#9aa6a8] hover:bg-[#1e2629] hover:text-[#f5f7f6]',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-[-12px] top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-[#22c55e]" />
                    )}
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="space-y-3 border-t border-[#2a3437] p-4">
            <div className="flex items-center gap-3 rounded-lg bg-[#1e2629] px-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(34,197,94,0.16)]">
                <span className="text-sm font-semibold text-[#22c55e]">
                  {user?.firstName?.[0] ?? 'U'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#f5f7f6]">
                  {user?.fullName ?? 'User'}
                </p>
                <p className="truncate text-xs text-[#9aa6a8]">
                  Platform Admin
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#9aa6a8] transition-colors hover:bg-[#1e2629] hover:text-[#f5f7f6]"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>

        <div className="lg:ml-[248px]">
          <header className="flex h-14 items-center justify-between border-b border-[#2a3437] bg-[#101517] px-4 lg:hidden">
            <Wordmark />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-[#9aa6a8] transition-colors hover:text-[#f5f7f6]"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </header>
          <main className="min-h-screen p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SignedInRouteGuard>
  )
}
