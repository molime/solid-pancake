import { useUser } from '@clerk/react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Users,
  Search,
  Building2,
  X,
  Globe,
  MapPin,
  Clock,
  Home,
  ShieldCheck,
  BadgeCheck,
  Banknote,
  CreditCard,
  BarChart3,
  Bell,
  LifeBuoy,
  AlertTriangle,
  FileCheck2,
  GraduationCap,
  User,
} from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { getStoredClerkOrgId, useTenant } from '@/app/useTenant'
import { AtriaLogo } from '@/shared/ui/AtriaLogo'
import type { SectionKey } from './sections'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  roles: string[]
  exact?: boolean
  requiresProduct?: string
  hiddenWhenProduct?: string
  section?: SectionKey
}

// Sidebar grouping (label → group). Sectioned menu per agency feedback; an
// unmapped label falls under General.
const NAV_GROUPS: Array<{ key: string; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'work', label: 'Work' },
  { key: 'people', label: 'People' },
  { key: 'learning', label: 'Learning' },
  { key: 'management', label: 'Management' },
  { key: 'general', label: 'General' },
]
const GROUP_BY_LABEL: Record<string, string> = {
  'HR Home': 'overview',
  Dashboard: 'overview',
  Today: 'work',
  Schedule: 'work',
  Availability: 'work',
  Review: 'work',
  Compliance: 'work',
  Incidents: 'work',
  'EVV Export': 'work',
  Candidates: 'people',
  Employees: 'people',
  Team: 'people',
  Clients: 'people',
  Cases: 'people',
  Knowledge: 'learning',
  Onboarding: 'learning',
  Training: 'learning',
  'Training Hub': 'learning',
  Admin: 'management',
  'Employee Performance': 'management',
  'Audit Ready Center': 'management',
  Billing: 'management',
  Payroll: 'management',
  Subscription: 'management',
  Settings: 'management',
}

const navItems: NavItem[] = [
  {
    label: 'HR Home',
    path: '/hr',
    icon: <Home className="h-4 w-4" />,
    roles: ['org:admin', 'org:hr'],
  },
  {
    label: 'Dashboard',
    section: 'dashboard',
    path: '/',
    icon: <LayoutDashboard className="h-4 w-4" />,
    roles: ['org:admin', 'org:coordinator'],
  },
  {
    label: 'Admin',
    section: 'admin',
    path: '/admin',
    icon: <ShieldCheck className="h-4 w-4" />,
    roles: ['org:admin'],
  },
  {
    label: 'Compliance',
    path: '/compliance',
    icon: <BadgeCheck className="h-4 w-4" />,
    roles: ['org:admin', 'org:coordinator', 'org:hr'],
  },
  {
    label: 'Incidents',
    section: 'incidents',
    path: '/incidents',
    icon: <AlertTriangle className="h-4 w-4" />,
    roles: ['org:admin', 'org:coordinator', 'org:hr'],
  },
  {
    label: 'EVV Export',
    section: 'evv',
    path: '/evv',
    icon: <FileCheck2 className="h-4 w-4" />,
    roles: ['org:admin', 'org:coordinator', 'org:hr'],
  },
  {
    label: 'Employee Performance',
    section: 'reporting',
    path: '/reports',
    icon: <BarChart3 className="h-4 w-4" />,
    roles: ['org:admin'],
  },
  {
    label: 'Audit Ready Center',
    section: 'audit',
    path: '/audit',
    icon: <ShieldCheck className="h-4 w-4" />,
    roles: ['org:admin', 'org:hr'],
  },
  {
    label: 'Notifications',
    path: '/notifications',
    icon: <Bell className="h-4 w-4" />,
    roles: ['org:admin', 'org:coordinator', 'org:hr', 'org:caregiver'],
  },
  {
    label: 'Support',
    path: '/support',
    icon: <LifeBuoy className="h-4 w-4" />,
    roles: ['org:admin', 'org:coordinator'],
  },
  {
    label: 'Today',
    path: '/caregiver/today',
    icon: <CalendarDays className="h-4 w-4" />,
    roles: ['org:caregiver'],
  },
  {
    label: 'Schedule',
    path: '/scheduling',
    icon: <CalendarDays className="h-4 w-4" />,
    roles: ['org:admin', 'org:coordinator', 'org:hr'],
  },
  {
    label: 'Schedule',
    path: '/caregiver/schedule',
    icon: <CalendarDays className="h-4 w-4" />,
    roles: ['org:caregiver'],
  },
  {
    label: 'Availability',
    path: '/caregiver/availability',
    icon: <Clock className="h-4 w-4" />,
    roles: ['org:caregiver'],
  },
  {
    label: 'Review',
    section: 'review',
    path: '/coordinator/review',
    icon: <ClipboardCheck className="h-4 w-4" />,
    roles: ['org:coordinator', 'org:admin'],
  },
  {
    label: 'Knowledge',
    path: '/search',
    icon: <Search className="h-4 w-4" />,
    roles: ['org:admin', 'org:coordinator', 'org:hr', 'org:caregiver'],
  },
  {
    label: 'Billing',
    section: 'billing',
    path: '/billing',
    icon: <FileText className="h-4 w-4" />,
    roles: ['org:admin'],
  },
  {
    label: 'Payroll',
    section: 'payroll',
    path: '/billing/payroll',
    icon: <Banknote className="h-4 w-4" />,
    roles: ['org:admin'],
  },
  {
    label: 'Subscription',
    path: '/subscription',
    icon: <CreditCard className="h-4 w-4" />,
    roles: ['org:admin'],
  },
  {
    label: 'Clients',
    section: 'clients',
    path: '/clients',
    icon: <Users className="h-4 w-4" />,
    roles: ['org:admin'],
  },
  {
    label: 'Team',
    path: '/team',
    icon: <Building2 className="h-4 w-4" />,
    roles: ['org:admin'],
  },
  {
    label: 'Candidates',
    path: '/hr/candidates',
    icon: <Users className="h-4 w-4" />,
    roles: ['org:admin', 'org:hr', 'org:coordinator'],
  },
  {
    label: 'Employees',
    path: '/hr/employees',
    icon: <Building2 className="h-4 w-4" />,
    roles: ['org:admin', 'org:hr', 'org:coordinator'],
  },
  {
    label: 'Cases',
    path: '/hr/cases',
    icon: <ClipboardCheck className="h-4 w-4" />,
    roles: ['org:admin', 'org:hr'],
  },
  {
    label: 'Settings',
    section: 'settings',
    path: '/settings/geofence',
    icon: <MapPin className="h-4 w-4" />,
    roles: ['org:admin'],
  },
  {
    label: 'Onboarding',
    path: '/onboarding',
    icon: <ClipboardCheck className="h-4 w-4" />,
    roles: ['org:candidate'],
  },
  {
    label: 'Training',
    path: '/onboarding/training',
    icon: <Globe className="h-4 w-4" />,
    roles: ['org:candidate', 'org:caregiver'],
    hiddenWhenProduct: 'training',
  },
  {
    label: 'Training Hub',
    path: '/training',
    icon: <GraduationCap className="h-4 w-4" />,
    roles: ['org:admin', 'org:coordinator', 'org:hr', 'org:caregiver', 'org:candidate'],
    requiresProduct: 'training',
  },
  {
    label: 'Profile',
    path: '/onboarding/profile',
    icon: <Users className="h-4 w-4" />,
    roles: ['org:candidate'],
  },
  {
    label: 'Account',
    path: '/account',
    icon: <User className="h-4 w-4" />,
    roles: [
      'org:admin',
      'org:coordinator',
      'org:hr',
      'org:caregiver',
      'org:candidate',
    ],
  },
]

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const { clerkOrgId } = useTenant()
  const effectiveClerkOrgId = clerkOrgId ?? getStoredClerkOrgId() ?? undefined
  const { user } = useUser()
  const location = useLocation()

  const member = useQuery(
    api.members.me,
    effectiveClerkOrgId ? { clerkOrgId: effectiveClerkOrgId } : 'skip',
  )
  const hasTrainingProduct = useQuery(
    api.agencyConfig.hasProduct,
    effectiveClerkOrgId
      ? { clerkOrgId: effectiveClerkOrgId, productKey: 'training' }
      : 'skip',
  )
  const disabledSections = useQuery(
    api.agencyConfig.getDisabledSections,
    effectiveClerkOrgId ? { clerkOrgId: effectiveClerkOrgId } : 'skip',
  )
  const branches = useQuery(
    api.agencyConfig.listAllAgencyBranches,
    effectiveClerkOrgId ? { clerkOrgId: effectiveClerkOrgId } : 'skip',
  )

  const role = member?.role ?? 'org:caregiver'

  // Coordinator access differs for ILS-only agencies: no shift scheduling or
  // shift review there. SLS/branched/unbranched agencies are unaffected.
  const branchTypes = new Set(
    (branches ?? [])
      .filter((branch) => branch.active)
      .map((branch) => branch.branchType.toUpperCase()),
  )
  const isIlsOnlyAgency = branchTypes.has('ILS') && !branchTypes.has('SLS')

  const visibleItems = navItems.filter((item) => {
    if (!item.roles.includes(role)) return false
    if (item.section && disabledSections?.includes(item.section)) return false
    if (item.requiresProduct === 'training' && hasTrainingProduct !== true) {
      return false
    }
    if (item.hiddenWhenProduct === 'training' && hasTrainingProduct === true) {
      return false
    }
    if (
      role === 'org:coordinator' &&
      isIlsOnlyAgency &&
      (item.path === '/scheduling' || item.path === '/coordinator/review')
    ) {
      return false
    }
    return true
  })

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[240px] flex-col bg-atria-sidebar text-atria-sidebar-text lg:flex">
        <SidebarContent
          locationPath={location.pathname}
          role={role}
          userName={user?.fullName ?? 'User'}
          userInitial={user?.firstName?.[0] ?? 'U'}
          visibleItems={visibleItems}
        />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/35"
            aria-label="Close navigation"
            onClick={onMobileClose}
          />
          <aside className="relative flex h-full w-[280px] max-w-[82vw] flex-col bg-atria-sidebar text-atria-sidebar-text shadow-xl">
            <button
              className="absolute right-3 top-3 rounded-md p-2 text-atria-sidebar-text hover:bg-white/10 hover:text-white"
              aria-label="Close navigation"
              onClick={onMobileClose}
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent
              locationPath={location.pathname}
              onNavigate={onMobileClose}
              role={role}
              userName={user?.fullName ?? 'User'}
              userInitial={user?.firstName?.[0] ?? 'U'}
              visibleItems={visibleItems}
            />
          </aside>
        </div>
      )}
    </>
  )
}

function SidebarContent({
  locationPath,
  onNavigate,
  role,
  userInitial,
  userName,
  visibleItems,
}: {
  locationPath: string
  onNavigate?: () => void
  role: string
  userInitial: string
  userName: string
  visibleItems: NavItem[]
}) {
  return (
    <>
      <div className="flex h-28 items-center border-b border-white/5 px-4">
        <AtriaLogo className="h-20 px-1" />
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => {
          const groupItems = visibleItems.filter(
            (item) => (GROUP_BY_LABEL[item.label] ?? 'general') === group.key,
          )
          if (groupItems.length === 0) return null
          return (
            <div key={group.key}>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-atria-sidebar-text/50">
                {group.label}
              </p>
              <div className="space-y-1">
                {groupItems.map((item) => {
                  const isActive = item.exact
                    ? locationPath === item.path
                    : locationPath === item.path ||
                      (item.path !== '/' && locationPath.startsWith(`${item.path}/`))
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onNavigate}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-white/10 text-white'
                          : 'hover:bg-white/5 hover:text-white',
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="border-t border-white/5 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-atria-accent/20">
            <span className="text-xs font-semibold text-atria-accent">
              {userInitial}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white">
              {userName}
            </p>
            <p className="truncate text-[11px] text-atria-sidebar-text/60">
              {role.replace('org:', '')}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
