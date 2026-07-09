You are implementing ATRIA-X Session 6 frontend code. Produce ONLY a unified diff in git diff format (starting with --- a/... and +++ b/...). Do NOT include explanations, markdown code fences, or any text outside the diff. The diff must apply cleanly with `git apply --whitespace=fix`.

Repo root: C:/Users/pinol/Documents/Work/atriax/solid-pancake
Branch: feature/phase-2-worker-onboarding (do not change branch)
Style: 2-space indent, single quotes, no semicolons. Use existing `src/shared/ui/*` components and `@/shared/lib/cn`. No new dependencies.

EXISTING FILES CONTEXT:
--- src/app/router.tsx ---
import { Navigate, Route, Routes } from 'react-router-dom'
import { CreateOrganization, SignIn, SignUp } from '@clerk/react'
import { Suspense, lazy, type ReactNode } from 'react'
import { AppShell } from './shell/AppShell'
import { PlatformShell } from './shell/PlatformShell'
import { SelectAgencyPage } from './auth/SelectAgencyPage'
import { SignedInRouteGuard, TenantRoleRouteGuard } from './shell/RouteGuard'
import { AppLoader } from '@/shared/ui/AppLoader'

const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)
const CaregiverTodayPage = lazy(() =>
  import('@/features/caregiver/pages/CaregiverTodayPage').then((module) => ({
    default: module.CaregiverTodayPage,
  })),
)
const CoordinatorReviewPage = lazy(() =>
  import('@/features/coordinator/pages/CoordinatorReviewPage').then(
    (module) => ({
      default: module.CoordinatorReviewPage,
    }),
  ),
)
const BillingPage = lazy(() =>
  import('@/features/billing/pages/BillingPage').then((module) => ({
    default: module.BillingPage,
  })),
)
const ClientsPage = lazy(() =>
  import('@/features/clients/pages/ClientsPage').then((module) => ({
    default: module.ClientsPage,
  })),
)
const TeamPage = lazy(() =>
  import('@/features/team/pages/TeamPage').then((module) => ({
    default: module.TeamPage,
  })),
)
const PlatformAdminPage = lazy(() =>
  import('@/features/platform/pages/PlatformAdminPage').then((module) => ({
    default: module.PlatformAdminPage,
  })),
)
const SearchPage = lazy(() =>
  import('@/features/search/pages/SearchPage').then((module) => ({
    default: module.SearchPage,
  })),
)
const GeofenceSettingsPage = lazy(() =>
  import('@/features/settings/pages/GeofenceSettingsPage').then((module) => ({
    default: module.GeofenceSettingsPage,
  })),
)
const SchedulingPage = lazy(() =>
  import('@/features/scheduling/pages/SchedulingPage').then((module) => ({
    default: module.SchedulingPage,
  })),
)
const CaregiverSchedulePage = lazy(() =>
  import('@/features/scheduling/pages/CaregiverSchedulePage').then((module) => ({
    default: module.CaregiverSchedulePage,
  })),
)
const AvailabilityPage = lazy(() =>
  import('@/features/scheduling/pages/AvailabilityPage').then((module) => ({
    default: module.AvailabilityPage,
  })),
)

let ScreenshotHarnessPage: React.LazyExoticComponent<
  () => React.JSX.Element
> | null = null
if (
  import.meta.env.DEV &&
  import.meta.env.VITE_ENABLE_SCREENSHOT_MOCKS === 'true'
) {
  ScreenshotHarnessPage = lazy(() =>
    import('@/dev/ScreenshotHarnessPage').then((module) => ({
      default: module.ScreenshotHarnessPage,
    })),
  )
}

function RouteSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppLoader label="Preparing workspace" />}>
      {children}
    </Suspense>
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/sign-in/*"
        element={
          <div 

--- src/app/shell/AppShell.tsx ---
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { TenantRouteGuard } from './RouteGuard'
import { useState } from 'react'

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <TenantRouteGuard>
      <div className="flex h-screen overflow-hidden bg-atria-bg">
        <Sidebar
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />
        <div className="flex-1 flex flex-col lg:ml-[240px]">
          <Topbar onMenuClick={() => setMobileNavOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </TenantRouteGuard>
  )
}


--- src/app/shell/Sidebar.tsx ---
import { useOrganization, useUser } from '@clerk/react'
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
} from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  roles: string[]
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: <LayoutDashboard className="h-4 w-4" />,
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
    path: '/coordinator/billing',
    icon: <FileText className="h-4 w-4" />,
    roles: ['org:admin', 'org:coordinator'],
  },
  {
    label: 'Clients',
    path: '/clients',
    icon: <Users className="h-4 w-4" />,
    roles: ['org:admin', 'org:coordinator'],
  },
  {
    label: 'Team',
    path: '/team',
    icon: <Building2 className="h-4 w-4" />,
    roles: ['org:admin'],
  },
  {
    label: 'Settings',
    path: '/settings/geofence',
    icon: <MapPin className="h-4 w-4" />,
    roles: ['org:admin', 'org:coordinator'],
  },
]

const platformNavItem: NavItem = {
  label: 'Platform',
  path: '/platform',
  icon: <Globe className="h-4 w-4" />,
  roles: [],
}

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const { organization } = useOrganization()
  const { user } = useUser()
  const location = useLocation()

  const clerkOrgId = organization?.id
  const member = useQuery(api.members.me, clerkOrgId ? { clerkOrgId } : 'skip')

  const role = member?.role ?? 'org:caregiver'

  const isPlatformAdmin = useQuery(api.platform.isAdmin)

  const visibleItems = navItems.filter((item) => item.roles.includes(role))
  const itemsWithPlatform = isPlatformAdmin
    ? [...visibleItems, platformNavItem]
    : visibleItems

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 

--- src/app/shell/RouteGuard.tsx ---
import { useOrganization, useAuth } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Navigate } from 'react-router-dom'
import type { PropsWithChildren } from 'react'
import { AppLoader } from '@/shared/ui/AppLoader'

type TenantRole =
  | 'org:admin'
  | 'org:coordinator'
  | 'org:caregiver'
  | 'org:hr'
  | 'org:candidate'

export function TenantRouteGuard({ children }: PropsWithChildren) {
  const { isLoaded: authLoaded, isSignedIn } = useAuth()

  if (!authLoaded) {
    return <AppLoader fullScreen />
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  return <TenantMembershipGuard>{children}</TenantMembershipGuard>
}

function TenantMembershipGuard({ children }: PropsWithChildren) {
  const { isLoaded, organization } = useOrganization()

  const membership = useQuery(
    api.members.checkMembership,
    isLoaded && organization ? { clerkOrgId: organization.id } : 'skip',
  )

  if (!isLoaded) {
    return <AppLoader fullScreen />
  }

  if (!organization) {
    return <Navigate to="/select-agency" replace />
  }

  if (membership === undefined) {
    return <AppLoader fullScreen label="Opening agency workspace" />
  }

  if (!membership) {
    return <Navigate to="/select-agency" replace />
  }

  return <>{children}</>
}

export function SignedInRouteGuard({ children }: PropsWithChildren) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return <AppLoader fullScreen />
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  return <>{children}</>
}

export function TenantRoleRouteGuard({
  allowedRoles,
  children,
}: PropsWithChildren<{ allowedRoles: TenantRole[] }>) {
  const { organization } = useOrganization()
  const member = useQuery(
    api.members.me,
    organization?.id ? { clerkOrgId: organization.id } : 'skip',
  )

  if (!organization || member === undefined) {
    return <AppLoader fullScreen label="Checking access" />
  }

  if (!member) {
    return <Navigate to="/select-agency" replace />
  }

  if (!allowedRoles.includes(member.role)) {
    return (
      <Navigate
        to={member.role === 'org:caregiver' ? '/caregiver/today' : '/'}
        replace
      />
    )
  }

  return <>{children}</>
}


--- src/shared/ui/index.ts ---
export { Button } from './Button'
export { Badge } from './Badge'
export { Input } from './Input'
export { Textarea } from './Textarea'
export { Select } from './Select'
export { Card, CardHeader, CardTitle, CardContent } from './Card'
export { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from './Table'
export { Separator } from './Separator'
export { Checkbox } from './Checkbox'
export { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './Dialog'
export { StatusBadge } from './StatusBadge'
export { KpiCard } from './KpiCard'
export { FieldGroup } from './FieldGroup'
export { ProgressSteps } from './ProgressSteps'
export { EmptyState } from './EmptyState'
export { Toast } from './Toast'


--- src/shared/ui/Button.tsx ---
import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/cn'

const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-atria-md)] px-4 text-base font-medium transition-colors disabled:pointer-events-none disabled:bg-atria-surface-2 disabled:text-atria-text-disabled disabled:border-atria-border disabled:opacity-100 focus:outline-none focus:ring-2 focus:ring-atria-accent/60 focus:ring-offset-2 focus:ring-offset-atria-bg',
  {
    variants: {
      variant: {
        primary:
          'rounded-full bg-atria-accent text-atria-on-accent hover:bg-atria-accent-hover',
        secondary:
          'border border-atria-border bg-atria-surface text-atria-ink hover:bg-atria-surface-2',
        danger:
          'bg-atria-danger text-white hover:bg-atria-danger/90',
        ghost:
          'text-atria-text-secondary hover:text-atria-ink hover:bg-atria-surface-2',
        sidebar:
          'justify-start rounded-[var(--radius-atria-md)] text-atria-sidebar-text hover:text-atria-sidebar-active hover:bg-white/5',
        sidebarActive:
          'justify-start rounded-[var(--radius-atria-md)] bg-white/10 text-atria-sidebar-active',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-[52px] px-6 text-base',
        icon: 'h-10 w-10 px-0',
        sidebar: 'h-10 px-3',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
)

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>
>

export function Button({
  children,
  className,
  variant,
  size,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonStyles({ variant, size }), className)}
      type="button"
      {...props}
    >
      {children}
    </button>
  )
}


--- src/shared/ui/StatusBadge.tsx ---
import type { PropsWithChildren } from 'react'
import type { ShiftStatus } from '@/shared/domain/types'
import { formatStatusLabel } from '@/shared/format'
import { cn } from '@/shared/utils/cn'

export type StatusBadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const statusVariantMap: Record<ShiftStatus, StatusBadgeVariant> = {
  scheduled: 'warning',
  in_progress: 'info',
  submitted: 'warning',
  needs_correction: 'danger',
  approved: 'success',
  billing_ready: 'info',
}

const variantClasses: Record<StatusBadgeVariant, string> = {
  neutral:
    'border-atria-border-strong bg-atria-neutral-bg text-atria-neutral',
  info:
    'border-atria-info/30 bg-atria-info-bg text-atria-info',
  warning:
    'border-atria-warning/30 bg-atria-warning-bg text-atria-warning',
  danger:
    'border-atria-danger/30 bg-atria-danger-bg text-atria-danger',
  success:
    'border-atria-success/30 bg-atria-success-bg text-atria-success',
}

const variantLabels: Record<StatusBadgeVariant, string> = {
  neutral: 'Neutral',
  info: 'Info',
  warning: 'Warning',
  danger: 'Danger',
  success: 'Success',
}

type StatusBadgeProps = {
  status?: ShiftStatus
  variant?: StatusBadgeVariant
  className?: string
}

export function StatusBadge({
  status,
  variant,
  className,
  children,
}: PropsWithChildren<StatusBadgeProps>) {
  const resolvedVariant = variant ?? (status ? statusVariantMap[status] : 'neutral')
  const label =
    children ?? (status ? formatStatusLabel(status) : variantLabels[resolvedVariant])

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[var(--radius-atria-sm,0.5rem)] border px-2 py-1 text-xs font-semibold',
        variantClasses[resolvedVariant],
        className,
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}


--- src/shared/ui/Checkbox.tsx ---
import type { InputHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        'h-4 w-4 appearance-none rounded border border-atria-border bg-atria-surface-3 text-atria-accent focus:ring-2 focus:ring-atria-accent/60 focus:ring-offset-2 focus:ring-offset-atria-bg disabled:opacity-45',
        className,
      )}
      {...props}
    />
  )
}


--- src/shared/ui/Input.tsx ---
import type { InputHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  controlSize?: 'md' | 'lg'
  hasError?: boolean
}

export function Input({ className, controlSize = 'md', hasError, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'flex w-full rounded-[var(--radius-atria-md)] border bg-atria-surface-3 px-3 text-base text-atria-ink placeholder:text-atria-text-muted/60 focus:outline-none focus:ring-1 focus:ring-atria-accent focus:border-atria-accent disabled:opacity-45',
        controlSize === 'md' && 'h-10',
        controlSize === 'lg' && 'h-[52px]',
        hasError && 'border-atria-danger focus:ring-atria-danger focus:border-atria-danger',
        !hasError && 'border-atria-border',
        className,
      )}
      {...props}
    />
  )
}


--- src/shared/ui/Textarea.tsx ---
import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean
}

export function Textarea({ className, hasError, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-[var(--radius-atria-md)] border bg-atria-surface-3 px-3 py-2 text-base text-atria-ink placeholder:text-atria-text-muted/60 focus:outline-none focus:ring-1 focus:ring-atria-accent focus:border-atria-accent disabled:opacity-45 resize-y',
        hasError && 'border-atria-danger focus:ring-atria-danger focus:border-atria-danger',
        !hasError && 'border-atria-border',
        className,
      )}
      {...props}
    />
  )
}


--- src/shared/ui/Card.tsx ---
import type { PropsWithChildren, HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export function Card({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-atria-lg)] border border-atria-border bg-atria-surface shadow-[var(--shadow-atria-card)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn('px-6 py-5 border-b border-atria-border', className)}>{children}</div>
}

export function CardTitle({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <h3 className={cn('text-lg font-semibold text-atria-ink', className)}>{children}</h3>
}

export function CardContent({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn('p-6', className)}>{children}</div>
}


--- src/shared/ui/Badge.tsx ---
import type { PropsWithChildren } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/cn'

const badgeStyles = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-atria-surface-2 text-atria-text-secondary',
        success: 'bg-atria-success-bg text-atria-success',
        warning: 'bg-atria-warning-bg text-atria-warning',
        danger: 'bg-atria-danger-bg text-atria-danger',
        info: 'bg-atria-info-bg text-atria-info',
        neutral: 'bg-atria-neutral-bg text-atria-neutral',
        accent: 'bg-atria-accent-quiet text-atria-accent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

type BadgeProps = PropsWithChildren<
  React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeStyles>
>

export function Badge({ children, className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeStyles({ variant }), className)} {...props}>{children}</span>
  )
}


--- src/shared/lib/cn.ts ---
export { cn } from '@/shared/utils/cn'


--- src/index.css ---
@import "tailwindcss";

@theme {
  --font-sans: Inter, ui-sans-serif, system-ui, sans-serif;

  /* Default mode: Dark. Source: design-system-tokens.md (v1). */
  --color-atria-bg: #0a0e0f;
  --color-atria-bg-sunken: #070a0b;
  --color-atria-surface: #11171a;
  --color-atria-surface-2: #161d21;
  --color-atria-surface-3: #1c262b;
  --color-atria-sidebar: #0c1113;
  --color-atria-ink: #f2f6f7;
  --color-atria-text-primary: #f2f6f7;
  --color-atria-text-secondary: #aebcc2;
  --color-atria-muted: #6e808a;      /* legacy alias; prefer --color-atria-text-muted */
  --color-atria-text-muted: #6e808a;
  --color-atria-text-disabled: #49575e;
  --color-atria-on-accent: #04140e;
  --color-atria-border: #2a373d;
  --color-atria-border-subtle: #1f2a2f;
  --color-atria-border-strong: #3a4a52;
  --color-atria-accent: #16a34a;
  --color-atria-accent-hover: #15833d;
  --color-atria-accent-quiet: rgba(22, 163, 74, 0.14);
  --color-atria-success: #2fbf71;
  --color-atria-success-bg: rgba(47, 191, 113, 0.14);
  --color-atria-warning: #f0b429;
  --color-atria-warning-bg: rgba(240, 180, 41, 0.14);
  --color-atria-danger: #f0564a;
  --color-atria-danger-bg: rgba(240, 86, 74, 0.14);
  --color-atria-info: #4d8df6;
  --color-atria-info-bg: rgba(77, 141, 246, 0.14);
  --color-atria-neutral: #8a99a0;
  --color-atria-neutral-bg: rgba(138, 153, 160, 0.12);
  --color-atria-sidebar-text: #aebcc2;
  --color-atria-sidebar-active: #f2f6f7;

  /* Step accents used by the Progress Note wizard. */
  --color-atria-step-when: #3b82f6;
  --color-atria-step-what: #a855f7;
  --color-atria-step-how: #f59e0b;
  --color-atria-step-goal: #14b8a6;
  --color-atria-step-issues: #ef4444;
  --color-atria-step-done: #16a34a;

  /* Radius scale. */
  --radius-atria: 8px;
  --radius-atria-sm: 8px;
  --radius-atria-md: 12px;
  --radius-atria-lg: 16px;
  --radius-atria-xl: 20px;
  --radius-atria-pill: 999px;

  /* Sizing / touch targets. */
  --size-control-md: 40px;
  --size-control-lg: 52px;
  --size-tile: 88px;
  --size-sidebar: 248px;
  --size-topbar: 64px;
  --size-kpi-card: 140px;
  --size-avatar: 36px;

  /* Elevation. */
  --shadow-atria-card: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-atria-pop: 0 8px 24px rgba(0, 0, 0, 0.5);
}

:root {
  color: var(--color-atria-ink);
  background: var(--color-atria-bg);
  font-size: 16px;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100svh;
  font-family: var(--font-sans);
  letter-spacing: 0;
}

button,
input,
textarea,
select {
  font: inherit;
}

a {
  color: inherit;
  text-decoration: none;
}

/* Scrollbar styling (dark mode default). */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--color-atria-border-strong);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover

FIGMA SCREEN SPEC:
# ATRIA-X Candidate Portal — Figma Screen Spec

Run directory: `C:/Users/pinol/Documents/Work/atriax/solid-pancake/.hermes-pipeline/20260706_095614`
Exported PNGs: `figma/`

## Ground tokens (from DS — Foundations / inspector + frames)
- Surface 0 (page bg): `#0B0F10`
- Surface 1 / card bg: `#11171A` (closest matching dark card fill; the spec references `#151B1D` for some cards)
- Surface input: `#1E2629`
- Border default: `#2A3437`
- Border green: `#22C55E` (green-500)
- Text primary: `#F5F7F6`
- Text secondary: `#9AA6A8`
- Text muted: `#687173`
- Accent green: `#22C55E`
- Accent amber: `#F59E0B`
- Accent red: `#EF4444`
- Font: Inter, sans-serif
- Border radius: 8px (checkbox), 9px (logo), 10px (inputs), 12px (small cards), 14-16px (pills), 20px (hero cards), 26-28px (buttons), 40px (avatar)
- Touch min 44px, type 13px+ labels, 14-16px body, 17-18px lead, 20-26px headings

## Frame inventory
| Screen | Frame ID | PNG |
|---|---|---|
| Candidate / Application Entry | `157:682` | `figma/Candidate_Application_Entry.png` |
| Candidate / Application Form | `189:2287` | `figma/Candidate_Application_Form.png` |
| Candidate / Application Status | `150:169` | `figma/Candidate_Application_Status.png` |
| Candidate / Onboarding Checklist | `157:832` | `figma/Candidate_Onboarding_Checklist.png` |
| Candidate / Document Upload | `157:860` | `figma/Candidate_Document_Upload.png` |
| Candidate / Acknowledgment Task | `158:905` | `figma/Candidate_Acknowledgment_Task.png` |
| Candidate / Offer & Acceptance | `158:879` | `figma/Candidate_Offer_Acceptance.png` |
| Candidate / Profile View-Edit | `162:1395` | `figma/Candidate_Profile_View_Edit.png` |
| Training Step — Locked | `298:2` | `figma/Candidate_Training_Step_Locked.png` |
| Training Step — Unlocked | `298:3` | `figma/Candidate_Training_Step_Unlocked.png` |
| Training Step — Complete | `298:4` | `figma/Candidate_Training_Step_Complete.png` |

## (1) Application Entry (`157:682`) — /onboarding/application-entry? optional landing
- Mobile frame 390x844, bg `#0B0F10`.
- Top: 36x36 green `#22C55E` rounded logo with bold dark "A" + wordmark "ATRIA-X" 18px bold primary.
- Headline: "Start your application 👋" 26px bold primary.
- Sub: "Fill in the details below. It takes about 5 minutes." 16px secondary.
- Form labels (uppercase 13px semi-bold muted `#687173`): FULL NAME, EMAIL ADDRESS, PHONE NUMBER, POSITION APPLYING FOR.
- Inputs: 342x52, radius 10, bg `#1E2629`, border default except focused/active green. Placeholder secondary.
- Autosave pill: "✓ All changes saved" green text on surface-1 bg, radius 16.
- Primary CTA: 342x56, radius 28, green fill, dark text "Submit application →" 17px bold.
- Footer: privacy line muted, "Already applied? Check your status →" green link.
- **Implementation note:** The task description narrows this to `ApplicationFormPage.tsx` at `/onboarding/application` with fields: Full name (readonly, prefilled), Email (prefilled), Phone (editable), Prior home care experience (textarea), Why you want to join (textarea), Emergency contact name + phone. Use the Form screen tokens. Position field from the Figma is omitted per task.

## (2) Application Form (`189:2287`) — canonical /onboarding/application
- Mobile frame 390x844, bg `#0B0F10`.
- Top left: "← Back" 14px semi-bold green. Top right: 36x36 green logo.
- Title: "Your Application" 26px bold primary.
- Subtitle / section: "Section 1 of 3 — Personal Information" 15px secondary. **Task narrows to single-section form**, but keep progress-bar visual language if relevant.
- Progress track: 342x8, bg `#1E2629`, radius 4; fill green `#22C55E` at 1/3 width.
- Labels uppercase 13px muted, inputs bg `#1E2629`, border default, radius 10, 342x52.
- Readonly prefilled name uses primary text; editable placeholders use secondary.
- Textareas should be taller (min 96px) with same surface/border styling.
- CTA row: Back outline 110x56 radius 28 + Next green 210x56 radius 28.
- **Task fields:** Full name readonly, Email readonly, Phone editable, Prior home care experience textarea, Why you want to join textarea, Emergency contact name + phone.
- **State / behavior:** Inline validation for required fields. Submit calls `submitApplication({ fields: { phone, experience, motivation, emergencyName, emergencyPhone } })`, on success navigate to `/onboarding/status`.

## (3) Application Status (`150:169`) — /onboarding/status
- Mobile frame, bg `#0B0F10`.
- Top: green logo + "ATRIA-X" wordmark.
- Greeting: "Hi Lucía 👋" 26px bold primary.
- Sub: "Here's where your application stands." 16px secondary.
- Status card: 342x110, radius 20, amber surface (opacity 0.16) with amber border, inner label "CURRENT STATUS" 13px bold amber, status "Under review" 22px bold primary, subline secondary 14px.
- Progress tracker: vertical timeline with 24px dots on a 2px line (`#2A3437`).
  - Completed stages: green dot with dark "✓", title primary, subtitle secondary.
  - Current stage: amber dot, title amber.
  - Future stages: gray dot `#2A3437`, title muted.
- Stages (task-mandated 5): 'Applied' (always complete once submitted), 'Under review', 'Decision made', 'Offer', 'Accepted'.
- Highlight current stage from `getCandidateProfile` status.
- If status is `needs_correction`, show amber banner: "Your application needs some corrections — please review and resubmit." with link back to `/onboarding/application`.
- CTA: green 342x56 radius 28 (e.g., "View my documents") + help link.

## (4) Onboarding Checklist (`157:832`) — /onboarding
- Mobile frame, bg `#0B0F10`.
- Top: green logo + "ATRIA-X" wordmark.
- Headline: "Your onboarding checklist" 26px bold primary.
- Sub: "Complete these before your first shift." 15px secondary.
- Progress track 342x8 bg `#1E2629`, fill green; label "N of 5 tasks complete" 13px semi-bold green.
- Task list: rows with 32x32 checkbox/status square left (radius 8), title 16px, optional due subline 13px secondary.
  - Completed: green checkbox with dark "✓", title primary.
  - In progress: amber surface/border checkbox, title amber + due subline.
  - Pending: surface `#1E2629` border `#2A3437` empty checkbox, title secondary.
- CTA at bottom: green 342x56 radius 28 "Next task label →".
- Help link: "Need help? Contact your recruiter →" green 15px medium.
- **Task behavior:** Fetch `listCandidateTasks`. Render task cards with title, `StatusBadge` (Pending / In progress / Completed — color + word), and CTA button:
  - pending → "Start"
  - in_progress → "Continue"
  - completed → "✓ Done" (no action)
  - Route per kind:
    - `form_submission` → `/onboarding/application`
    - `document_upload` → `/onboarding/upload/:taskId`
    - `acknowledgment` → `/onboarding/acknowledgment`
    - `platform_training` → `/onboarding/training`
- When all required tasks complete, show green success banner: "Your profile is ready for review".

## (5) Document Upload (`157:860`) — /onboarding/upload/:taskId
- Mobile frame, bg `#0B0F10`.
- Top: "← Back to checklist" 14px green.
- Title: task title (e.g., "Upload CPR certificate") 26px bold primary.
- Sub: "We accept JPG, PNG, or PDF. Max 10MB." 15px secondary.
- Drop zone: 342x200, bg `#1E2629`, border green dashed, radius 16, centered "📄" 40px + "Tap to choose a file" 16px semi-bold primary + "or take a photo with your camera" 14px secondary.
- Preview card (after select/upload): 342x72, bg green opacity 0.12, border green, radius 12, left "📄" green, file name primary 15px semi-bold, meta secondary 13px, right red "✕".
- Expiry field label "CERTIFICATE EXPIRY DATE" uppercase muted, input `#1E2629` border default, radius 10.
- Footer note: "Your documents are encrypted and only seen by your recruiter." 13px muted.
- Submit CTA: green 342x56 radius 28 "Submit document".
- **Task behavior:** On file select, upload via Convex `generateUploadUrl` + HTTP POST, then `addCandidateDocument`. On success show preview card with "Uploaded ✓", then navigate back to `/onboarding` after a moment.

## (6) Acknowledgment Task (`158:905`) — /onboarding/acknowledgment
- Mobile frame, bg `#0B0F10`.
- Top: "← Back to checklist" 14px green.
- Title: "Read & confirm" 24px bold primary. Subtitle: "HIPAA Privacy & Confidentiality Policy" 15px secondary.
- Document card: 342x360, bg `#151B1D`, border `#2A3437`, radius 16, scrollable, with 3 numbered sections:
  - Section titles 15px bold primary.
  - Body 14px secondary, line-height ~1.21.
- Scroll hint: "↓ Scroll to read the full document" 12px muted.
- Checkbox row: 32x32 green surface/border checkbox with green "✓" when checked, label "I have read and understood this policy" 15px medium primary.
- Signature note: "Your digital signature and timestamp will be recorded." 13px muted (or "Your name serves as your electronic signature.")
- Confirm CTA: 342x56 green radius 28 "Confirm & sign", disabled until checkbox ticked.
- **Task behavior:** On submit call `submitForm` with hardcoded HIPAA form definition. On success navigate to `/onboarding`.

## (7) Offer & Acceptance (`158:879`) — /onboarding/offer
- Mobile frame, bg `#0B0F10`.
- Top: green logo + "ATRIA-X" wordmark.
- Offer hero card: 342x148, bg green opacity 0.12, border green, radius 20.
  - "🎉 YOU HAVE AN OFFER!" 13px bold green.
  - Position "Home Care Aide" 22px bold primary.
  - Agency + location 15px secondary.
  - "Offer expires Jun 24, 2026" 13px secondary.
- Offer details card: 342x248, bg `#151B1D`, border `#2A3437`, radius 16, rows separated by 1px `#2A3437` dividers.
  - Labels uppercase 13px muted; values 17px semi-bold primary; pay rate value in green.
- Accept CTA: 342x56 green radius 28 "✓ Accept this offer".
- Decline CTA: 342x52 surface `#1E2629` border `#2A3437` radius 26, text secondary "No thanks, decline this offer".
- Footer note: "By accepting you agree to the employment terms above." 13px muted.
- **Task behavior:** Accept calls `acceptOffer`, decline calls `rejectOffer`. On accept navigate to `/onboarding/status` with Accepted stage highlighted. Show agency name, position Caregiver, start date from candidate `invitedAt` or TBD, compensation placeholder.

## (8) Profile View-Edit (`162:1395`) — /onboarding/profile
- Mobile frame, bg `#0B0F10`.
- Top: "← Back" 14px green left, "My Profile" 20px bold primary, "Edit" outline button 80x36 radius 18 right.
- Avatar: 80x80 circle (radius 40), green `#16A34A` bg, dark bold initials 28px.
- Name: 22px bold primary.
- Sub: "Applying: Home Care Aide" 15px secondary (use current role/status label).
- Status pill: amber surface opacity 0.16, radius 14, amber dot text "● Screening stage" 13px semi-bold.
- Divider 1px `#2A3437`.
- Read-only rows: label uppercase 13px muted, value 16px medium primary. Rows: FULL NAME, EMAIL, PHONE, YEARS OF EXPERIENCE, AVAILABILITY. **Task narrows edit to PHONE only**; other fields read-only.
- Edit mode: show phone input with same surface/border styling, Save green button.
- Footer hint: "Need to update something? Tap Edit above →" green 14px.
- Data from `getCandidateProfile` / Clerk user: avatar initials from displayName, name, email, phone, start date (createdAt), status badge.

## (9) Platform Training Wizard (`298:2`, `298:3`, `298:4`) — /onboarding/training
- Full-screen page, no sidebar. Logo at top. Mobile-first 390px.
- Frame bg `#0B0F10`.
- Step label: "Step N of 5" 14px semi-bold secondary `#9AA6A8`.
- Progress bar: 342x4, bg `#293429` (or `#1E2629`), fill green `#22C55E`, proportional to completed steps (step 2 = 40%, step 5 = 100%).
- Step title: 26px bold primary, e.g. "Your shifts" / "Getting help".
- Content area: framed card bg `#15251A` (green-tinted surface) with border `#2E3833`, radius 12, fixed height ~380px (≈45% of 844 viewport), scrollable.
- Body text: 15px regular secondary `#9AA6A8`, paragraph spacing, left-aligned.
- Scroll progress bar below content: 342x4 bg `#293429`, fill green, grows 0%→100% with scroll.
- Scroll hint: "Scroll to read" 13px secondary when not bottom; "Read ✓" 13px semi-bold green when at bottom.
- Countdown timer: "XX seconds remaining" 14px secondary while >0; "0 seconds remaining" green semi-bold when 0. Counts down from `minReadSeconds` (45s per step) after step renders; does not pause on scroll.
- Next button: 342x52, radius 26.
  - Disabled until BOTH scrolled to bottom AND timer reaches 0: fill green at 35% opacity, text dark at 50% opacity, label "Next →".
  - Enabled: full green fill, dark bold text "Next →".
- On final step label becomes "Complete training →". On click call `completePlatformTraining` mutation; show loading state on button. On success navigate to `/onboarding` for candidates or `/caregiver/today` for caregivers.
- Back link: "← Back" 14px green, always visible and enabled except on step 1 where it is hidden or shows "Exit".

## State / interaction summary for wizard
- `scrollProgress`: 0–100 derived from content scrollTop vs scrollHeight-clientHeight.
- `secondsRemaining`: counts from `minReadSeconds` down to 0 using `setInterval`, reset on step change, never pauses.
- `nextDisabled = scrollProgress < 100 || secondsRemaining > 0`.
- Final step button label: "Complete training →".

## Router / shell requirements
- Add `/onboarding/*` routes gated to `org:candidate` except `/onboarding/training` which also allows `org:caregiver`.
- Pages: `/onboarding`, `/onboarding/application`, `/onboarding/status`, `/onboarding/upload/:taskId`, `/onboarding/acknowledgment`, `/onboarding/offer`, `/onboarding/profile`, `/onboarding/training`.
- Add `TrainingGate` in `AppShell.tsx` (or new `TrainingGate.tsx`): after tenant/role resolved, if role is `org:caregiver` OR `org:candidate`, call `hasPlatformTrainingCompleted`. If loading show `AppLoader`. If false and path not `/onboarding/training`, render `<Navigate replace to='/onboarding/training' />`. Otherwise render children.
- Update `Sidebar.tsx` so candidate role sees onboarding nav items only.

## Implementation files
- `src/features/onboarding/model/trainingSteps.ts`
- `src/features/onboarding/components/PlatformTrainingWizard.tsx`
- `src/app/shell/TrainingGate.tsx` (or inline in `AppShell.tsx`)
- `src/features/onboarding/pages/CandidateOnboardingPage.tsx`
- `src/features/onboarding/pages/ApplicationFormPage.tsx`
- `src/features/onboarding/pages/ApplicationStatusPage.tsx`
- `src/features/onboarding/pages/DocumentUploadPage.tsx`
- `src/features/onboarding/pages/AcknowledgmentPage.tsx`
- `src/features/onboarding/pages/OfferAcceptancePage.tsx`
- `src/features/onboarding/pages/CandidateProfilePage.tsx`
- `src/app/router.tsx`
- `src/app/shell/Sidebar.tsx`
- Tests alongside each new component/page.

## Style rules
- Single quotes, no semicolons, 2-space indent.
- Use existing `src/shared/ui/*` components + `@/shared/lib/cn`.
- Map all idioms to shared UI primitives; no new dependencies.
- Touch targets ≥44px; type ≥16px body where possible, labels ≥13px.

## Gates
- `npm run lint`
- `npm run typecheck`
- `npm run test` (new tests must pass)
- `npm run build`
- `npm run e2e` (if live Clerk credentials present; otherwise may be red — report honestly)


TASK:
Create these new files exactly as specified, and modify router/sidebar.
1. src/features/onboarding/model/trainingSteps.ts - export type TrainingStep and array of 5 steps (welcome, shifts, documenting, documents, help), each minReadSeconds: 45, bodies ~150-200 words plain/warm.
2. src/features/onboarding/components/PlatformTrainingWizard.tsx - full-screen no-sidebar training wizard. Logo at top. Step indicator 'Step N of 5' + thin progress bar. Scrollable content area ~380px high. Title large bold. Body paragraphs. Scroll progress bar below content (0-100%) with label 'Scroll to read' or green 'Read ✓'. Countdown 'XX seconds remaining' from minReadSeconds, counts down regardless of scroll. Next disabled (35% opacity) until scrollProgress===100 AND seconds===0. Back hidden on step 1, else enabled. Final step button reads 'Complete training'. On complete call completePlatformTraining mutation with clerkOrgId arg, loading state, then navigate /onboarding for candidate or /caregiver/today for caregiver. Dark tokens.
3. src/app/shell/TrainingGate.tsx - new component. Resolve role from api.members.me. If role is org:caregiver or org:candidate, call hasPlatformTrainingCompleted with clerkOrgId arg. Loading -> AppLoader. If false and path not /onboarding/training -> <Navigate replace to='/onboarding/training' />. Else render children.
4. Modify src/app/shell/AppShell.tsx - insert TrainingGate inside TenantRouteGuard before layout.
5. Modify src/app/router.tsx - add /onboarding, /onboarding/application, /onboarding/status, /onboarding/upload/:taskId, /onboarding/acknowledgment, /onboarding/offer, /onboarding/profile, /onboarding/training inside AppShell. Candidate-only routes use TenantRoleRouteGuard allowedRoles=['org:candidate']. /onboarding/training allows ['org:candidate','org:caregiver'].
6. Modify src/app/shell/Sidebar.tsx - add candidate-only nav items: Onboarding (/onboarding), Training (/onboarding/training), Profile (/onboarding/profile). Hide admin/coordinator/caregiver nav when role is org:candidate.

For new files, include the full content in the diff (--- /dev/null, +++ b/...). For modified files, include only the necessary hunks. Ensure the diff is syntactically valid and uses single quotes, no semicolons.
