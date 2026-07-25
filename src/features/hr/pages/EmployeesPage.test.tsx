import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { getFunctionName } from 'convex/server'

vi.mock('@clerk/react', async () => {
  const actual = await vi.importActual<typeof import('@clerk/react')>('@clerk/react')
  return {
    ...actual,
    useOrganization: vi.fn(() => ({
      organization: { id: 'org_123', name: 'Agency' },
    })),
  }
})

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
    useQuery: vi.fn(),
  }
})

import { useQuery } from 'convex/react'

const employees = [
  {
    _id: 'profile_1',
    displayName: 'Sofia Herrera',
    email: 'sofia@example.com',
    adpSyncStatus: 'pending_credentials',
    tenantMemberId: 'member_1',
    clerkUserId: 'user_1',
  },
]

function mockEmployeesState() {
  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(queryRef as Parameters<typeof getFunctionName>[0])
      if (name === 'employeeProfiles:listEmployeeProfiles') return employees
      return undefined
    }) as unknown as typeof useQuery,
  )
}

describe('EmployeesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders employee rows with ADP status', async () => {
    const { EmployeesPage } = await import('./EmployeesPage')
    mockEmployeesState()

    render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Employees')).toBeInTheDocument()
    expect(screen.getByText('Sofia Herrera')).toBeInTheDocument()
    expect(screen.getByText('Pending credentials')).toBeInTheDocument()
  })
})
