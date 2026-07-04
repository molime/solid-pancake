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
