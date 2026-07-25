import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  useTenant,
  setSelectedClerkOrgId,
  getStoredClerkOrgId,
} from './useTenant'

vi.mock('@clerk/react', async () => {
  const actual =
    await vi.importActual<typeof import('@clerk/react')>('@clerk/react')
  return {
    ...actual,
    useOrganization: vi.fn(),
  }
})

vi.mock('convex/react', async () => {
  const actual =
    await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
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

  it('clears the stored id when it is no longer among the resolved memberships', () => {
    setSelectedClerkOrgId('org_revoked')
    mockOrganization({ isLoaded: true, organization: null })
    mockDbTenants([caregiverTenant])

    const { result, rerender } = renderHook(() => useTenant())

    expect(getStoredClerkOrgId()).toBeNull()
    rerender()
    // Falls back to the first live membership once the stale id is cleared.
    expect(result.current.clerkOrgId).toBe('org_stored')
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
