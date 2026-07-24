import { useOrganization } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

const SELECTED_ORG_STORAGE_KEY = 'atria.selectedClerkOrgId'

/**
 * Persists the tenant a no-org user picked on SelectAgencyPage. Caregivers
 * and candidates hold no Clerk org membership, so there is no Clerk-side
 * "active organization" to switch — the choice lives in localStorage.
 */
export function setSelectedClerkOrgId(clerkOrgId: string | null) {
  if (typeof window === 'undefined') return
  if (clerkOrgId) {
    window.localStorage.setItem(SELECTED_ORG_STORAGE_KEY, clerkOrgId)
  } else {
    window.localStorage.removeItem(SELECTED_ORG_STORAGE_KEY)
  }
}

function getStoredClerkOrgId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(SELECTED_ORG_STORAGE_KEY)
}

/**
 * Resolves the current tenant's Clerk org id for the signed-in user.
 *
 * Admin/HR/coordinator users are Clerk org members, so the org id comes from
 * `useOrganization()`. Caregivers and candidates are regular Clerk users with
 * no org membership, so their tenants are resolved from the `tenantMembers`
 * table via `api.candidates.getMyTenant`. When they belong to multiple
 * tenants, the tenant they picked on SelectAgencyPage (stored in
 * localStorage) wins; otherwise the first membership is used.
 */
export function useTenant() {
  const { organization, isLoaded } = useOrganization()
  const orgClerkOrgId = organization?.id

  const dbTenants = useQuery(
    api.candidates.getMyTenant,
    isLoaded && !orgClerkOrgId ? {} : 'skip',
  )

  const storedClerkOrgId = getStoredClerkOrgId()
  const dbTenant =
    dbTenants?.find((tenant) => tenant.clerkOrgId === storedClerkOrgId) ??
    dbTenants?.[0]

  const clerkOrgId = orgClerkOrgId ?? dbTenant?.clerkOrgId
  const isLoading =
    !isLoaded || (!orgClerkOrgId && dbTenants === undefined)

  return {
    clerkOrgId,
    tenantName: organization?.name ?? dbTenant?.tenantName,
    role: dbTenant?.role,
    isLoading,
  }
}
