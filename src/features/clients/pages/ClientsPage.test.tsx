import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'

const mocks = {
  createClient: vi.fn(),
  createShift: vi.fn(),
  createManyShifts: vi.fn(),
  updateServiceAddress: vi.fn(),
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
    useQuery: vi.fn(),
    useMutation: vi.fn(),
  }
})

import { useMutation, useQuery } from 'convex/react'

const defaultGeofence = {
  enabled: false,
  enforceClockIn: false,
  enforceClockOut: false,
  defaultRadiusMeters: 150,
  maxAccuracyMeters: 100,
}

function mockClientsState(options: {
  clients?: unknown[]
  caregivers?: unknown[]
  tenantSettings?: { shiftGeofence: typeof defaultGeofence }
}) {
  const clients = options.clients ?? []
  const caregivers = options.caregivers ?? []
  const tenantSettings = options.tenantSettings ?? { shiftGeofence: defaultGeofence }

  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(queryRef as Parameters<typeof getFunctionName>[0])
      if (name === 'clients:list') return clients
      if (name === 'members:listCaregivers') return caregivers
      if (name === 'tenantSettings:get') return tenantSettings
      return undefined
    }) as unknown as typeof useQuery,
  )

  vi.mocked(useMutation).mockImplementation(
    ((mutationRef: unknown) => {
      const name = getFunctionName(mutationRef as Parameters<typeof getFunctionName>[0])
      if (name === 'clients:create') return mocks.createClient
      if (name === 'shifts:create') return mocks.createShift
      if (name === 'shifts:createMany') return mocks.createManyShifts
      if (name === 'clients:updateServiceAddress') return mocks.updateServiceAddress
      return vi.fn()
    }) as unknown as typeof useMutation,
  )
}

describe('ClientsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses caregiver email as the scheduling dropdown label', async () => {
    const { ClientsPage } = await import('./ClientsPage')

    mockClientsState({
      clients: [
        {
          _id: 'client_1',
          displayName: 'Alex Rivera',
          serviceType: 'SLS',
          authorizationHours: 40,
          riskFlags: [],
          serviceAddress: {
            line1: '123 Main St',
            city: 'Minneapolis',
            state: 'MN',
            postalCode: '55401',
            latitude: 44.9778,
            longitude: -93.265,
          },
        },
      ],
      caregivers: [
        {
          _id: 'member_1',
          clerkUserId: 'user_caregiver',
          displayName: 'User',
          email: 'caregiver1@agency.com',
          role: 'org:caregiver',
        },
      ],
    })

    render(<ClientsPage />)

    fireEvent.click(screen.getAllByRole('button', { name: /^schedule$/i })[0])

    expect(screen.getByText('caregiver1@agency.com')).toBeInTheDocument()
    expect(screen.queryByText('User')).not.toBeInTheDocument()
  })

  it('opens the address dialog and saves the service address', async () => {
    const user = userEvent.setup()
    const { ClientsPage } = await import('./ClientsPage')
    mocks.updateServiceAddress.mockResolvedValueOnce(undefined)

    mockClientsState({
      clients: [
        {
          _id: 'client_1',
          displayName: 'Alex Rivera',
          serviceType: 'SLS',
          authorizationHours: 40,
          riskFlags: [],
          serviceAddress: {
            line1: '123 Main St',
            city: 'Minneapolis',
            state: 'MN',
            postalCode: '55401',
          },
        },
      ],
    })

    render(<ClientsPage />)

    await user.click(screen.getAllByRole('button', { name: /^address$/i })[0])

    expect(screen.getByText('Service Address')).toBeInTheDocument()

    const line1Input = within(screen.getByText('Address line 1').parentElement!).getByRole('textbox')
    const cityInput = within(screen.getByText('City').parentElement!).getByRole('textbox')
    const latitudeInput = within(screen.getByText('Latitude').parentElement!).getByRole('spinbutton')
    const longitudeInput = within(screen.getByText('Longitude').parentElement!).getByRole('spinbutton')

    await user.clear(line1Input)
    await user.type(line1Input, '456 Oak Ave')
    await user.clear(cityInput)
    await user.type(cityInput, 'St. Paul')
    await user.type(latitudeInput, '44.9537')
    await user.type(longitudeInput, '-93.09')

    await user.click(screen.getByRole('button', { name: /^save address$/i }))

    await waitFor(() => {
      expect(mocks.updateServiceAddress).toHaveBeenCalledTimes(1)
    })
    expect(mocks.updateServiceAddress).toHaveBeenCalledWith({
      clerkOrgId: 'org_123',
      clientId: 'client_1',
      serviceAddress: {
        line1: '456 Oak Ave',
        line2: undefined,
        city: 'St. Paul',
        state: 'MN',
        postalCode: '55401',
        country: undefined,
        latitude: 44.9537,
        longitude: -93.09,
      },
    })
  })

  it('shows a geofence warning when enforcement is enabled and a client lacks coordinates', async () => {
    const { ClientsPage } = await import('./ClientsPage')

    mockClientsState({
      clients: [
        {
          _id: 'client_1',
          displayName: 'Alex Rivera',
          serviceType: 'SLS',
          authorizationHours: 40,
          riskFlags: [],
          serviceAddress: {
            line1: '123 Main St',
            city: 'Minneapolis',
            state: 'MN',
            postalCode: '55401',
          },
        },
      ],
      tenantSettings: {
        shiftGeofence: {
          ...defaultGeofence,
          enabled: true,
          enforceClockIn: true,
        },
      },
    })

    render(<ClientsPage />)

    expect(
      screen.getByText(/Geofence is enabled, but some clients are missing latitude\/longitude/i),
    ).toBeInTheDocument()
  })

  it('does not show a geofence warning when all clients have coordinates', async () => {
    const { ClientsPage } = await import('./ClientsPage')

    mockClientsState({
      clients: [
        {
          _id: 'client_1',
          displayName: 'Alex Rivera',
          serviceType: 'SLS',
          authorizationHours: 40,
          riskFlags: [],
          serviceAddress: {
            line1: '123 Main St',
            city: 'Minneapolis',
            state: 'MN',
            postalCode: '55401',
            latitude: 44.9778,
            longitude: -93.265,
          },
        },
      ],
      tenantSettings: {
        shiftGeofence: {
          ...defaultGeofence,
          enabled: true,
        },
      },
    })

    render(<ClientsPage />)

    expect(
      screen.queryByText(/Geofence is enabled, but some clients are missing latitude\/longitude/i),
    ).not.toBeInTheDocument()
  })
})
