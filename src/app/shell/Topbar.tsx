import { useUser, useClerk } from '@clerk/react'
import { clearSessionData } from '@/shared/lib/clearSession'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { cn } from '@/shared/lib/cn'
import { Menu, LogOut, Building2, ChevronLeft, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTenant } from '@/app/useTenant'
import { resolveAgencyLogo } from './agencyLogo'
import { AtriaLogo } from '@/shared/ui/AtriaLogo'

// Navigation targets for the topbar search. Mirrors the sidebar's navItems
// (label/path/roles — Sidebar.tsx owns the canonical list); keywords add
// common aliases so e.g. "payroll" also finds Billing.
const NAV_SEARCH_TARGETS: Array<{
  label: string
  path: string
  roles: string[]
  keywords?: string[]
}> = [
  { label: 'HR Home', path: '/hr', roles: ['org:admin', 'org:hr'] },
  { label: 'Dashboard', path: '/', roles: ['org:admin', 'org:coordinator'] },
  { label: 'Admin', path: '/admin', roles: ['org:admin'] },
  {
    label: 'Compliance',
    path: '/compliance',
    roles: ['org:admin', 'org:coordinator', 'org:hr'],
    keywords: ['credentials', 'documents'],
  },
  {
    label: 'Incidents',
    path: '/incidents',
    roles: ['org:admin', 'org:coordinator', 'org:hr'],
    keywords: ['sir'],
  },
  {
    label: 'EVV Export',
    path: '/evv',
    roles: ['org:admin', 'org:coordinator', 'org:hr'],
  },
  {
    label: 'Employee Performance',
    path: '/reports',
    roles: ['org:admin'],
    keywords: ['reports', 'reporting'],
  },
  {
    label: 'Audit Ready Center',
    path: '/audit',
    roles: ['org:admin', 'org:hr'],
    keywords: ['audit'],
  },
  {
    label: 'Notifications',
    path: '/notifications',
    roles: ['org:admin', 'org:coordinator', 'org:hr', 'org:caregiver'],
  },
  { label: 'Support', path: '/support', roles: ['org:admin', 'org:coordinator'], keywords: ['help'] },
  { label: 'Today', path: '/caregiver/today', roles: ['org:caregiver'] },
  {
    label: 'Schedule',
    path: '/scheduling',
    roles: ['org:admin', 'org:coordinator', 'org:hr'],
    keywords: ['shifts'],
  },
  { label: 'Schedule', path: '/caregiver/schedule', roles: ['org:caregiver'], keywords: ['shifts'] },
  { label: 'Availability', path: '/caregiver/availability', roles: ['org:caregiver'] },
  {
    label: 'Review',
    path: '/coordinator/review',
    roles: ['org:coordinator', 'org:admin'],
    keywords: ['approvals'],
  },
  {
    label: 'Knowledge',
    path: '/search',
    roles: ['org:admin', 'org:coordinator', 'org:hr', 'org:caregiver'],
  },
  {
    label: 'Billing',
    path: '/billing',
    roles: ['org:admin'],
    keywords: ['invoices', 'payments'],
  },
  { label: 'Payroll', path: '/billing/payroll', roles: ['org:admin'], keywords: ['billing'] },
  { label: 'Subscription', path: '/subscription', roles: ['org:admin'], keywords: ['plan'] },
  { label: 'Clients', path: '/clients', roles: ['org:admin'] },
  { label: 'Team', path: '/team', roles: ['org:admin'], keywords: ['staff', 'members'] },
  {
    label: 'Candidates',
    path: '/hr/candidates',
    roles: ['org:admin', 'org:hr', 'org:coordinator'],
    keywords: ['applicants', 'hiring', 'onboarding'],
  },
  {
    label: 'Employees',
    path: '/hr/employees',
    roles: ['org:admin', 'org:hr', 'org:coordinator'],
    keywords: ['staff', 'caregivers'],
  },
  {
    label: 'Cases',
    path: '/hr/cases',
    roles: ['org:admin', 'org:hr'],
    keywords: ['hr cases', 'grievances'],
  },
  {
    label: 'Settings',
    path: '/settings/geofence',
    roles: ['org:admin'],
    keywords: ['geofence'],
  },
  { label: 'Onboarding', path: '/onboarding', roles: ['org:candidate'] },
  { label: 'Training', path: '/onboarding/training', roles: ['org:candidate', 'org:caregiver'] },
  {
    label: 'Training Hub',
    path: '/training',
    roles: ['org:admin', 'org:coordinator', 'org:hr', 'org:caregiver', 'org:candidate'],
    keywords: ['courses', 'training'],
  },
  { label: 'Profile', path: '/onboarding/profile', roles: ['org:candidate'] },
  {
    label: 'Account',
    path: '/account',
    roles: ['org:admin', 'org:coordinator', 'org:hr', 'org:caregiver', 'org:candidate'],
  },
]

function breadcrumbFromPath(path: string): string {
  if (path === '/') return 'Dashboard'
  const segments = path.split('/').filter(Boolean)
  return segments
    .map((s) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(' › ')
}

// The course player lives at /training/<courseId> where courseId is a Convex
// document id — rendering it as a breadcrumb shows meaningless gibberish.
// Show a "Back to training" button there instead.
function isCoursePlayerPath(path: string): boolean {
  const segments = path.split('/').filter(Boolean)
  return (
    segments.length === 2 &&
    segments[0] === 'training' &&
    segments[1] !== 'admin'
  )
}

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { clerkOrgId, tenantName, isLoading } = useTenant()
  const { user } = useUser()
  const { signOut } = useClerk()
  const navigate = useNavigate()

  const handleSignOut = () => {
    clearSessionData()
    signOut(() => navigate('/sign-in'))
  }
  const location = useLocation()
  const member = useQuery(
    api.members.me,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const role = member?.role ?? 'org:caregiver'
  const employerInfo = useQuery(
    api.tenantSettings.getEmployerInfo,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const agencyLogo = resolveAgencyLogo(tenantName, employerInfo?.legalName)

  const coursePlayer = isCoursePlayerPath(location.pathname)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return NAV_SEARCH_TARGETS.filter(
      (target) =>
        target.roles.includes(role) &&
        (target.label.toLowerCase().includes(q) ||
          target.keywords?.some((k) => k.includes(q))),
    ).slice(0, 8)
  }, [searchQuery, role])

  const handleSearchSelect = (path: string) => {
    setSearchQuery('')
    setSearchOpen(false)
    navigate(path)
  }

  return (
    <header className="h-16 bg-atria-surface border-b border-atria-border flex items-center justify-between gap-3 px-4 lg:px-6 sticky top-0 z-30">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          className="lg:hidden p-2 -ml-2 text-atria-muted hover:text-atria-ink"
          aria-label="Open navigation"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* The sidebar (which carries the Atria brand on desktop) is hidden on
            phones, so show the logo here on small screens. */}
        <AtriaLogo className="h-8 w-auto lg:hidden" />
        {coursePlayer ? (
          <button
            type="button"
            onClick={() => navigate('/training')}
            className="flex items-center gap-1.5 text-sm font-medium text-atria-text-secondary hover:text-atria-ink transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to training</span>
          </button>
        ) : (
          <span className="hidden truncate text-sm font-medium text-atria-ink sm:block">
            {breadcrumbFromPath(location.pathname)}
          </span>
        )}
        {/* Navigation search: filters the sidebar's nav targets by the current
            role. Desktop only — the header is too crowded on phones. */}
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-atria-muted" />
          <input
            type="search"
            aria-label="Search navigation"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setSearchOpen(true)
            }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setSearchOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchResults.length > 0) {
                e.preventDefault()
                handleSearchSelect(searchResults[0].path)
              } else if (e.key === 'Escape') {
                setSearchQuery('')
                setSearchOpen(false)
              }
            }}
            className="w-40 rounded-md border border-atria-border bg-atria-bg py-1.5 pl-8 pr-2 text-sm text-atria-ink placeholder:text-atria-muted focus:border-atria-accent focus:outline-none lg:w-52"
          />
          {searchOpen && searchQuery.trim() && (
            <div className="absolute left-0 top-full z-40 mt-1 w-64 rounded-md border border-atria-border bg-atria-surface py-1 shadow-[var(--shadow-atria-card)]">
              {searchResults.length === 0 ? (
                <p className="px-3 py-2 text-sm text-atria-muted">No matches</p>
              ) : (
                searchResults.map((target) => (
                  <button
                    key={target.path}
                    type="button"
                    // onMouseDown fires before the input's onBlur closes the
                    // dropdown, so the click still registers.
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSearchSelect(target.path)
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-atria-ink hover:bg-atria-bg"
                  >
                    <span>{target.label}</span>
                    <span className="text-xs text-atria-muted">{target.path}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        {/* Agency logo is redundant on phones (the agency-name button sits
            right next to it) and crowds the header — desktop only. */}
        {!isLoading && agencyLogo && (
          <img
            src={agencyLogo}
            alt={`${tenantName} logo`}
            className="hidden h-8 w-auto object-contain sm:block"
          />
        )}
        <button
          onClick={() => navigate('/select-agency')}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-atria-border rounded-md hover:bg-atria-bg transition-colors text-atria-ink"
        >
          <Building2 className="h-4 w-4 shrink-0 text-atria-muted" />
          <span className="max-w-[104px] truncate sm:max-w-[160px]">{tenantName ?? 'Select agency'}</span>
        </button>
        <span
          className={cn(
            'hidden sm:inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
            role === 'org:admin' && 'bg-atria-accent/10 text-atria-accent',
            role === 'org:coordinator' && 'bg-atria-info-bg text-atria-info',
            role === 'org:caregiver' &&
              'bg-atria-success-bg text-atria-success',
            role === 'org:hr' && 'bg-atria-warning-bg text-atria-warning',
          )}
        >
          {role === 'org:caregiver' ? 'employee' : role.replace('org:', '')}
        </span>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-atria-muted hover:text-atria-ink hover:bg-atria-bg transition-colors"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
        <button
          onClick={() => navigate('/account')}
          className="h-8 w-8 rounded-full bg-atria-sidebar flex items-center justify-center transition-opacity hover:opacity-80"
          aria-label="Account settings"
        >
          <span className="text-white text-xs font-semibold">
            {user?.firstName?.[0] ?? 'U'}
          </span>
        </button>
      </div>
    </header>
  )
}
