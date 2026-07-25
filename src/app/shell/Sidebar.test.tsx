import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Sidebar } from './Sidebar'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@clerk/react', async () => {
  const actual =
    await vi.importActual<typeof import('@clerk/react')>('@clerk/react')
  return {
    ...actual,
    useOrganization: vi.fn(),
    useUser: vi.fn(),
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

import { useOrganization, useUser } from '@clerk/react'
import { useQuery } from 'convex/react'

function mockSidebarState(options: {
  orgId?: string
  user?: { fullName: string; firstName: string } | null
  memberRole?: string | null
  isPlatformAdmin?: boolean
}) {
  vi.mocked(useOrganization).mockReturnValue({
    organization: options.orgId ? { id: options.orgId } : null,
  } as unknown as ReturnType<typeof useOrganization>)

  vi.mocked(useUser).mockReturnValue({
    user: options.user ?? null,
  } as unknown as ReturnType<typeof useUser>)

  vi.mocked(useQuery).mockImplementation(((_api: unknown, args: unknown) => {
    if (args === 'skip') return null
    if (args && typeof args === 'object' && 'clerkOrgId' in args) {
      return options.memberRole ? { role: options.memberRole } : null
    }
    // platform.isAdmin has no args (empty object {})
    return options.isPlatformAdmin ?? false
  }) as typeof useQuery)
}

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the ATRIA logo image', () => {
    mockSidebarState({
      orgId: 'org_123',
      user: { fullName: 'Admin User', firstName: 'A' },
      memberRole: 'org:admin',
    })

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )

    const logo = screen.getByAltText('ATRIA-X')
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveAttribute('src', '/atria-logo.png')
  })

  it('shows all nav items for org:admin', () => {
    mockSidebarState({
      orgId: 'org_123',
      user: { fullName: 'Admin User', firstName: 'A' },
      memberRole: 'org:admin',
    })

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Schedule')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
    expect(screen.getByText('Knowledge')).toBeInTheDocument()
    expect(screen.getByText('Billing')).toBeInTheDocument()
    expect(screen.getByText('Clients')).toBeInTheDocument()
    expect(screen.getByText('Team')).toBeInTheDocument()

    // Today, Availability are caregiver-only
    expect(screen.queryByText('Today')).not.toBeInTheDocument()
    expect(screen.queryByText('Availability')).not.toBeInTheDocument()
  })

  it('shows coordinator items for org:coordinator', () => {
    mockSidebarState({
      orgId: 'org_123',
      user: { fullName: 'Coordinator User', firstName: 'C' },
      memberRole: 'org:coordinator',
    })

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Schedule')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
    expect(screen.getByText('Knowledge')).toBeInTheDocument()
    expect(screen.getByText('Billing')).toBeInTheDocument()
    expect(screen.getByText('Clients')).toBeInTheDocument()

    expect(screen.queryByText('Today')).not.toBeInTheDocument()
    expect(screen.queryByText('Team')).not.toBeInTheDocument()
    expect(screen.queryByText('Availability')).not.toBeInTheDocument()
    expect(screen.queryByText('Candidates')).not.toBeInTheDocument()
    expect(screen.queryByText('Employees')).not.toBeInTheDocument()
    expect(screen.queryByText('Cases')).not.toBeInTheDocument()
  })

  it('shows HR items for org:hr', () => {
    mockSidebarState({
      orgId: 'org_123',
      user: { fullName: 'HR User', firstName: 'H' },
      memberRole: 'org:hr',
    })

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )

    expect(screen.getByText('Candidates')).toBeInTheDocument()
    expect(screen.getByText('Employees')).toBeInTheDocument()
    expect(screen.getByText('Cases')).toBeInTheDocument()

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('Team')).not.toBeInTheDocument()
    expect(screen.queryByText('Review')).not.toBeInTheDocument()
    expect(screen.queryByText('Billing')).not.toBeInTheDocument()
  })

  it('shows HR items for org:admin', () => {
    mockSidebarState({
      orgId: 'org_123',
      user: { fullName: 'Admin User', firstName: 'A' },
      memberRole: 'org:admin',
    })

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )

    expect(screen.getByText('Candidates')).toBeInTheDocument()
    expect(screen.getByText('Employees')).toBeInTheDocument()
    expect(screen.getByText('Cases')).toBeInTheDocument()
  })

  it('shows caregiver items for org:caregiver', () => {
    mockSidebarState({
      orgId: 'org_123',
      user: { fullName: 'Caregiver User', firstName: 'G' },
      memberRole: 'org:caregiver',
    })

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )

    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Knowledge')).toBeInTheDocument()
    expect(screen.getByText('Availability')).toBeInTheDocument()

    // Exactly one Schedule link pointing to the caregiver route
    const scheduleLinks = screen.getAllByRole('link', { name: 'Schedule' })
    expect(scheduleLinks).toHaveLength(1)
    expect(scheduleLinks[0]).toHaveAttribute('href', '/caregiver/schedule')

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('Review')).not.toBeInTheDocument()
    expect(screen.queryByText('Billing')).not.toBeInTheDocument()
    expect(screen.queryByText('Clients')).not.toBeInTheDocument()
    expect(screen.queryByText('Team')).not.toBeInTheDocument()
  })

  it('defaults to caregiver role when member query returns null', () => {
    mockSidebarState({
      orgId: 'org_123',
      user: { fullName: 'Unknown User', firstName: 'U' },
      memberRole: null,
    })

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )

    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Knowledge')).toBeInTheDocument()
    expect(screen.getByText('Availability')).toBeInTheDocument()

    const scheduleLinks = screen.getAllByRole('link', { name: 'Schedule' })
    expect(scheduleLinks).toHaveLength(1)
    expect(scheduleLinks[0]).toHaveAttribute('href', '/caregiver/schedule')

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('Review')).not.toBeInTheDocument()
    expect(screen.queryByText('Billing')).not.toBeInTheDocument()
    expect(screen.queryByText('Clients')).not.toBeInTheDocument()
    expect(screen.queryByText('Team')).not.toBeInTheDocument()
  })

  it('shows Platform nav item for platform admins', () => {
    mockSidebarState({
      orgId: 'org_123',
      user: { fullName: 'Admin User', firstName: 'A' },
      memberRole: 'org:admin',
      isPlatformAdmin: true,
    })

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )

    expect(screen.getByText('Platform')).toBeInTheDocument()
  })

  it('does not show Platform nav item for non-platform admins', () => {
    mockSidebarState({
      orgId: 'org_123',
      user: { fullName: 'Admin User', firstName: 'A' },
      memberRole: 'org:admin',
      isPlatformAdmin: false,
    })

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )

    expect(screen.queryByText('Platform')).not.toBeInTheDocument()
  })

  it('displays user name and role in footer', () => {
    mockSidebarState({
      orgId: 'org_123',
      user: { fullName: 'Coordinator User', firstName: 'C' },
      memberRole: 'org:coordinator',
    })

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )

    expect(screen.getByText('Coordinator User')).toBeInTheDocument()
    expect(screen.getByText('coordinator')).toBeInTheDocument()
  })
})
