import { useAuth } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Navigate } from 'react-router-dom'
import type { PropsWithChildren } from 'react'
import { AppLoader } from '@/shared/ui/AppLoader'
import { isPlatformTrainingComplete } from '@/features/onboarding/model/trainingCompletion'
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
  // A no-org user's resolved tenant lives in localStorage and is stable
  // across Clerk token refreshes. Fall back to it before concluding the
  // user has no tenant — a momentary undefined from useTenant() must not
  // bounce a resolved caregiver/candidate to /select-agency.
  const effectiveClerkOrgId = clerkOrgId ?? getStoredClerkOrgId() ?? undefined

  const membership = useQuery(
    api.members.checkMembership,
    effectiveClerkOrgId ? { clerkOrgId: effectiveClerkOrgId } : 'skip',
  )

  if (isLoading) {
    return <AppLoader fullScreen />
  }

  if (!effectiveClerkOrgId) {
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
  const member = useQuery(
    api.members.me,
    effectiveClerkOrgId ? { clerkOrgId: effectiveClerkOrgId } : 'skip',
  )

  if (!effectiveClerkOrgId || member === undefined) {
    return <AppLoader fullScreen label="Checking access" />
  }

  if (!member) {
    return <Navigate to="/select-agency" replace />
  }

  if (!allowedRoles.includes(member.role)) {
    return <Navigate to={roleHomePath(member.role)} replace />
  }

  return <>{children}</>
}
export function TrainingRouteGuard({ children }: PropsWithChildren) {
  const effectiveClerkOrgId = useEffectiveClerkOrgId()
  const member = useQuery(
    api.members.me,
    effectiveClerkOrgId ? { clerkOrgId: effectiveClerkOrgId } : 'skip',
  )
  const completions = useQuery(
    api.platformTrainingCompletions.listMyCompletions,
    effectiveClerkOrgId ? { clerkOrgId: effectiveClerkOrgId } : 'skip',
  )

  if (!effectiveClerkOrgId || member === undefined || completions === undefined) {
    return <AppLoader fullScreen label="Checking training status" />
  }

  if (!member) {
    return <Navigate to="/select-agency" replace />
  }

  if (member.role === 'org:caregiver') {
    if (!isPlatformTrainingComplete(completions)) {
      return <Navigate to="/onboarding/training" replace />
    }
  }

  return <>{children}</>
}

