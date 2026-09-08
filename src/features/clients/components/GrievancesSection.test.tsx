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

const GRIEVANCES = [
  {
    _id: 'grievance_1',
    clientId: 'client_1',
    filedAt: '2026-08-03T10:00:00.000Z',
    filedBy: 'Alex Rivera',
    description: 'Staff arrived late repeatedly.',
    status: 'open',
    createdAt: '2026-08-03T10:05:00.000Z',
    slaDueAt: '2026-08-10T23:59:59.999Z',
    slaBreached: true,
    clientName: 'Alex Rivera',
  },
  {
    _id: 'grievance_2',
    clientId: 'client_1',
    filedAt: '2026-08-12T10:00:00.000Z',
    filedBy: 'Authorized rep',
    description: 'Schedule changed without notice.',
    status: 'resolved',
    resolutionNote: 'Schedule restored and apology issued.',
    proposedAt: '2026-08-13T10:00:00.000Z',
    resolvedAt: '2026-08-14T10:00:00.000Z',
    createdAt: '2026-08-12T10:05:00.000Z',
    slaDueAt: '2026-08-19T23:59:59.999Z',
    slaBreached: false,
    clientName: 'Alex Rivera',
  },
]

function mockGrievances(grievances: unknown[]) {
  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(
        queryRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'grievances:listGrievances') return grievances
      return undefined
    }) as unknown as typeof useQuery,
  )
}

let GrievancesSectionUnderTest: (typeof import('./GrievancesSection'))['GrievancesSection']

function renderSection() {
  return render(
    <MemoryRouter>
      <GrievancesSectionUnderTest
        clerkOrgId="org_123"
        clientId={'client_1' as never}
      />
    </MemoryRouter>,
  )
}

describe('GrievancesSection', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('./GrievancesSection')
    GrievancesSectionUnderTest = module.GrievancesSection
  })

  it('shows the empty state when there are no grievances', () => {
    mockGrievances([])
    renderSection()

    expect(screen.getByText('No grievances on file')).toBeInTheDocument()
  })

  it('renders rows with status and SLA badges', () => {
    mockGrievances(GRIEVANCES)
    renderSection()

    expect(screen.getByText('Staff arrived late repeatedly.')).toBeInTheDocument()
    expect(screen.getByText(/Overdue · due/)).toBeInTheDocument()
    expect(screen.getByText('Resolved')).toBeInTheDocument()
    expect(screen.getByText('Closed')).toBeInTheDocument()
    // Open grievance offers propose/resolve/escalate actions.
    expect(
      screen.getByRole('button', { name: /propose resolution/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /escalate/i })).toBeInTheDocument()
  })

  it('opens the file dialog', () => {
    mockGrievances([])
    renderSection()

    fireEvent.click(screen.getByRole('button', { name: /file grievance/i }))

    expect(screen.getByText('Filed by')).toBeInTheDocument()
    expect(
      screen.getByText(/5 business days of filing/i),
    ).toBeInTheDocument()
  })
})
