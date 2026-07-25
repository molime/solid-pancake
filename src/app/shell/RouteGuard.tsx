import { useAuth } from '@clerk/react'
import { useQuery, useConvexAuth } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Navigate } from 'react-router-dom'
import { useState } from 'react'
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
export function TrainingRouteGuard({ children }: PropsWithChildren) {
  const effectiveClerkOrgId = useEffectiveClerkOrgId()
  const { isLoading: convexAuthLoading } = useConvexAuth()
  const member = useQuery(
    api.members.me,
    effectiveClerkOrgId ? { clerkOrgId: effectiveClerkOrgId } : 'skip',
  )
  const completions = useQuery(
    api.platformTrainingCompletions.listMyCompletions,
    effectiveClerkOrgId ? { clerkOrgId: effectiveClerkOrgId } : 'skip',
  )
  const [hasAuthorized, setHasAuthorized] = useState(false)
  const isReady = effectiveClerkOrgId && member !== undefined && member !== null && completions !== undefined && completions !== null && !convexAuthLoading

  if (isReady && member && !hasAuthorized) {
    setHasAuthorized(true)
  }

  if (!effectiveClerkOrgId || member === undefined || completions === undefined || convexAuthLoading) {
    return hasAuthorized ? <>{children}</> : <AppLoader fullScreen label="Checking training status" />
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

