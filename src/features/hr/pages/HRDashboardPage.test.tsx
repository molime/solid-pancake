import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { getFunctionName } from 'convex/server'

const mocks = {
  inviteCandidate: vi.fn(),
}

vi.mock('@clerk/react', async () => {
  const actual = await vi.importActual<typeof import('@clerk/react')>('@clerk/react')
  return {
    ...actual,
    useOrganization: vi.fn(() => ({
      organization: { id: 'org_123', name: 'Agency' },
    })),
    useUser: vi.fn(() => ({ user: { id: 'user_123', firstName: 'Test' } })),
  }
})

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
    useQuery: vi.fn(),
    useAction: vi.fn(),
  }
})

import { useQuery, useAction } from 'convex/react'

function mockDashboardState(options: {
  stats?: {
    inPipeline: number
    activeEmployees: number
    expiringCredentials: number
    openCases: number
  }
  candidates?: unknown[]
}) {
  const stats = options.stats ?? {
    inPipeline: 3,
    activeEmployees: 12,
    expiringCredentials: 0,
    openCases: 2,
  }
  const candidates = options.candidates ?? [
    {
      _id: 'candidate_1',
      displayName: 'Sofia Herrera',
      email: 'sofia@example.com',
      status: 'applied',
      createdAt: '2024-06-01T00:00:00.000Z',
    },
  ]

  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(queryRef as Parameters<typeof getFunctionName>[0])
      if (name === 'hrCases:hrDashboardStats') return stats
      if (name === 'candidates:listCandidates') return candidates
      return undefined
    }) as unknown as typeof useQuery,
  )

  vi.mocked(useAction).mockImplementation(
    ((mutationRef: unknown) => {
      const name = getFunctionName(mutationRef as Parameters<typeof getFunctionName>[0])
      if (name === 'candidates:inviteCandidate') return mocks.inviteCandidate
      return vi.fn()
    }) as unknown as typeof useAction,
  )
}

describe('HRDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders title, KPIs, and candidate rows', async () => {
    const { HRDashboardPage } = await import('./HRDashboardPage')
    mockDashboardState({})

    render(
      <MemoryRouter>
        <HRDashboardPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('People & hiring')).toBeInTheDocument()
    expect(screen.getByText('In pipeline')).toBeInTheDocument()
    expect(screen.getByText('Active employees')).toBeInTheDocument()
    expect(screen.getByText('Expiring credentials')).toBeInTheDocument()
    expect(screen.getByText('Open cases')).toBeInTheDocument()
    expect(screen.getByText('Sofia Herrera')).toBeInTheDocument()
  })

  it('opens invite candidate modal', async () => {
    const { HRDashboardPage } = await import('./HRDashboardPage')
    mockDashboardState({})

    render(
      <MemoryRouter>
        <HRDashboardPage />
      </MemoryRouter>,
    )

    screen.getByRole('button', { name: /invite candidate/i }).click()
    expect(screen.getByText('Invite candidate')).toBeInTheDocument()
  })
})
