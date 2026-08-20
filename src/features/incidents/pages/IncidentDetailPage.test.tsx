import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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
    useMutation: vi.fn(() => vi.fn()),
  }
})

import { useQuery } from 'convex/react'

function makeIncident(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'incident_1',
    clientName: 'Alex Rivera',
    category: 'medication_error',
    occurredAt: '2026-08-19T08:00:00.000Z',
    learnedAt: '2026-08-19T10:00:00.000Z',
    location: 'Client home',
    description: 'Wrong dose administered.',
    actionsTaken: 'Poison control contacted.',
    status: 'draft',
    agenciesNotified: [],
    verbalDueAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    writtenDueAt: new Date(Date.now() + 29 * 60 * 60 * 1000).toISOString(),
    verbalBreached: false,
    writtenBreached: false,
    updates: [],
    ...overrides,
  }
}

function mockIncident(incident: unknown) {
  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(
        queryRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'incidents:getIncident') return incident
      return undefined
    }) as unknown as typeof useQuery,
  )
}

// Imported lazily inside the tests so the convex/react mock is in place.
let IncidentDetailPageUnderTest: (typeof import('./IncidentDetailPage'))['IncidentDetailPage']

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/incidents/incident_1']}>
      <Routes>
        <Route
          path="/incidents/:incidentId"
          element={<IncidentDetailPageUnderTest />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('IncidentDetailPage countdown banner', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('./IncidentDetailPage')
    IncidentDetailPageUnderTest = module.IncidentDetailPage
  })

  it('shows the plain-language 24h countdown for an open incident', () => {
    mockIncident(makeIncident())

    renderPage()

    expect(
      screen.getByText(/Call the regional center within 5 hours — 1 of 5 parts done/),
    ).toBeInTheDocument()
  })

  it('switches to the written-report countdown after the call is recorded', () => {
    mockIncident(
      makeIncident({
        status: 'verbal_reported',
        verbalReportedAt: '2026-08-19T11:00:00.000Z',
      }),
    )

    renderPage()

    expect(
      screen.getByText(/Written report due in 29 hours — 2 of 5 parts done/),
    ).toBeInTheDocument()
  })

  it('hides the banner for closed incidents', () => {
    mockIncident(
      makeIncident({
        status: 'closed',
        verbalReportedAt: '2026-08-19T11:00:00.000Z',
        writtenSubmittedAt: '2026-08-20T08:00:00.000Z',
      }),
    )

    renderPage()

    expect(screen.queryByText(/parts done/)).not.toBeInTheDocument()
  })
})
