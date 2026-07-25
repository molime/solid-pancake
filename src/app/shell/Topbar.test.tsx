import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Topbar } from './Topbar'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@clerk/react', async () => {
  const actual =
    await vi.importActual<typeof import('@clerk/react')>('@clerk/react')
  return {
    ...actual,
    useOrganization: vi.fn(),
    useUser: vi.fn(),
    useClerk: vi.fn(),
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

import { useOrganization, useUser, useClerk } from '@clerk/react'
import { useQuery } from 'convex/react'

function mockTopbarState(options: {
  orgId?: string
  orgName?: string
  isLoaded?: boolean
  memberRole?: string | null
}) {
  vi.mocked(useOrganization).mockReturnValue({
    organization: options.orgId
      ? { id: options.orgId, name: options.orgName }
      : null,
    isLoaded: options.isLoaded ?? true,
  } as unknown as ReturnType<typeof useOrganization>)

  vi.mocked(useUser).mockReturnValue({
    user: null,
  } as unknown as ReturnType<typeof useUser>)

  vi.mocked(useClerk).mockReturnValue({
    signOut: vi.fn(),
  } as unknown as ReturnType<typeof useClerk>)

  vi.mocked(useQuery).mockImplementation(((_api: unknown, args: unknown) => {
    if (args === 'skip') return null
    if (args && typeof args === 'object' && 'clerkOrgId' in args) {
      return options.memberRole ? { role: options.memberRole } : null
    }
    return null
  }) as typeof useQuery)
}

describe('Topbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the agency logo for the Individuals Choice tenant', () => {
    mockTopbarState({
      orgId: 'org_123',
      orgName: 'Individuals Choice',
      memberRole: 'org:admin',
    })

    render(
      <MemoryRouter>
        <Topbar />
      </MemoryRouter>,
    )

    const logo = screen.getByAltText('Individuals Choice logo')
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveAttribute('src', '/agency-logo-individualschoice.jpeg')
  })

  it('renders no agency logo for other tenants', () => {
    mockTopbarState({
      orgId: 'org_123',
      orgName: 'Some Other Agency',
      memberRole: 'org:admin',
    })

    render(
      <MemoryRouter>
        <Topbar />
      </MemoryRouter>,
    )

    expect(screen.queryByAltText('Some Other Agency logo')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('img', { name: /logo/i }),
    ).not.toBeInTheDocument()
  })

  it('renders no agency logo while tenant is loading', () => {
    mockTopbarState({ isLoaded: false })

    render(
      <MemoryRouter>
        <Topbar />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
