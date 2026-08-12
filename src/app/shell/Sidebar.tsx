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
  Mail,
  Clock,
  Home,
  ShieldCheck,
  BadgeCheck,
  Banknote,
  BarChart3,
  Bell,
  ScrollText,
} from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useTenant } from '@/app/useTenant'
import { AtriaLogo } from '@/shared/ui/AtriaLogo'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  roles: string[]
  exact?: boolean
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
    path: '/',
    icon: <LayoutDashboard className="h-4 w-4" />,
    roles: ['org:admin', 'org:coordinator'],
  },
  {
    label: 'Admin',
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
    label: 'Reporting',
    path: '/reports',
    icon: <BarChart3 className="h-4 w-4" />,
    roles: ['org:admin'],
  },
  {
    label: 'Audit Trail',
    path: '/audit',
    icon: <ShieldCheck className="h-4 w-4" />,
    roles: ['org:admin', 'org:hr'],
  },
  {
    label: 'Logs',
    path: '/logs',
    icon: <ScrollText className="h-4 w-4" />,
    roles: ['org:admin'],
  },
  {
    label: 'Notifications',
    path: '/notifications',
    icon: <Bell className="h-4 w-4" />,
    roles: ['org:admin', 'org:coordinator', 'org:hr', 'org:caregiver'],
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
    roles: ['org:admin', 'org:coordinator'],
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
    path: '/coordinator/review',
    icon: <ClipboardCheck className="h-4 w-4" />,
    roles: ['org:coordinator', 'org:admin'],
  },
  {
    label: 'Knowledge',
    path: '/search',
    icon: <Search className="h-4 w-4" />,
    roles: ['org:admin', 'org:coordinator', 'org:caregiver'],
  },
  {
    label: 'Billing',
    path: '/billing',
    icon: <FileText className="h-4 w-4" />,
    roles: ['org:admin'],
  },
  {
    label: 'Payroll',
    path: '/billing/payroll',
    icon: <Banknote className="h-4 w-4" />,
    roles: ['org:admin'],
  },
  {
    label: 'Clients',
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
    roles: ['org:admin', 'org:hr'],
  },
  {
    label: 'Employees',
    path: '/hr/employees',
    icon: <Building2 className="h-4 w-4" />,
    roles: ['org:admin', 'org:hr'],
  },
  {
    label: 'Cases',
    path: '/hr/cases',
    icon: <ClipboardCheck className="h-4 w-4" />,
    roles: ['org:admin', 'org:hr'],
  },
  {
    label: 'Settings',
    path: '/settings/geofence',
    icon: <MapPin className="h-4 w-4" />,
    roles: ['org:admin'],
  },
  {
    label: 'Email Domains',
    path: '/settings/allowed-domains',
    icon: <Mail className="h-4 w-4" />,
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
  },
  {
    label: 'Profile',
    path: '/onboarding/profile',
    icon: <Users className="h-4 w-4" />,
    roles: ['org:candidate'],
  },
]

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const { clerkOrgId } = useTenant()
  const { user } = useUser()
  const location = useLocation()

  const member = useQuery(api.members.me, clerkOrgId ? { clerkOrgId } : 'skip')

  const role = member?.role ?? 'org:caregiver'

  const visibleItems = navItems.filter((item) => item.roles.includes(role))

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

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {visibleItems.map((item) => {
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
