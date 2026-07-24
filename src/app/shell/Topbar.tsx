import { useUser, useClerk } from '@clerk/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { cn } from '@/shared/lib/cn'
import { Menu, LogOut, Building2 } from 'lucide-react'
import { useTenant } from '@/app/useTenant'

function breadcrumbFromPath(path: string): string {
  if (path === '/') return 'Dashboard'
  const segments = path.split('/').filter(Boolean)
  return segments
    .map((s) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(' › ')
}

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { clerkOrgId, tenantName } = useTenant()
  const { user } = useUser()
  const { signOut } = useClerk()
  const navigate = useNavigate()
  const location = useLocation()
  const member = useQuery(
    api.members.me,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const role = member?.role ?? 'org:caregiver'

  return (
    <header className="h-16 bg-atria-surface border-b border-atria-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden p-2 -ml-2 text-atria-muted hover:text-atria-ink"
          aria-label="Open navigation"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-medium text-atria-ink">
          {breadcrumbFromPath(location.pathname)}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/select-agency')}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-atria-border rounded-md hover:bg-atria-bg transition-colors text-atria-ink"
        >
          <Building2 className="h-4 w-4 text-atria-muted" />
          <span className="max-w-[160px] truncate">{tenantName ?? 'Select agency'}</span>
        </button>
        <span
          className={cn(
            'hidden sm:inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
            role === 'org:admin' && 'bg-atria-accent/10 text-atria-accent',
            role === 'org:coordinator' && 'bg-atria-info-bg text-atria-info',
            role === 'org:caregiver' &&
              'bg-atria-success-bg text-atria-success',
          )}
        >
          {role.replace('org:', '')}
        </span>
        <button
          onClick={() => signOut(() => navigate('/sign-in'))}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-atria-muted hover:text-atria-ink hover:bg-atria-bg transition-colors"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
        <div className="h-8 w-8 rounded-full bg-atria-sidebar flex items-center justify-center">
          <span className="text-white text-xs font-semibold">
            {user?.firstName?.[0] ?? 'U'}
          </span>
        </div>
      </div>
    </header>
  )
}
