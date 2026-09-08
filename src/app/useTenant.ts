import { useOrganization } from '@clerk/react'
import { useQuery, useConvexAuth } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../convex/_generated/api'

const SELECTED_ORG_STORAGE_KEY = 'atria.selectedClerkOrgId'

// How long a resolved membership list must continuously exclude the stored
// tenant before the stored id is cleared. During a Clerk token refresh the
// getMyTenant query resubscribes and can transiently resolve without the
// stored tenant (auth not yet propagated to the fresh subscription);
// clearing on the first such resolution wipes the only stable tenant handle
// a no-org caregiver/candidate has and strands them on /select-agency. A
// genuine revocation persists, so the clear still lands — just deferred.
const STALE_STORED_TENANT_GRACE_MS = 10_000

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

/**
 * Synchronously reads the tenant a no-org user previously resolved. Stable
 * across Clerk token refreshes, so guards can fall back to it whenever
 * `useTenant()` is momentarily without a clerkOrgId.
 */
export function getStoredClerkOrgId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(SELECTED_ORG_STORAGE_KEY)
}

/**
 * Resolves the current tenant's Clerk org id for the signed-in user.
 *
 * Admin/HR/coordinator users are Clerk org members, so the org id comes from
 * `useOrganization()`. Caregivers and candidates are regular Clerk users with
 * no org membership, so their tenants are resolved from the `tenantMembers`
 * table via `api.candidates.getMyTenant`. Once resolved, the tenant is
 * persisted in localStorage and used synchronously on every later render —
 * a transient `useOrganization()` flap during a Clerk token refresh must
 * never drop the resolved tenant or flip the hook back into a loading state.
 */
export function useTenant() {
  const { organization, isLoaded } = useOrganization()
  const orgClerkOrgId = organization?.id

  // The query still runs when a stored id exists so role/tenantName stay
  // fresh and revoked memberships are detected — it just never gates
  // clerkOrgId or isLoading.
  const dbTenants = useQuery(
    api.candidates.getMyTenant,
    isLoaded && !orgClerkOrgId ? {} : 'skip',
  )

  const storedClerkOrgId = getStoredClerkOrgId()
  const dbTenant =
    dbTenants?.find((tenant) => tenant.clerkOrgId === storedClerkOrgId) ??
    dbTenants?.[0]

  const { isLoading: convexAuthLoading } = useConvexAuth()
  const clerkOrgId = orgClerkOrgId ?? storedClerkOrgId ?? dbTenant?.clerkOrgId
  const isLoading = !clerkOrgId && (!isLoaded || dbTenants === undefined || convexAuthLoading)

  // First-time resolution: persist the query-resolved tenant so later renders
  // (and page reloads) never depend on query timing. Also validates the
  // stored id against live memberships: if the stored tenant stays absent
  // from the user's memberships for the full grace period (revoked access or
  // a different account on the same browser), clear it so the picker flow
  // can run. The clear is deferred so a transient mid-refresh resolution
  // cannot wipe the stored id — the effect cleanup cancels the pending
  // clear as soon as any resolution includes the stored tenant again.
  useEffect(() => {
    if (orgClerkOrgId || !dbTenants) return
    const stored = getStoredClerkOrgId()
    if (!stored) {
      const first = dbTenants[0]
      if (first) setSelectedClerkOrgId(first.clerkOrgId)
      return
    }
    if (dbTenants.some((tenant) => tenant.clerkOrgId === stored)) return
    const timeout = setTimeout(() => {
      if (getStoredClerkOrgId() === stored) setSelectedClerkOrgId(null)
    }, STALE_STORED_TENANT_GRACE_MS)
    return () => clearTimeout(timeout)
  }, [orgClerkOrgId, dbTenants])

  return {
    clerkOrgId,
    tenantName: organization?.name ?? dbTenant?.tenantName,
    agencyAddress: dbTenant?.agencyAddress ?? null,
    role: dbTenant?.role,
    isLoading,
  }
}
