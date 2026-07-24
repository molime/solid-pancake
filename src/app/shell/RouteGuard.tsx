import { useAuth } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Navigate } from 'react-router-dom'
import type { PropsWithChildren } from 'react'
import { AppLoader } from '@/shared/ui/AppLoader'
import { isPlatformTrainingComplete } from '@/features/onboarding/model/trainingCompletion'
import { useTenant } from '@/app/useTenant'

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

  const membership = useQuery(
    api.members.checkMembership,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  if (isLoading) {
    return <AppLoader fullScreen />
  }

  if (!clerkOrgId) {
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
  const { clerkOrgId, isLoading } = useTenant()
  const member = useQuery(
    api.members.me,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  if (isLoading || !clerkOrgId || member === undefined) {
    return <AppLoader fullScreen label="Checking access" />
  }

  if (!member) {
    return <Navigate to="/select-agency" replace />
  }

  if (!allowedRoles.includes(member.role)) {
    const fallback =
      member.role === 'org:caregiver'
        ? '/caregiver/today'
        : member.role === 'org:candidate'
          ? '/onboarding'
          : '/'
    return <Navigate to={fallback} replace />
  }

  return <>{children}</>
}
export function TrainingRouteGuard({ children }: PropsWithChildren) {
  const { clerkOrgId, isLoading } = useTenant()
  const member = useQuery(
    api.members.me,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const completions = useQuery(
    api.platformTrainingCompletions.listMyCompletions,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  if (isLoading || !clerkOrgId || member === undefined || completions === undefined) {
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

