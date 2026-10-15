import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  useTenant,
  setSelectedClerkOrgId,
  getStoredClerkOrgId,
  getAgencySubdomain,
  findTenantForSubdomain,
} from './useTenant'

vi.mock('@clerk/react', async () => {
  const actual =
    await vi.importActual<typeof import('@clerk/react')>('@clerk/react')
  return {
    ...actual,
    useOrganization: vi.fn(),
    useClerk: vi.fn(() => ({ setActive: vi.fn() })),
  }
})

vi.mock('convex/react', async () => {
  const actual =
    await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
    useQuery: vi.fn(),
  }
})

import { useOrganization } from '@clerk/react'
import { useQuery } from 'convex/react'

const STORAGE_KEY = 'atria.selectedClerkOrgId'

function mockOrganization(options: {
  isLoaded?: boolean
  organization?: { id: string; name: string } | null
}) {
  vi.mocked(useOrganization).mockReturnValue({
    isLoaded: options.isLoaded ?? true,
    organization: options.organization ?? null,
  } as unknown as ReturnType<typeof useOrganization>)
}

// Honors the 'skip' argument like the real useQuery: skipped queries
// return undefined.
function mockDbTenants(result: unknown) {
  vi.mocked(useQuery).mockImplementation(((
    _query: unknown,
    args: unknown,
  ) => (args === 'skip' ? undefined : result)) as unknown as typeof useQuery)
}

const caregiverTenant = {
  clerkOrgId: 'org_stored',
  tenantName: 'Stored Agency',
  agencyAddress: null,
  role: 'org:caregiver',
}

describe('useTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('returns the stored clerkOrgId immediately for a no-org user, without waiting for the query', () => {
    setSelectedClerkOrgId('org_stored')
    mockOrganization({ isLoaded: true, organization: null })
    // Query still in flight — it must not gate clerkOrgId or isLoading.
    mockDbTenants(undefined)

    const { result } = renderHook(() => useTenant())

    expect(result.current.clerkOrgId).toBe('org_stored')
    expect(result.current.isLoading).toBe(false)
  })

  it('keeps the query running for freshness even when a stored id exists', () => {
    setSelectedClerkOrgId('org_stored')
    mockOrganization({ isLoaded: true, organization: null })
    mockDbTenants([caregiverTenant])

    renderHook(() => useTenant())

    expect(useQuery).toHaveBeenCalledWith(expect.anything(), {})
  })

  it('keeps a stable clerkOrgId and isLoading:false when useOrganization flaps during a token refresh', () => {
    setSelectedClerkOrgId('org_stored')
    mockOrganization({ isLoaded: true, organization: null })
    mockDbTenants([caregiverTenant])

    const { result, rerender } = renderHook(() => useTenant())
    expect(result.current.clerkOrgId).toBe('org_stored')
    expect(result.current.isLoading).toBe(false)

    // Simulate a Clerk token refresh: isLoaded flaps to false and the
    // organization is momentarily undefined. The query is skipped while
    // isLoaded is false, so it returns undefined too.
    mockOrganization({ isLoaded: false, organization: null })
    rerender()

    expect(result.current.clerkOrgId).toBe('org_stored')
    expect(result.current.isLoading).toBe(false)

    mockOrganization({ isLoaded: true, organization: null })
    rerender()

    expect(result.current.clerkOrgId).toBe('org_stored')
    expect(result.current.isLoading).toBe(false)
  })

  it('persists the query-resolved clerkOrgId when localStorage is empty', () => {
    mockOrganization({ isLoaded: true, organization: null })
    mockDbTenants([caregiverTenant])

    const { result } = renderHook(() => useTenant())

    expect(result.current.clerkOrgId).toBe('org_stored')
    expect(result.current.isLoading).toBe(false)
    expect(getStoredClerkOrgId()).toBe('org_stored')
  })

  it('prefers the Clerk organization id over a stale stored id', () => {
    setSelectedClerkOrgId('org_stored')
    mockOrganization({
      isLoaded: true,
      organization: { id: 'org_real', name: 'Real Agency' },
    })
    mockDbTenants(undefined)

    const { result } = renderHook(() => useTenant())

    expect(result.current.clerkOrgId).toBe('org_real')
    expect(result.current.isLoading).toBe(false)
    // Org users never touch the stored value.
    expect(getStoredClerkOrgId()).toBe('org_stored')
  })

  it('clears the stored id only after it stays absent from the resolved memberships for the full grace period', () => {
    vi.useFakeTimers()
    try {
      setSelectedClerkOrgId('org_revoked')
      mockOrganization({ isLoaded: true, organization: null })
      mockDbTenants([caregiverTenant])

      const { result, rerender } = renderHook(() => useTenant())

      // A mismatch never clears immediately — the clear is deferred so a
      // transient mid-refresh resolution cannot wipe the stored id.
      expect(getStoredClerkOrgId()).toBe('org_revoked')

      act(() => {
        vi.advanceTimersByTime(10_000)
      })

      expect(getStoredClerkOrgId()).toBeNull()
      rerender()
      // Falls back to the first live membership once the stale id is cleared.
      expect(result.current.clerkOrgId).toBe('org_stored')
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the stored id when a mid-refresh resubscribe transiently resolves without it', () => {
    vi.useFakeTimers()
    try {
      setSelectedClerkOrgId('org_stored')
      mockOrganization({ isLoaded: true, organization: null })
      mockDbTenants([caregiverTenant])

      const { result, rerender } = renderHook(() => useTenant())
      expect(result.current.clerkOrgId).toBe('org_stored')

      // Clerk token refresh: isLoaded flaps to false and the getMyTenant
      // query is skipped (returns undefined) while it resubscribes.
      mockOrganization({ isLoaded: false, organization: null })
      rerender()
      expect(result.current.clerkOrgId).toBe('org_stored')

      // The fresh subscription transiently resolves WITHOUT the stored
      // tenant (auth not yet propagated server-side).
      mockOrganization({ isLoaded: true, organization: null })
      mockDbTenants([])
      rerender()

      // Partway through the grace period the stored id must still be there.
      act(() => {
        vi.advanceTimersByTime(5_000)
      })
      expect(getStoredClerkOrgId()).toBe('org_stored')
      expect(result.current.clerkOrgId).toBe('org_stored')
      expect(result.current.isLoading).toBe(false)

      // The correct resolution arrives before the grace period ends and
      // cancels the pending clear.
      mockDbTenants([caregiverTenant])
      rerender()
      act(() => {
        vi.advanceTimersByTime(10_000)
      })
      expect(getStoredClerkOrgId()).toBe('org_stored')
      expect(result.current.clerkOrgId).toBe('org_stored')
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports loading while a first-time no-org resolution is in flight', () => {
    mockOrganization({ isLoaded: true, organization: null })
    mockDbTenants(undefined)

    const { result } = renderHook(() => useTenant())

    expect(result.current.clerkOrgId).toBeUndefined()
    expect(result.current.isLoading).toBe(true)
  })

  it('resolves the stored tenant details from the query for role and tenantName', () => {
    setSelectedClerkOrgId('org_stored')
    mockOrganization({ isLoaded: true, organization: null })
    mockDbTenants([caregiverTenant])

    const { result } = renderHook(() => useTenant())

    expect(result.current.tenantName).toBe('Stored Agency')
    expect(result.current.role).toBe('org:caregiver')
  })

  it('exposes the stored id through getStoredClerkOrgId', () => {
    expect(getStoredClerkOrgId()).toBeNull()
    setSelectedClerkOrgId('org_x')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('org_x')
    expect(getStoredClerkOrgId()).toBe('org_x')
    setSelectedClerkOrgId(null)
    expect(getStoredClerkOrgId()).toBeNull()
  })
})

describe('getAgencySubdomain', () => {
  it('returns the subdomain on agency workspace hosts', () => {
    expect(getAgencySubdomain('goldenages.atriaxsolutions.com')).toBe('goldenages')
    expect(getAgencySubdomain('individualschoice.atriaxsolutions.com')).toBe('individualschoice')
  })

  it('returns null on the apex, www, and reserved subdomains', () => {
    expect(getAgencySubdomain('atriaxsolutions.com')).toBeNull()
    expect(getAgencySubdomain('www.atriaxsolutions.com')).toBeNull()
    expect(getAgencySubdomain('platform.atriaxsolutions.com')).toBeNull()
    expect(getAgencySubdomain('app.atriaxsolutions.com')).toBeNull()
  })

  it('returns null on non-production hosts (localhost, vercel previews)', () => {
    expect(getAgencySubdomain('localhost')).toBeNull()
    expect(getAgencySubdomain('127.0.0.1')).toBeNull()
    expect(getAgencySubdomain('atria-x.vercel.app')).toBeNull()
    expect(getAgencySubdomain('goldenages.example.com')).toBeNull()
  })

  it('returns null for empty or malformed hosts', () => {
    expect(getAgencySubdomain('')).toBeNull()
    expect(getAgencySubdomain('.atriaxsolutions.com')).toBeNull()
    expect(getAgencySubdomain('a.b.atriaxsolutions.com')).toBeNull()
  })
})

describe('findTenantForSubdomain', () => {
  const goldenAges = {
    clerkOrgId: 'org_ga',
    tenantName: 'Golden Ages Home Care',
    slug: 'golden-ages-home-care',
    agencyAddress: null,
    role: 'org:admin',
  }
  const individualsChoice = {
    clerkOrgId: 'org_ic',
    tenantName: 'Individuals Choice',
    slug: 'individuals-choice-inc',
    agencyAddress: null,
    role: 'org:admin',
  }

  it('matches a tenant whose slug normalizes to the subdomain', () => {
    expect(
      findTenantForSubdomain([goldenAges, individualsChoice], 'goldenages')?.clerkOrgId,
    ).toBe('org_ga')
    expect(
      findTenantForSubdomain([goldenAges, individualsChoice], 'individualschoice')?.clerkOrgId,
    ).toBe('org_ic')
  })

  it('returns undefined when no membership matches the subdomain', () => {
    expect(
      findTenantForSubdomain([individualsChoice], 'goldenages'),
    ).toBeUndefined()
  })

  it('returns undefined without tenants or a subdomain', () => {
    expect(findTenantForSubdomain(undefined, 'goldenages')).toBeUndefined()
    expect(findTenantForSubdomain([goldenAges], null)).toBeUndefined()
  })
})
