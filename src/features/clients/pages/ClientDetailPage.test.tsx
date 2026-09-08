import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { getFunctionName } from 'convex/server'

const mocks = {
  updateProfile: vi.fn(),
  createObjective: vi.fn(),
  updateObjective: vi.fn(),
  discontinueObjective: vi.fn(),
}

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

import { useMutation, useQuery } from 'convex/react'

const baseClient = {
  _id: 'client_1',
  displayName: 'Alex Rivera',
  serviceType: 'SLS',
  authorizationHours: 40,
  riskFlags: ['fall-risk'],
  uci: 'UCI-12345',
  dob: '1980-05-14',
  conservatorName: 'Pat Rivera',
  conservatorPhone: '555-0100',
  emergencyContacts: [
    { name: 'Pat Rivera', phone: '555-0100', relationship: 'Mother' },
  ],
  regionalCenter: 'Alta California Regional Center',
  serviceCoordinatorName: 'Sam Chen',
  serviceCoordinatorEmail: 'sam@altaregional.org',
  vendorNumber: 'V12345',
  serviceCode: '896',
}

const activeObjective = {
  _id: 'objective_1',
  clientId: 'client_1',
  title: 'Prepare a simple meal',
  description: 'Uses microwave safely',
  source: 'ipp',
  targetDate: '2026-12-31',
  hoursPerMonth: 6,
  status: 'active',
  createdAt: '2026-08-01T00:00:00.000Z',
}

function mockDetailState(options: {
  client?: unknown
  objectives?: unknown[]
  usage?: unknown
}) {
  const client = options.client ?? baseClient
  const objectives = options.objectives ?? [activeObjective]
  const usage = options.usage ?? {
    month: '2026-08',
    deliveredHours: 6.5,
    authorizedHours: 40,
  }

  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(
        queryRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'clients:get') return client
      if (name === 'clientObjectives:listByClient') return objectives
      if (name === 'clients:getMonthlyUsage') return usage
      return undefined
    }) as unknown as typeof useQuery,
  )

  vi.mocked(useMutation).mockImplementation(
    ((mutationRef: unknown) => {
      const name = getFunctionName(
        mutationRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'clients:updateProfile') return mocks.updateProfile
      if (name === 'clientObjectives:create') return mocks.createObjective
      if (name === 'clientObjectives:update') return mocks.updateObjective
      if (name === 'clientObjectives:discontinue')
        return mocks.discontinueObjective
      return vi.fn()
    }) as unknown as typeof useMutation,
  )
}

async function renderPage() {
  const { ClientDetailPage } = await import('./ClientDetailPage')
  render(
    <MemoryRouter initialEntries={['/clients/client_1']}>
      <Routes>
        <Route path="/clients/:clientId" element={<ClientDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ClientDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders profile details, the hours indicator, and objectives', async () => {
    mockDetailState({})
    await renderPage()

    expect(screen.getByText('Alex Rivera')).toBeInTheDocument()
    expect(screen.getByTestId('hours-usage')).toHaveTextContent(
      'Authorized hours this month: 6.50 of 40',
    )

    // Profile fields
    expect(screen.getByText('UCI-12345')).toBeInTheDocument()
    expect(screen.getByText('05/14/1980')).toBeInTheDocument()
    expect(
      screen.getByText('Alta California Regional Center'),
    ).toBeInTheDocument()
    expect(screen.getByText('Sam Chen')).toBeInTheDocument()
    expect(screen.getByText('V12345')).toBeInTheDocument()
    expect(screen.getByText('896')).toBeInTheDocument()
    expect(
      screen.getByText('Pat Rivera · 555-0100 · Mother'),
    ).toBeInTheDocument()

    // Objective row
    expect(screen.getByText('Prepare a simple meal')).toBeInTheDocument()
    expect(screen.getByText('IPP')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('12/31/2026')).toBeInTheDocument()
  })

  it('shows an empty state when the client has no objectives', async () => {
    mockDetailState({ objectives: [] })
    await renderPage()

    expect(screen.getByText('No objectives yet')).toBeInTheDocument()
  })

  it('creates an objective from the add dialog', async () => {
    const user = userEvent.setup()
    mockDetailState({})
    mocks.createObjective.mockResolvedValueOnce('objective_2')
    await renderPage()

    await user.click(screen.getByRole('button', { name: /^add objective$/i }))

    const titleInput = screen.getByPlaceholderText(
      'e.g. Prepare a simple meal',
    )
    await user.type(titleInput, 'Ride the bus independently')
    await user.click(screen.getAllByRole('button', { name: /^add objective$/i })[1])

    await waitFor(() => {
      expect(mocks.createObjective).toHaveBeenCalledTimes(1)
    })
    expect(mocks.createObjective).toHaveBeenCalledWith({
      clerkOrgId: 'org_123',
      clientId: 'client_1',
      title: 'Ride the bus independently',
      source: 'ipp',
      description: undefined,
      targetDate: undefined,
      hoursPerMonth: undefined,
    })
  })

  it('discontinues an active objective', async () => {
    const user = userEvent.setup()
    mockDetailState({})
    mocks.discontinueObjective.mockResolvedValueOnce('objective_1')
    await renderPage()

    await user.click(screen.getByRole('button', { name: /^discontinue$/i }))

    await waitFor(() => {
      expect(mocks.discontinueObjective).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        objectiveId: 'objective_1',
      })
    })
  })

  it('marks an active objective achieved', async () => {
    const user = userEvent.setup()
    mockDetailState({})
    mocks.updateObjective.mockResolvedValueOnce('objective_1')
    await renderPage()

    await user.click(screen.getByRole('button', { name: /^achieve$/i }))

    await waitFor(() => {
      expect(mocks.updateObjective).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        objectiveId: 'objective_1',
        status: 'achieved',
      })
    })
  })

  it('saves profile edits via updateProfile', async () => {
    const user = userEvent.setup()
    mockDetailState({})
    mocks.updateProfile.mockResolvedValueOnce('client_1')
    await renderPage()

    await user.click(screen.getByRole('button', { name: /^edit profile$/i }))

    const uciInput = screen.getByDisplayValue('UCI-12345')
    await user.clear(uciInput)
    await user.type(uciInput, 'UCI-99999')
    await user.click(screen.getByRole('button', { name: /^save profile$/i }))

    await waitFor(() => {
      expect(mocks.updateProfile).toHaveBeenCalledTimes(1)
    })
    expect(mocks.updateProfile).toHaveBeenCalledWith({
      clerkOrgId: 'org_123',
      clientId: 'client_1',
      uci: 'UCI-99999',
      dob: '1980-05-14',
      conservatorName: 'Pat Rivera',
      conservatorPhone: '555-0100',
      regionalCenter: 'Alta California Regional Center',
      serviceCoordinatorName: 'Sam Chen',
      serviceCoordinatorEmail: 'sam@altaregional.org',
      vendorNumber: 'V12345',
      serviceCode: '896',
      emergencyContacts: [
        { name: 'Pat Rivera', phone: '555-0100', relationship: 'Mother' },
      ],
    })
  })
})
