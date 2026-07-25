import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  TenantRouteGuard,
  SignedInRouteGuard,
  TenantRoleRouteGuard,
  TrainingRouteGuard,
} from './RouteGuard'
import { getFunctionName } from 'convex/server'

const mockNavigate = vi.fn()

vi.mock('@clerk/react', async () => {
  const actual =
    await vi.importActual<typeof import('@clerk/react')>('@clerk/react')
  return {
    ...actual,
    useAuth: vi.fn(),
    useOrganization: vi.fn(),
    useOrganizationList: vi.fn(),
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

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    Navigate: vi.fn(({ to }: { to: string }) => {
      mockNavigate(to)
      return <div data-testid="navigate">Navigate to {to}</div>
    }),
    useLocation: vi.fn(() => ({ pathname: '/' })),
  }
})

import { useAuth, useOrganization, useOrganizationList } from '@clerk/react'
import { useQuery } from 'convex/react'

function mockClerkState(options: {
  authLoaded?: boolean
  isSignedIn?: boolean
  orgLoaded?: boolean
  organization?: { id: string; name: string } | null
}) {
  vi.mocked(useAuth).mockReturnValue({
    isLoaded: options.authLoaded ?? true,
    isSignedIn: options.isSignedIn ?? false,
    orgId: options.organization?.id ?? null,
  } as unknown as ReturnType<typeof useAuth>)

  vi.mocked(useOrganization).mockReturnValue({
    isLoaded: options.orgLoaded ?? true,
    organization: options.organization ?? null,
  } as unknown as ReturnType<typeof useOrganization>)
}

// useTenant issues useQuery(api.candidates.getMyTenant, 'skip') when a Clerk
// org is active — the mock must honor the 'skip' argument and return
// undefined for skipped queries, like the real hook does.
function mockUseQueryResult(result: unknown) {
  vi.mocked(useQuery).mockImplementation(((
    _query: unknown,
    args: unknown,
  ) => (args === 'skip' ? undefined : result)) as unknown as typeof useQuery)
}

function mockMembership(result: boolean | undefined | null) {
  mockUseQueryResult(result)
}

function mockMember(result: { role: string } | undefined | null) {
  mockUseQueryResult(result)
}

// Distinguishes queries by function path so guards that issue several
// queries (member + training completions + getMyTenant) each get their
// own result.
function mockQueries(results: Record<string, unknown>) {
  vi.mocked(useQuery).mockImplementation(((
    query: unknown,
    args: unknown,
  ) => {
    if (args === 'skip') return undefined
    const name = getFunctionName(
      query as Parameters<typeof getFunctionName>[0],
    )
    return results[name]
  }) as unknown as typeof useQuery)
}

describe('TenantRouteGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('shows loading spinner while auth is loading', () => {
    mockClerkState({ authLoaded: false, isSignedIn: false, orgLoaded: true })
    mockMembership(undefined)

    render(
      <TenantRouteGuard>
        <div data-testid="protected">Protected</div>
      </TenantRouteGuard>,
    )

    expect(screen.getByText('Preparing ATRIA-X')).toBeInTheDocument()
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument()
  })

  it('shows loading spinner while organization is loading', () => {
    mockClerkState({ authLoaded: true, isSignedIn: true, orgLoaded: false })
    mockMembership(undefined)

    render(
      <TenantRouteGuard>
        <div data-testid="protected">Protected</div>
      </TenantRouteGuard>,
    )

    expect(screen.getByText('Preparing ATRIA-X')).toBeInTheDocument()
  })

  it('shows loading spinner while membership query is loading', () => {
    mockClerkState({
      authLoaded: true,
      isSignedIn: true,
      orgLoaded: true,
      organization: { id: 'org_123', name: 'Test Agency' },
    })
    mockMembership(undefined)

    render(
      <TenantRouteGuard>
        <div data-testid="protected">Protected</div>
      </TenantRouteGuard>,
    )

    expect(screen.getByText('Opening agency workspace')).toBeInTheDocument()
  })

  it('redirects to /sign-in when not signed in', () => {
    mockClerkState({
      authLoaded: true,
      isSignedIn: false,
      orgLoaded: true,
      organization: null,
    })
    mockMembership(undefined)

    render(
      <TenantRouteGuard>
        <div data-testid="protected">Protected</div>
      </TenantRouteGuard>,
    )

    expect(screen.getByText('Navigate to /sign-in')).toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/sign-in')
    expect(useQuery).not.toHaveBeenCalled()
  })

  it('redirects to /select-agency when signed in but has no organization', () => {
    mockClerkState({
      authLoaded: true,
      isSignedIn: true,
      orgLoaded: true,
      organization: null,
    })
    mockMembership(null)

    render(
      <TenantRouteGuard>
        <div data-testid="protected">Protected</div>
      </TenantRouteGuard>,
    )

    expect(screen.getByText('Navigate to /select-agency')).toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/select-agency')
  })

  it('renders children when signed in, has org, and is a Convex member', () => {
    mockClerkState({
      authLoaded: true,
      isSignedIn: true,
      orgLoaded: true,
      organization: { id: 'org_123', name: 'Test Agency' },
    })
    mockMembership(true)

    render(
      <TenantRouteGuard>
        <div data-testid="protected">Protected</div>
      </TenantRouteGuard>,
    )

    expect(screen.getByTestId('protected')).toBeInTheDocument()
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument()
  })

  it('redirects to /select-agency when signed in, has org, but is NOT a Convex member', () => {
    mockClerkState({
      authLoaded: true,
      isSignedIn: true,
      orgLoaded: true,
      organization: { id: 'org_123', name: 'Test Agency' },
    })
    mockMembership(false)

    render(
      <TenantRouteGuard>
        <div data-testid="protected">Protected</div>
      </TenantRouteGuard>,
    )

    expect(screen.getByText('Navigate to /select-agency')).toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/select-agency')
  })

  it('does not redirect a no-org user with a stored tenant when useOrganization flaps', () => {
    // Caregiver mid-session: token refresh makes Clerk report no loaded org,
    // but the resolved tenant is stable in localStorage.
    window.localStorage.setItem('atria.selectedClerkOrgId', 'org_stored')
    mockClerkState({
      authLoaded: true,
      isSignedIn: true,
      orgLoaded: false,
      organization: null,
    })
    mockMembership(true)

    render(
      <TenantRouteGuard>
        <div data-testid="protected">Protected</div>
      </TenantRouteGuard>,
    )

    expect(screen.getByTestId('protected')).toBeInTheDocument()
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument()
    // The stored id is used for the membership check.
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: 'org_stored',
    })
  })

  it('still redirects a no-org user when localStorage is genuinely empty', () => {
    mockClerkState({
      authLoaded: true,
      isSignedIn: true,
      orgLoaded: true,
      organization: null,
    })
    // No tenantMembers record at all.
    mockMembership(null)

    render(
      <TenantRouteGuard>
        <div data-testid="protected">Protected</div>
      </TenantRouteGuard>,
    )

    expect(screen.getByText('Navigate to /select-agency')).toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/select-agency')
  })
})

function mockSignedInOrgs(orgs: { id: string; name: string }[]) {
  vi.mocked(useOrganizationList).mockReturnValue({
    isLoaded: true,
    userMemberships: {
      data: orgs.map((o) => ({
        organization: { id: o.id, name: o.name, slug: o.name.toLowerCase() },
        role: 'org:member',
      })),
    },
  } as unknown as ReturnType<typeof useOrganizationList>)
}

describe('SignedInRouteGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner while auth is loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoaded: false,
      isSignedIn: false,
    } as unknown as ReturnType<typeof useAuth>)
    mockSignedInOrgs([])

    render(
      <SignedInRouteGuard>
        <div data-testid="protected">Protected</div>
      </SignedInRouteGuard>,
    )

    expect(screen.getByText('Preparing ATRIA-X')).toBeInTheDocument()
  })

  it('redirects to /sign-in when not signed in', () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
    } as unknown as ReturnType<typeof useAuth>)
    mockSignedInOrgs([])

    render(
      <SignedInRouteGuard>
        <div data-testid="protected">Protected</div>
      </SignedInRouteGuard>,
    )

    expect(screen.getByText('Navigate to /sign-in')).toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/sign-in')
  })

  it('renders children when signed in', () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
    } as unknown as ReturnType<typeof useAuth>)
    mockSignedInOrgs([{ id: 'org_123', name: 'Test Agency' }])

    render(
      <SignedInRouteGuard>
        <div data-testid="protected">Protected</div>
      </SignedInRouteGuard>,
    )

    expect(screen.getByTestId('protected')).toBeInTheDocument()
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument()
  })
})

describe('TenantRoleRouteGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading while member role is loading', () => {
    mockClerkState({
      organization: { id: 'org_123', name: 'Test Agency' },
    })
    mockMember(undefined)

    render(
      <TenantRoleRouteGuard allowedRoles={['org:admin']}>
        <div data-testid="protected">Protected</div>
      </TenantRoleRouteGuard>,
    )

    expect(screen.getByText('Checking access')).toBeInTheDocument()
  })

  it('renders children for an allowed role', () => {
    mockClerkState({
      organization: { id: 'org_123', name: 'Test Agency' },
    })
    mockMember({ role: 'org:coordinator' })

    render(
      <TenantRoleRouteGuard allowedRoles={['org:admin', 'org:coordinator']}>
        <div data-testid="protected">Protected</div>
      </TenantRoleRouteGuard>,
    )

    expect(screen.getByTestId('protected')).toBeInTheDocument()
  })

  it('redirects caregivers away from non-caregiver routes', () => {
    mockClerkState({
      organization: { id: 'org_123', name: 'Test Agency' },
    })
    mockMember({ role: 'org:caregiver' })

    render(
      <TenantRoleRouteGuard allowedRoles={['org:admin']}>
        <div data-testid="protected">Protected</div>
      </TenantRoleRouteGuard>,
    )

    expect(screen.getByText('Navigate to /caregiver/today')).toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/caregiver/today')
  })

  it('redirects admins and coordinators away from caregiver-only routes', () => {
    mockClerkState({
      organization: { id: 'org_123', name: 'Test Agency' },
    })
    mockMember({ role: 'org:admin' })

    render(
      <TenantRoleRouteGuard allowedRoles={['org:caregiver']}>
        <div data-testid="protected">Protected</div>
      </TenantRoleRouteGuard>,
    )

    expect(screen.getByText('Navigate to /')).toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
  it('redirects candidate to /onboarding from a role-protected route', () => {
    mockClerkState({
      authLoaded: true,
      isSignedIn: true,
      orgLoaded: true,
      organization: { id: 'org_123', name: 'Agency' },
    })
    mockMember({ role: 'org:candidate' })

    render(
      <TenantRoleRouteGuard allowedRoles={['org:hr']}>
        <div data-testid="protected">Protected</div>
      </TenantRoleRouteGuard>,
    )

    expect(mockNavigate).toHaveBeenCalledWith('/onboarding')
  })
})

describe('guard stability during a Clerk token refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  const storedCaregiverTenant = {
    clerkOrgId: 'org_stored',
    tenantName: 'Test Agency',
    role: 'org:caregiver',
  }

  // Puts Clerk and Convex into the transient mid-refresh state: the
  // resubscribed getMyTenant query resolves WITHOUT the stored tenant
  // (auth not yet propagated to the fresh subscription).
  function mockTransientEmptyResolution(memberResults: Record<string, unknown>) {
    mockClerkState({
      authLoaded: true,
      isSignedIn: true,
      orgLoaded: true,
      organization: null,
    })
    mockQueries({
      'candidates:getMyTenant': [],
      ...memberResults,
    })
  }

  it('TenantRoleRouteGuard keeps a caregiver on the route through a mid-refresh resubscribe', () => {
    window.localStorage.setItem('atria.selectedClerkOrgId', 'org_stored')
    mockClerkState({
      authLoaded: true,
      isSignedIn: true,
      orgLoaded: true,
      organization: null,
    })
    mockQueries({
      'candidates:getMyTenant': [storedCaregiverTenant],
      'members:me': { role: 'org:caregiver' },
    })

    const ui = (
      <TenantRoleRouteGuard allowedRoles={['org:caregiver']}>
        <div data-testid="protected">Protected</div>
      </TenantRoleRouteGuard>
    )
    const { rerender } = render(ui)
    expect(screen.getByTestId('protected')).toBeInTheDocument()

    // Token refresh: getMyTenant resubscribes and transiently resolves
    // without the stored tenant.
    mockTransientEmptyResolution({
      'members:me': { role: 'org:caregiver' },
    })
    rerender(ui)

    // The stored id survives the transient resolution and the guard keeps
    // the caregiver on the route — no stuck loader, no /select-agency bounce.
    expect(window.localStorage.getItem('atria.selectedClerkOrgId')).toBe(
      'org_stored',
    )
    expect(screen.getByTestId('protected')).toBeInTheDocument()
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument()
    // The member query keeps running against the stored tenant.
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: 'org_stored',
    })
  })

  it('TrainingRouteGuard keeps a caregiver on the route through a mid-refresh resubscribe', () => {
    window.localStorage.setItem('atria.selectedClerkOrgId', 'org_stored')
    mockClerkState({
      authLoaded: true,
      isSignedIn: true,
      orgLoaded: true,
      organization: null,
    })
    mockQueries({
      'candidates:getMyTenant': [storedCaregiverTenant],
      'members:me': { role: 'org:caregiver' },
      'platformTrainingCompletions:listMyCompletions': [
        { trainingId: 'platform_training', status: 'completed' },
      ],
    })

    const ui = (
      <TrainingRouteGuard>
        <div data-testid="protected">Protected</div>
      </TrainingRouteGuard>
    )
    const { rerender } = render(ui)
    expect(screen.getByTestId('protected')).toBeInTheDocument()

    // Token refresh: getMyTenant resubscribes and transiently resolves
    // without the stored tenant.
    mockTransientEmptyResolution({
      'members:me': { role: 'org:caregiver' },
      'platformTrainingCompletions:listMyCompletions': [
        { trainingId: 'platform_training', status: 'completed' },
      ],
    })
    rerender(ui)

    expect(window.localStorage.getItem('atria.selectedClerkOrgId')).toBe(
      'org_stored',
    )
    expect(screen.getByTestId('protected')).toBeInTheDocument()
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument()
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: 'org_stored',
    })
  })

  it('TenantRoleRouteGuard still redirects when the member query finds no membership', () => {
    // No stored tenant; getMyTenant resolves one, but the user is not a
    // member of it — authorization stays server-side and still wins.
    mockClerkState({
      authLoaded: true,
      isSignedIn: true,
      orgLoaded: true,
      organization: null,
    })
    mockQueries({
      'candidates:getMyTenant': [
        {
          clerkOrgId: 'org_db',
          tenantName: 'Test Agency',
          role: 'org:caregiver',
        },
      ],
      'members:me': null,
    })

    render(
      <TenantRoleRouteGuard allowedRoles={['org:caregiver']}>
        <div data-testid="protected">Protected</div>
      </TenantRoleRouteGuard>,
    )

    expect(screen.getByText('Navigate to /select-agency')).toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/select-agency')
  })

  it('TrainingRouteGuard still redirects a caregiver with incomplete training to /onboarding/training', () => {
    window.localStorage.setItem('atria.selectedClerkOrgId', 'org_stored')
    mockClerkState({
      authLoaded: true,
      isSignedIn: true,
      orgLoaded: true,
      organization: null,
    })
    mockQueries({
      'candidates:getMyTenant': [
        {
          clerkOrgId: 'org_stored',
          tenantName: 'Test Agency',
          role: 'org:caregiver',
        },
      ],
      'members:me': { role: 'org:caregiver' },
      'platformTrainingCompletions:listMyCompletions': [
        { trainingId: 'platform_training', status: 'in_progress' },
      ],
    })

    render(
      <TrainingRouteGuard>
        <div data-testid="protected">Protected</div>
      </TrainingRouteGuard>,
    )

    expect(
      screen.getByText('Navigate to /onboarding/training'),
    ).toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/onboarding/training')
  })

  it('an active Clerk org wins over a stale stored tenant', () => {
    window.localStorage.setItem('atria.selectedClerkOrgId', 'org_stale')
    mockClerkState({
      authLoaded: true,
      isSignedIn: true,
      orgLoaded: true,
      organization: { id: 'org_123', name: 'Test Agency' },
    })
    mockQueries({
      'members:me': { role: 'org:coordinator' },
      'platformTrainingCompletions:listMyCompletions': [
        { trainingId: 'platform_training', status: 'completed' },
      ],
    })

    render(
      <TrainingRouteGuard>
        <div data-testid="protected">Protected</div>
      </TrainingRouteGuard>,
    )

    expect(screen.getByTestId('protected')).toBeInTheDocument()
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: 'org_123',
    })
    expect(useQuery).not.toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: 'org_stale',
    })
  })
})
