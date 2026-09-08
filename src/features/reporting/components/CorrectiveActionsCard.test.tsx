import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { getFunctionName } from 'convex/server'

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>(
    'convex/react',
  )
  return {
    ...actual,
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
    useQuery: vi.fn(),
    useMutation: vi.fn(() => vi.fn()),
  }
})

import { useQuery } from 'convex/react'

const CAPS = [
  {
    _id: 'cap_1',
    source: 'regional_center',
    finding: 'SIR submitted late in Q2 sample.',
    dueAt: '2026-07-01T00:00:00.000Z',
    status: 'open',
    createdAt: '2026-06-01T00:00:00.000Z',
    overdue: true,
    evidenceFileName: null,
  },
  {
    _id: 'cap_2',
    source: 'dds',
    finding: 'Missing quarterly progress reports.',
    dueAt: '2026-09-01T00:00:00.000Z',
    status: 'submitted',
    evidenceItemId: 'item_1',
    createdAt: '2026-08-01T00:00:00.000Z',
    overdue: false,
    evidenceFileName: 'cap-response.pdf',
  },
]

function mockCaps(caps: unknown[]) {
  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(
        queryRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'correctiveActions:listCorrectiveActions') return caps
      return undefined
    }) as unknown as typeof useQuery,
  )
}

let CorrectiveActionsCardUnderTest: (typeof import('./CorrectiveActionsCard'))['CorrectiveActionsCard']

function renderCard() {
  return render(
    <MemoryRouter>
      <CorrectiveActionsCardUnderTest clerkOrgId="org_123" />
    </MemoryRouter>,
  )
}

describe('CorrectiveActionsCard', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('./CorrectiveActionsCard')
    CorrectiveActionsCardUnderTest = module.CorrectiveActionsCard
  })

  it('shows the empty state when there are no corrective actions', () => {
    mockCaps([])
    renderCard()

    expect(screen.getByText('No corrective actions')).toBeInTheDocument()
  })

  it('renders CAPs with overdue badge, evidence, and flow actions', () => {
    mockCaps(CAPS)
    renderCard()

    expect(
      screen.getByText('SIR submitted late in Q2 sample.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Overdue · due/)).toBeInTheDocument()
    expect(screen.getByText('cap-response.pdf')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /mark submitted/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument()
  })

  it('opens the create dialog', () => {
    mockCaps([])
    renderCard()

    fireEvent.click(
      screen.getByRole('button', { name: /new corrective action/i }),
    )

    expect(screen.getByText('Finding')).toBeInTheDocument()
    expect(screen.getByLabelText('Source')).toBeInTheDocument()
  })
})
