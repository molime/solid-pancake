import { useAuth } from '@clerk/react'
import { useQuery, useConvexAuth } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Navigate } from 'react-router-dom'
import { useState } from 'react'
import type { PropsWithChildren } from 'react'
import { AppLoader } from '@/shared/ui/AppLoader'
import { getStoredClerkOrgId, useTenant } from '@/app/useTenant'
import { roleHomePath } from '@/app/roleHomePath'

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
  const { clerkOrgId, isLoading } = useTenant()
  const effectiveClerkOrgId = clerkOrgId ?? getStoredClerkOrgId() ?? undefined
  const [hasAuthorized, setHasAuthorized] = useState(false)

  const membership = useQuery(
    api.members.checkMembership,
    effectiveClerkOrgId ? { clerkOrgId: effectiveClerkOrgId } : 'skip',
  )

  if (membership === true && !hasAuthorized) {
    setHasAuthorized(true)
  }

  if (isLoading) {
    return hasAuthorized ? <>{children}</> : <AppLoader fullScreen />
  }

  if (!effectiveClerkOrgId) {
    return <Navigate to="/select-agency" replace />
  }

  if (membership === undefined || membership === null) {
    return hasAuthorized ? <>{children}</> : <AppLoader fullScreen label="Opening agency workspace" />
  }

  if (membership === false) {
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

// Platform routes (/platform/*) must never be reachable by agency users.
// SignedInRouteGuard alone lets any signed-in user through, so this guard
// additionally requires api.platform.isAdmin before rendering children.
export function PlatformAdminRouteGuard({ children }: PropsWithChildren) {
  const { isLoaded, isSignedIn } = useAuth()
  const isPlatformAdmin = useQuery(api.platform.isAdmin)

  if (!isLoaded) {
    return <AppLoader fullScreen />
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  if (isPlatformAdmin === undefined || isPlatformAdmin === null) {
    return <AppLoader fullScreen label="Checking platform access" />
  }

  if (!isPlatformAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// A no-org user's resolved tenant lives in localStorage and is stable
// across Clerk token refreshes. Role/training guards fall back to it
// before concluding there is no tenant — a momentary undefined from
// useTenant() during a token refresh must not strand a resolved
// caregiver/candidate on a loader or bounce them to /select-agency.
// Authorization is unchanged: every query still re-authorizes the id
// server-side via requireTenant.
function useEffectiveClerkOrgId() {
  const { clerkOrgId } = useTenant()
  return clerkOrgId ?? getStoredClerkOrgId() ?? undefined
}

export function TenantRoleRouteGuard({
  allowedRoles,
  children,
}: PropsWithChildren<{ allowedRoles: TenantRole[] }>) {
  const effectiveClerkOrgId = useEffectiveClerkOrgId()
  const { isLoading: convexAuthLoading } = useConvexAuth()
  const member = useQuery(
    api.members.me,
    effectiveClerkOrgId ? { clerkOrgId: effectiveClerkOrgId } : 'skip',
  )
  // Keep rendering children during a brief Convex query blip (token refresh)
  // so the user doesn't see a flash/reload. Only show the loader on the
  // FIRST render before children have ever been authorized.
  const [hasAuthorized, setHasAuthorized] = useState(false)
  const isReady = effectiveClerkOrgId && member !== undefined && member !== null && !convexAuthLoading

  if (isReady && member && allowedRoles.includes(member.role) && !hasAuthorized) {
    setHasAuthorized(true)
  }

  if (!effectiveClerkOrgId || member === undefined || convexAuthLoading) {
    return hasAuthorized ? <>{children}</> : <AppLoader fullScreen label="Checking access" />
  }

  if (!member) {
    return <Navigate to="/select-agency" replace />
  }

  if (!allowedRoles.includes(member.role)) {
    return <Navigate to={roleHomePath(member.role)} replace />
  }

  return <>{children}</>
}
function areNewCoursesComplete(
  courses: Array<{ requiredRoles?: string[] | null; courseKey: string; _id: string }> | undefined,
  completions: Array<{ trainingId: string; status: string; expiresAt?: string | null }> | undefined,
  role: string,
) {
  if (!courses || courses.length === 0) return false
  const completedIds = new Set(
    (completions ?? [])
      .filter((c) => {
        if (!['complete', 'completed'].includes(c.status)) return false
        if (c.expiresAt && new Date(c.expiresAt).getTime() <= Date.now()) return false
        return true
      })
      .map((c) => c.trainingId),
  )
  const requiredForRole = courses.filter(
    (c) =>
      !c.requiredRoles ||
      c.requiredRoles.length === 0 ||
      c.requiredRoles.includes(role),
  )
  if (requiredForRole.length === 0) return false
  return requiredForRole.every((c) => completedIds.has(c.courseKey))
}

export { areNewCoursesComplete }

/**
 * Post-hire document gate for caregiver dashboard routes. Golden Ages
 * requires hired caregivers to upload their completed HCS 501 personnel
 * record before accessing the dashboard; caregivers of other agencies (or
 * without a candidate record) pass through untouched.
 *
 * Pending training no longer hard-redirects from the dashboard — the
 * caregiver dashboard renders a persistent TrainingReminderBanner instead.
 */
export function PersonnelRecordRouteGuard({ children }: PropsWithChildren) {
  const effectiveClerkOrgId = useEffectiveClerkOrgId()
  const { isLoading: convexAuthLoading } = useConvexAuth()
  const member = useQuery(
    api.members.me,
    effectiveClerkOrgId ? { clerkOrgId: effectiveClerkOrgId } : 'skip',
  )
  const isCaregiver = member?.role === 'org:caregiver'
  const employerInfo = useQuery(
    api.tenantSettings.getEmployerInfo,
    effectiveClerkOrgId && isCaregiver ? { clerkOrgId: effectiveClerkOrgId } : 'skip',
  )
  const personnelRecord = useQuery(
    api.candidates.getMyDocumentUploadStatus,
    effectiveClerkOrgId && isCaregiver
      ? { clerkOrgId: effectiveClerkOrgId, documentType: 'hcs_501' }
      : 'skip',
  )
  const [hasAuthorized, setHasAuthorized] = useState(false)
  const isReady =
    effectiveClerkOrgId &&
    member !== undefined &&
    member !== null &&
    !convexAuthLoading

  if (isReady && member && !hasAuthorized) {
    setHasAuthorized(true)
  }

  if (
    !effectiveClerkOrgId ||
    member === undefined ||
    convexAuthLoading
  ) {
    return hasAuthorized ? <>{children}</> : <AppLoader fullScreen label="Checking access" />
  }

  if (!member) {
    return <Navigate to="/select-agency" replace />
  }

  if (member.role === 'org:caregiver') {
    const isGoldenAges = (employerInfo?.legalName ?? '')
      .toLowerCase()
      .includes('golden')
    if (isGoldenAges && personnelRecord && !personnelRecord.uploaded) {
      return <Navigate to="/personnel-record" replace />
    }
  }

  return <>{children}</>
}

