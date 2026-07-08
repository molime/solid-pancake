import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SelectAgencyPage } from './SelectAgencyPage'

const mocks = {
  setActive: vi.fn(),
  ensureAgency: vi.fn(),
  navigate: vi.fn(),
}

vi.mock('@clerk/react', async () => {
  const actual = await vi.importActual<typeof import('@clerk/react')>(
    '@clerk/react',
  )
  return {
    ...actual,
    useAuth: vi.fn(),
    useOrganization: vi.fn(),
    useOrganizationList: vi.fn(),
    useUser: vi.fn(),
  }
})

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>(
    'convex/react',
  )
  return {
    ...actual,
    useConvexAuth: vi.fn(),
    useMutation: vi.fn(() => mocks.ensureAgency),
  }
})

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  )
  return {
    ...actual,
    useNavigate: vi.fn(() => mocks.navigate),
  }
})

import { useAuth, useOrganization, useOrganizationList, useUser } from '@clerk/react'
import { useConvexAuth } from 'convex/react'

function mockClerkState(options: {
  orgs?: Array<{
    id: string
    name: string
    slug: string
    role: string
    atriaRole?: string
  }>
  activeOrgId?: string | null
  user?: { fullName: string; primaryEmailAddress: { emailAddress: string } } | null
  isLoaded?: boolean
}) {
  const orgs = options.orgs ?? []
  const activeOrg = orgs.find((o) => o.id === options.activeOrgId) ?? null

  vi.mocked(useOrganizationList).mockReturnValue({
    isLoaded: options.isLoaded ?? true,
    setActive: mocks.setActive,
    userMemberships: {
      data: orgs.map((o) => ({
        organization: { id: o.id, name: o.name, slug: o.slug },
        role: o.role,
        publicMetadata: o.atriaRole ? { atriaRole: o.atriaRole } : undefined,
      })),
    },
  } as unknown as ReturnType<typeof useOrganizationList>)

  vi.mocked(useOrganization).mockReturnValue({
    organization: activeOrg
      ? { id: activeOrg.id, name: activeOrg.name, slug: activeOrg.slug }
      : null,
  } as unknown as ReturnType<typeof useOrganization>)

  vi.mocked(useUser).mockReturnValue({
    user: options.user ?? null,
    isLoaded: true,
    isSignedIn: !!options.user,
  } as unknown as ReturnType<typeof useUser>)

  vi.mocked(useAuth).mockReturnValue({
    orgId: options.activeOrgId,
    isLoaded: true,
    isSignedIn: !!options.user,
  } as unknown as ReturnType<typeof useAuth>)
}

function mockConvexAuth(auth: { isLoading: boolean; isAuthenticated: boolean }) {
  vi.mocked(useConvexAuth).mockReturnValue(auth)
}

describe('SelectAgencyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows ATRIA role from publicMetadata when Clerk role is generic org:member', async () => {
    mockClerkState({
      orgs: [
        {
          id: 'org_123',
          name: 'Test Agency',
          slug: 'test',
          role: 'org:member',
          atriaRole: 'org:hr',
        },
      ],
      activeOrgId: 'org_123',
      user: { fullName: 'Alice', primaryEmailAddress: { emailAddress: 'a@x.com' } },
    })
    mockConvexAuth({ isLoading: false, isAuthenticated: true })

    render(<SelectAgencyPage />)
    expect(screen.getByText(/Role:\s*hr/i)).toBeInTheDocument()
  })

  it('does not call Convex while Convex auth is loading', async () => {
    mockClerkState({
      orgs: [{ id: 'org_123', name: 'Test Agency', slug: 'test', role: 'org:admin' }],
      activeOrgId: null,
      user: { fullName: 'Alice', primaryEmailAddress: { emailAddress: 'a@x.com' } },
    })
    mockConvexAuth({ isLoading: true, isAuthenticated: false })

    render(<SelectAgencyPage />)
    const btn = screen.getByRole('button', { name: /Test Agency/i })
    await userEvent.click(btn)

    expect(mocks.setActive).toHaveBeenCalledWith({ organization: 'org_123' })
    expect(mocks.ensureAgency).not.toHaveBeenCalled()
  })

  it('does not call Convex before active org matches pending org', async () => {
    mockClerkState({
      orgs: [{ id: 'org_123', name: 'Test Agency', slug: 'test', role: 'org:admin' }],
      activeOrgId: 'org_999',
      user: { fullName: 'Alice', primaryEmailAddress: { emailAddress: 'a@x.com' } },
    })
    mockConvexAuth({ isLoading: false, isAuthenticated: true })

    render(<SelectAgencyPage />)
    const btn = screen.getByRole('button', { name: /Test Agency/i })
    await userEvent.click(btn)

    await waitFor(() => {
      expect(mocks.ensureAgency).not.toHaveBeenCalled()
    })
  })

  it('calls bootstrap and navigates when auth is ready', async () => {
    mocks.ensureAgency.mockResolvedValueOnce({ tenantId: 't1', memberId: 'm1' })
    mocks.setActive.mockResolvedValueOnce(undefined)

    mockClerkState({
      orgs: [{ id: 'org_123', name: 'Test Agency', slug: 'test', role: 'org:admin' }],
      activeOrgId: 'org_123',
      user: { fullName: 'Alice', primaryEmailAddress: { emailAddress: 'a@x.com' } },
    })
    mockConvexAuth({ isLoading: false, isAuthenticated: true })

    render(<SelectAgencyPage />)
    const btn = screen.getByRole('button', { name: /Test Agency/i })
    await userEvent.click(btn)

    await waitFor(() => {
      expect(mocks.ensureAgency).toHaveBeenCalledTimes(1)
    })
    expect(mocks.ensureAgency).toHaveBeenCalledWith({
      clerkOrgId: 'org_123',
      name: 'Test Agency',
      slug: 'test',
      displayName: 'Alice',
      email: 'a@x.com',
    })
    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/', { replace: true })
    })
  })

  it('shows visible error on bootstrap failure and stays on page', async () => {
    mocks.ensureAgency.mockRejectedValueOnce(
      new Error('Unauthorized: authentication required'),
    )
    mocks.setActive.mockResolvedValueOnce(undefined)

    mockClerkState({
      orgs: [{ id: 'org_123', name: 'Test Agency', slug: 'test', role: 'org:admin' }],
      activeOrgId: 'org_123',
      user: { fullName: 'Alice', primaryEmailAddress: { emailAddress: 'a@x.com' } },
    })
    mockConvexAuth({ isLoading: false, isAuthenticated: true })

    render(<SelectAgencyPage />)
    const btn = screen.getByRole('button', { name: /Test Agency/i })
    await userEvent.click(btn)

    await waitFor(() => {
      expect(
        screen.getByText('Unauthorized: authentication required'),
      ).toBeInTheDocument()
    })
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('shows error and re-enables buttons when setActive rejects', async () => {
    mocks.setActive.mockRejectedValueOnce(new Error('Org switch failed'))

    mockClerkState({
      orgs: [{ id: 'org_123', name: 'Test Agency', slug: 'test', role: 'org:admin' }],
      activeOrgId: null,
      user: { fullName: 'Alice', primaryEmailAddress: { emailAddress: 'a@x.com' } },
    })
    mockConvexAuth({ isLoading: false, isAuthenticated: true })

    render(<SelectAgencyPage />)
    const btn = screen.getByRole('button', { name: /Test Agency/i })
    await userEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByText('Org switch failed')).toBeInTheDocument()
    })
    expect(mocks.ensureAgency).not.toHaveBeenCalled()
    // Buttons should be re-enabled after error
    expect(btn).not.toBeDisabled()
  })

  it('shows auth config error when Convex auth is permanently false', async () => {
    mocks.setActive.mockResolvedValueOnce(undefined)

    mockClerkState({
      orgs: [{ id: 'org_123', name: 'Test Agency', slug: 'test', role: 'org:admin' }],
      activeOrgId: 'org_123',
      user: { fullName: 'Alice', primaryEmailAddress: { emailAddress: 'a@x.com' } },
    })
    mockConvexAuth({ isLoading: false, isAuthenticated: false })

    render(<SelectAgencyPage />)
    const btn = screen.getByRole('button', { name: /Test Agency/i })
    await userEvent.click(btn)

    await waitFor(() => {
      expect(
        screen.getByText(
          /Authentication failed.*check your Clerk.*Convex configuration/i,
        ),
      ).toBeInTheDocument()
    })
    expect(mocks.ensureAgency).not.toHaveBeenCalled()
    expect(btn).not.toBeDisabled()
  })

  it('retries once on transient token error, then succeeds', async () => {
    mocks.setActive.mockResolvedValueOnce(undefined)
    mocks.ensureAgency
      .mockRejectedValueOnce(new Error('Forbidden: active Clerk organization required but missing from token.'))
      .mockResolvedValueOnce({ tenantId: 't1', memberId: 'm1' })

    mockClerkState({
      orgs: [{ id: 'org_123', name: 'Test Agency', slug: 'test', role: 'org:admin' }],
      activeOrgId: 'org_123',
      user: { fullName: 'Alice', primaryEmailAddress: { emailAddress: 'a@x.com' } },
    })
    mockConvexAuth({ isLoading: false, isAuthenticated: true })

    render(<SelectAgencyPage />)
    const btn = screen.getByRole('button', { name: /Test Agency/i })
    await userEvent.click(btn)

    await waitFor(() => {
      expect(mocks.ensureAgency).toHaveBeenCalledTimes(2)
    })
    expect(mocks.navigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('shows JWT config error when retry also fails with missing org claim', async () => {
    mocks.setActive.mockResolvedValueOnce(undefined)
    mocks.ensureAgency.mockRejectedValue(
      new Error('Forbidden: active Clerk organization required but missing from token.'),
    )

    mockClerkState({
      orgs: [{ id: 'org_123', name: 'Test Agency', slug: 'test', role: 'org:admin' }],
      activeOrgId: 'org_123',
      user: { fullName: 'Alice', primaryEmailAddress: { emailAddress: 'a@x.com' } },
    })
    mockConvexAuth({ isLoading: false, isAuthenticated: true })

    render(<SelectAgencyPage />)
    const btn = screen.getByRole('button', { name: /Test Agency/i })
    await userEvent.click(btn)

    await waitFor(() => {
      expect(
        screen.getByText(
          /Agency could not be opened because the Convex JWT is missing active organization claims/i,
        ),
      ).toBeInTheDocument()
    })
    expect(mocks.navigate).not.toHaveBeenCalled()
  })
})
