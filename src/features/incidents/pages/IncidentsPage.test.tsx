import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { getFunctionName } from 'convex/server'

vi.mock('@clerk/react', async () => {
  const actual = await vi.importActual<typeof import('@clerk/react')>(
    '@clerk/react',
  )
  return {
    ...actual,
    useOrganization: vi.fn(() => ({
      organization: { id: 'org_123', name: 'Agency' },
    })),
  }
})

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>(
    'convex/react',
  )
  return {
    ...actual,
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
    useConvex: () => ({ query: vi.fn() }),
    useQuery: vi.fn(),
    useMutation: vi.fn(),
  }
})

import { useQuery } from 'convex/react'

const CLIENT_OPTIONS = [
  { clientId: 'client_1', displayName: 'Alex Rivera' },
  { clientId: 'client_2', displayName: 'Sam Lee' },
]

function mockIncidentsState(incidents: unknown[]) {
  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(
        queryRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'incidents:listIncidents') return incidents
      if (name === 'incidents:listIncidentClientOptions') return CLIENT_OPTIONS
      return undefined
    }) as unknown as typeof useQuery,
  )
}

function renderPage() {
  return render(
    <MemoryRouter>
      <IncidentsPageUnderTest />
    </MemoryRouter>,
  )
}

// Imported lazily inside the tests so the convex/react mock is in place.
let IncidentsPageUnderTest: (typeof import('./IncidentsPage'))['IncidentsPage']

describe('IncidentsPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('./IncidentsPage')
    IncidentsPageUnderTest = module.IncidentsPage
  })

  it('shows the empty state when there are no incidents', () => {
    mockIncidentsState([])

    renderPage()

    expect(screen.getByText('No incidents')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /new incident/i }),
    ).toHaveAttribute('href', '/incidents/new')
  })

  it('renders rows with status and SLA badges', () => {
    mockIncidentsState([
      {
        _id: 'incident_1',
        clientName: 'Alex Rivera',
        category: 'medication_error',
        occurredAt: '2026-08-10T08:00:00.000Z',
        learnedAt: '2026-08-10T10:00:00.000Z',
        location: 'Client home',
        status: 'draft',
        verbalBreached: true,
        writtenBreached: false,
      },
      {
        _id: 'incident_2',
        clientName: 'Sam Lee',
        category: 'death',
        occurredAt: '2026-08-01T08:00:00.000Z',
        learnedAt: '2026-08-01T09:00:00.000Z',
        location: 'Day program',
        status: 'closed',
        verbalReportedAt: '2026-08-01T10:00:00.000Z',
        writtenSubmittedAt: '2026-08-02T10:00:00.000Z',
        verbalBreached: false,
        writtenBreached: false,
      },
    ])

    renderPage()

    // The name appears in both the table row and the client filter dropdown.
    expect(screen.getAllByText('Alex Rivera').length).toBeGreaterThan(0)
    expect(screen.getByText('Medication error')).toBeInTheDocument()
    expect(screen.getByText('24h report overdue')).toBeInTheDocument()
    expect(screen.getByText('48h report pending')).toBeInTheDocument()
    // "Report pending" also labels the draft option in the status filter.
    expect(screen.getAllByText('Report pending').length).toBeGreaterThan(0)

    // Closed incidents show no SLA badges.
    expect(screen.getAllByText('Sam Lee').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Closed').length).toBeGreaterThan(0)
    expect(screen.queryByText('24h report late')).not.toBeInTheDocument()
  })

  it('marks a late-filed report with a danger badge', () => {
    mockIncidentsState([
      {
        _id: 'incident_3',
        clientName: 'Alex Rivera',
        category: 'suspected_abuse',
        occurredAt: '2026-08-10T08:00:00.000Z',
        learnedAt: '2026-08-10T10:00:00.000Z',
        location: 'Client home',
        status: 'verbal_reported',
        verbalReportedAt: '2026-08-12T10:00:00.000Z',
        verbalBreached: true,
        writtenBreached: true,
      },
    ])

    renderPage()

    expect(screen.getByText('24h report late')).toBeInTheDocument()
    expect(screen.getByText('48h report overdue')).toBeInTheDocument()
    expect(screen.getByText('Suspected abuse')).toBeInTheDocument()
  })
})
