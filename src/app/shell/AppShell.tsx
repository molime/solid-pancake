import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { TenantRouteGuard } from './RouteGuard'
import { useState } from 'react'
import { cn } from '@/shared/lib/cn'

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()
  const hideChrome =
    location.pathname.startsWith('/dev/screenshots') ||
    location.pathname.startsWith('/onboarding')

  return (
    <TenantRouteGuard>
      <div className="flex h-screen overflow-hidden bg-atria-bg">
        {!hideChrome && (
          <Sidebar
            mobileOpen={mobileNavOpen}
            onMobileClose={() => setMobileNavOpen(false)}
          />
        )}
        <div
          className={cn(
            'flex flex-1 flex-col',
            hideChrome ? 'w-full' : 'overflow-hidden lg:ml-[240px]',
          )}
        >
          {!hideChrome && (
            <Topbar onMenuClick={() => setMobileNavOpen(true)} />
          )}
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </TenantRouteGuard>
  )
}
