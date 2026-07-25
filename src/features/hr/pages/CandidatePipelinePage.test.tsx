import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    useAction: vi.fn(),
  }
})

import { useQuery } from 'convex/react'

const candidates = [
  {
    _id: 'candidate_1',
    displayName: 'Sofia Herrera',
    email: 'sofia@example.com',
    status: 'applied',
    createdAt: '2024-06-01T00:00:00.000Z',
  },
  {
    _id: 'candidate_2',
    displayName: 'Carlos Ruiz',
    email: 'carlos@example.com',
    status: 'hired',
    createdAt: '2024-05-01T00:00:00.000Z',
  },
]

function mockPipelineState() {
  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(queryRef as Parameters<typeof getFunctionName>[0])
      if (name === 'candidates:listCandidates') return candidates
      return undefined
    }) as unknown as typeof useQuery,
  )
}

describe('CandidatePipelinePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders tabs and candidate rows', async () => {
    const { CandidatePipelinePage } = await import('./CandidatePipelinePage')
    mockPipelineState()

    render(
      <MemoryRouter>
        <CandidatePipelinePage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Candidate Pipeline')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByText('Sofia Herrera')).toBeInTheDocument()
    expect(screen.getByText('Carlos Ruiz')).toBeInTheDocument()
  })

  it('filters by Hired tab', async () => {
    const user = userEvent.setup()
    const { CandidatePipelinePage } = await import('./CandidatePipelinePage')
    mockPipelineState()

    render(
      <MemoryRouter>
        <CandidatePipelinePage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Hired' }))
    await waitFor(() => {
      expect(screen.queryByText('Sofia Herrera')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Carlos Ruiz')).toBeInTheDocument()
  })
})
