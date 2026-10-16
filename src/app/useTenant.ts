import { useOrganization, useClerk } from '@clerk/react'
import { useQuery, useConvexAuth } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../convex/_generated/api'

const SELECTED_ORG_STORAGE_KEY = 'atria.selectedClerkOrgId'

// The apex domain serving agency workspaces as <agency>.atriaxsolutions.com.
export const APEX_DOMAIN = 'atriaxsolutions.com'
// Subdomains that are not agency workspaces.
const RESERVED_SUBDOMAINS = new Set(['www', 'platform', 'app', 'api'])

function getCurrentSubdomain(): string | null {
  if (typeof window === 'undefined') return null
  const host = window.location.hostname
  const parts = host.split('.')
  // Ignore www and bare apex domains (e.g. atriaxsolutions.com)
  if (parts.length < 3) return null
  return parts[0].toLowerCase()
}

/**
 * The agency workspace subdomain for the current host, or null when the
 * host is not an agency workspace address (apex, www, platform, localhost,
 * Vercel previews, …). Only `<agency>.atriaxsolutions.com` pins the tenant —
 * every other host keeps the legacy Clerk-org/localStorage resolution.
 */
export function getAgencySubdomain(hostname: string): string | null {
  const host = (hostname || '').toLowerCase()
  if (!host.endsWith(`.${APEX_DOMAIN}`)) return null
  const sub = host.slice(0, host.length - APEX_DOMAIN.length - 1)
  if (!sub || sub.includes('.') || RESERVED_SUBDOMAINS.has(sub)) return null
  return sub
}

function normalizeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function slugMatchesSubdomain(slug: string | undefined, subdomain: string | null): boolean {
  if (!slug || !subdomain) return false
  return normalizeSlug(slug).includes(normalizeSlug(subdomain))
}

type DbTenant = {
  clerkOrgId: string
  tenantName: string
  slug?: string
  agencyAddress?: string | null
  role: string
}

export type TenantMismatch = {
  /** Agency workspace subdomain the user is on (e.g. "goldenages"). */
  subdomain: string
  /** Name of the agency that owns the subdomain, once resolved. */
  agencyName: string | null
}

/** The membership whose slug matches the workspace subdomain, if any. */
export function findTenantForSubdomain(
  tenants: DbTenant[] | undefined,
  subdomain: string | null,
): DbTenant | undefined {
  if (!tenants || !subdomain) return undefined
  return tenants.find((t) => slugMatchesSubdomain(t.slug, subdomain))
}

export function pickPreferredDbTenant(
  tenants: DbTenant[] | undefined,
  storedClerkOrgId: string | null,
): DbTenant | undefined {
  if (!tenants || tenants.length === 0) return undefined
  // 1. Explicit stored choice, if it is still a valid membership.
  const stored = storedClerkOrgId
    ? tenants.find((t) => t.clerkOrgId === storedClerkOrgId)
    : undefined
  if (stored) return stored
  // 2. Tenant whose slug matches the current subdomain (e.g. goldenages.atriaxsolutions.com).
  const subdomain = getCurrentSubdomain()
  const subdomainMatch = subdomain
    ? tenants.find((t) => slugMatchesSubdomain(t.slug, subdomain))
    : undefined
  if (subdomainMatch) return subdomainMatch
  // 3. Fall back to the first membership.
  return tenants[0]
}

// How long a resolved membership list must continuously exclude the stored
// tenant before the stored id is cleared. During a Clerk token refresh the
// getMyTenant query resubscribes and can transiently resolve without the
// stored tenant (auth not yet propagated to the fresh subscription);
// clearing on the first such resolution wipes the only stable tenant handle
// a no-org caregiver/candidate has and strands them on /select-agency. A
// genuine revocation persists, so the clear still lands — just deferred.
const STALE_STORED_TENANT_GRACE_MS = 10_000

// Roles that always hold a Clerk org membership (caregivers and candidates
// are DB-only members with no Clerk org to activate).
const CLERK_ORG_ROLES = new Set(['org:admin', 'org:hr', 'org:coordinator'])

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
 *
 * On an agency workspace subdomain (`<agency>.atriaxsolutions.com`) the
 * subdomain is authoritative: the tenant is pinned to the membership whose
 * slug matches the subdomain, ignoring the Clerk active org and the stored
 * pick, so a user can never see one agency's data under another agency's
 * URL. Clerk's active org is synced to the pinned tenant (pages that read
 * `useOrganization()` directly follow along). When the user is not a member
 * of the subdomain's agency the hook reports a `tenantMismatch` instead of
 * silently serving another agency's workspace.
 */
export function useTenant() {
  const { organization, isLoaded } = useOrganization()
  const { setActive } = useClerk()
  const orgClerkOrgId = organization?.id
  const agencySubdomain = getAgencySubdomain(
    typeof window === 'undefined' ? '' : window.location.hostname,
  )

  // The query still runs when a stored id exists so role/tenantName stay
  // fresh and revoked memberships are detected — it just never gates
  // clerkOrgId or isLoading. On an agency subdomain it also runs for Clerk
  // org members, because the subdomain (not the Clerk active org) decides
  // the tenant and the membership list is needed to resolve it.
  const dbTenants = useQuery(
    api.candidates.getMyTenant,
    isLoaded && (!orgClerkOrgId || agencySubdomain) ? {} : 'skip',
  )

  const storedClerkOrgId = getStoredClerkOrgId()
  const dbTenant = pickPreferredDbTenant(dbTenants, storedClerkOrgId)

  // Subdomain pinning. `pinnedTenant` is the live resolution; `lastPinned`
  // keeps the last good pin across transient mid-refresh query drops so the
  // resolved workspace never flaps back into a loader or a mismatch notice.
  const pinnedTenant = findTenantForSubdomain(dbTenants, agencySubdomain)
  const [lastPinned, setLastPinned] = useState<DbTenant | null>(null)
  useEffect(() => {
    if (pinnedTenant && pinnedTenant.clerkOrgId !== lastPinned?.clerkOrgId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastPinned(pinnedTenant)
    }
  }, [pinnedTenant, lastPinned])

  // Wrong-workspace detection: the memberships resolved but none matches the
  // subdomain. When this session never pinned a tenant here the mismatch is
  // derived synchronously — an effect-based flag would let guards redirect
  // to /select-agency in the one-render gap before the effect runs (the
  // picker's auto-select then bounces back: an infinite loop). Only the
  // previously-pinned case goes through the grace timer, so a transient
  // mid-refresh resolution without the pinned tenant can't flash the notice.
  const noMatch =
    !!agencySubdomain && dbTenants !== undefined && !pinnedTenant
  const [graceExpired, setGraceExpired] = useState(false)
  useEffect(() => {
    if (!noMatch) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGraceExpired(false)
      return
    }
    if (!lastPinned) return
    const timeout = setTimeout(
      () => setGraceExpired(true),
      STALE_STORED_TENANT_GRACE_MS,
    )
    return () => clearTimeout(timeout)
  }, [noMatch, lastPinned])
  const mismatchConfirmed = (noMatch && !lastPinned) || (noMatch && graceExpired)

  // Best-effort name of the agency that owns the subdomain, for the
  // wrong-workspace notice. Public query; only runs once a mismatch is
  // confirmed.
  const mismatchAgency = useQuery(
    api.agencyConfig.getPublicAgencyBySubdomain,
    mismatchConfirmed && agencySubdomain
      ? { subdomain: agencySubdomain }
      : 'skip',
  )

  const { isLoading: convexAuthLoading } = useConvexAuth()

  let clerkOrgId: string | undefined
  let resolvedDbTenant = dbTenant
  if (agencySubdomain) {
    const pinned =
      pinnedTenant ??
      (mismatchConfirmed ? undefined : (lastPinned ?? undefined))
    clerkOrgId = pinned?.clerkOrgId
    resolvedDbTenant = pinned
  } else {
    clerkOrgId = orgClerkOrgId ?? storedClerkOrgId ?? dbTenant?.clerkOrgId
  }
  const isLoading =
    !clerkOrgId &&
    !mismatchConfirmed &&
    (!isLoaded || dbTenants === undefined || convexAuthLoading)

  // While a pinned org-member tenant hasn't become Clerk's active org yet
  // (and the Convex JWT still carries the old org claim), server-side org
  // checks would transiently reject the pinned tenant. Guards must wait this
  // out instead of acting on the stale false/error.
  const orgSyncPending =
    !!agencySubdomain &&
    !!pinnedTenant &&
    CLERK_ORG_ROLES.has(pinnedTenant.role) &&
    (orgClerkOrgId !== pinnedTenant.clerkOrgId || convexAuthLoading)

  // Sync side effects with the pinned tenant: align Clerk's active org so
  // pages reading `useOrganization()` directly follow the subdomain (this is
  // what unsticks e.g. Billing when Clerk has no/different active org), and
  // persist the pick for no-org users.
  useEffect(() => {
    if (!agencySubdomain || !pinnedTenant) return
    if (
      CLERK_ORG_ROLES.has(pinnedTenant.role) &&
      orgClerkOrgId !== pinnedTenant.clerkOrgId
    ) {
      const result = setActive?.({ organization: pinnedTenant.clerkOrgId })
      // Transient failures are safe to ignore: the pin above still guards
      // which tenant's data is loaded, and the effect retries on re-render.
      void Promise.resolve(result).catch(() => {})
    }
    if (
      !orgClerkOrgId &&
      getStoredClerkOrgId() !== pinnedTenant.clerkOrgId
    ) {
      setSelectedClerkOrgId(pinnedTenant.clerkOrgId)
    }
  }, [agencySubdomain, pinnedTenant, orgClerkOrgId, setActive])

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
      const preferred = pickPreferredDbTenant(dbTenants, null)
      if (preferred) setSelectedClerkOrgId(preferred.clerkOrgId)
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
    tenantName: agencySubdomain
      ? (resolvedDbTenant?.tenantName ?? organization?.name)
      : (organization?.name ?? dbTenant?.tenantName),
    agencyAddress: resolvedDbTenant?.agencyAddress ?? null,
    role: resolvedDbTenant?.role,
    isLoading,
    orgSyncPending,
    isPinnedWorkspace: !!agencySubdomain,
    tenantMismatch:
      mismatchConfirmed && agencySubdomain
        ? {
            subdomain: agencySubdomain,
            agencyName: mismatchAgency?.name ?? null,
          }
        : null,
  }
}
