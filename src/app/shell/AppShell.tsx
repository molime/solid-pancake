import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { BillingNoticeBanner } from './BillingNoticeBanner'
import { TenantRouteGuard } from './RouteGuard'
import { Component, useState, type PropsWithChildren } from 'react'
import { cn } from '@/shared/lib/cn'

// The billing banner is informational chrome — a query failure (e.g. a role
// or membership edge case) must never take the whole shell down with it.
class BannerErrorBoundary extends Component<PropsWithChildren> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error) {
    console.error('Billing notice banner failed:', error)
  }
  render() {
    if (this.state.failed) return null
    return this.props.children
  }
}

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
          {!hideChrome && (
            <BannerErrorBoundary>
              <BillingNoticeBanner />
            </BannerErrorBoundary>
          )}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </TenantRouteGuard>
  )
}
