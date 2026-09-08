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
    useMutation: vi.fn(() => vi.fn()),
  }
})

import { useQuery } from 'convex/react'

const VISITS = {
  visits: [
    {
      shiftId: 'shift_1',
      serviceType: 'SLS',
      clientId: 'client_1',
      recipientName: 'Alex Rivera',
      date: '2026-08-10',
      beginAt: '2026-08-10T09:05:00.000Z',
      endAt: '2026-08-10T12:55:00.000Z',
      location: 'Client home',
      caregiverId: 'user_cg',
      providerName: 'Caregiver One',
    },
  ],
  excludedLiveInCount: 2,
}

const ATTESTATIONS = [
  {
    _id: 'item_1',
    subjectId: 'profile_1',
    employeeName: 'Live-In Caregiver',
    status: 'active',
    expiresAt: '2027-08-01T00:00:00.000Z',
    expired: false,
    createdAt: '2026-08-01T00:00:00.000Z',
  },
]

function mockEvvState({
  visits = VISITS,
  attestations = ATTESTATIONS,
}: {
  visits?: unknown
  attestations?: unknown
} = {}) {
  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(
        queryRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'evv:getEvvVisits') return visits
      if (name === 'evv:listLiveInAttestations') return attestations
      if (name === 'evv:listEvvEmployeeOptions') {
        return [{ employeeProfileId: 'profile_1', displayName: 'Live-In Caregiver' }]
      }
      return undefined
    }) as unknown as typeof useQuery,
  )
}

let EvvExportPageUnderTest: (typeof import('./EvvExportPage'))['EvvExportPage']

describe('EvvExportPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('./EvvExportPage')
    EvvExportPageUnderTest = module.EvvExportPage
  })

  it('labels the export as an alternate-EVV submission aid', () => {
    mockEvvState()
    render(
      <MemoryRouter>
        <EvvExportPageUnderTest />
      </MemoryRouter>,
    )

    expect(
      screen.getByText(/Alternate-EVV submission aid/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/not a live Sandata\/CalEVV integration/i)).toBeInTheDocument()
  })

  it('renders visit rows with the six EVV elements and the excluded count', () => {
    mockEvvState()
    render(
      <MemoryRouter>
        <EvvExportPageUnderTest />
      </MemoryRouter>,
    )

    expect(screen.getByText('Alex Rivera')).toBeInTheDocument()
    expect(screen.getByText('Caregiver One')).toBeInTheDocument()
    expect(screen.getByText('Client home')).toBeInTheDocument()
    expect(screen.getByText('SLS')).toBeInTheDocument()
    expect(
      screen.getByText('2 live-in exempt visits excluded'),
    ).toBeInTheDocument()
  })

  it('shows the empty state when no visits are in range', () => {
    mockEvvState({ visits: { visits: [], excludedLiveInCount: 0 } })
    render(
      <MemoryRouter>
        <EvvExportPageUnderTest />
      </MemoryRouter>,
    )

    expect(screen.getByText('No visits in range')).toBeInTheDocument()
  })

  it('renders the live-in attestation section', () => {
    mockEvvState()
    render(
      <MemoryRouter>
        <EvvExportPageUnderTest />
      </MemoryRouter>,
    )

    expect(
      screen.getByText('Live-in caregiver attestations'),
    ).toBeInTheDocument()
    // The name appears in both the attestation table and the employee picker.
    expect(screen.getAllByText('Live-In Caregiver').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('button', { name: /record attestation/i }),
    ).toBeInTheDocument()
  })
})
