import { useOrganization, useAuth } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Navigate } from 'react-router-dom'
import type { PropsWithChildren } from 'react'

type TenantRole = 'org:admin' | 'org:coordinator' | 'org:caregiver'

export function TenantRouteGuard({ children }: PropsWithChildren) {
  const { isLoaded, organization } = useOrganization()
  const { isLoaded: authLoaded, isSignedIn } = useAuth()

  const membership = useQuery(
    api.members.checkMembership,
    organization?.id ? { clerkOrgId: organization.id } : 'skip',
  )

  if (!authLoaded || !isLoaded || membership === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-atria-bg">
        <div className="text-sm text-atria-muted">Loading…</div>
      </div>
    )
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  if (!organization) {
    return <Navigate to="/select-agency" replace />
  }

  if (!membership) {
    return <Navigate to="/select-agency" replace />
  }

  return <>{children}</>
}

export function SignedInRouteGuard({ children }: PropsWithChildren) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-atria-bg">
        <div className="text-sm text-atria-muted">Loading…</div>
      </div>
    )
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
    return (
      <div className="flex h-screen items-center justify-center bg-atria-bg">
        <div className="text-sm text-atria-muted">Loading…</div>
      </div>
    )
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
