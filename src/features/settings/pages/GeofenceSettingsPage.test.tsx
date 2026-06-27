import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'

const mocks = {
  updateShiftGeofence: vi.fn(),
}

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
    useQuery: vi.fn(),
    useMutation: vi.fn(),
  }
})

import { useMutation, useQuery } from 'convex/react'
import { GeofenceSettingsPage } from './GeofenceSettingsPage'

const defaultGeofence = {
  enabled: false,
  enforceClockIn: false,
  enforceClockOut: false,
  defaultRadiusMeters: 100,
  maxAccuracyMeters: 50,
}

function mockSettingsState(settings: { shiftGeofence: typeof defaultGeofence }) {
  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(queryRef as Parameters<typeof getFunctionName>[0])
      if (name === 'tenantSettings:get') return settings
      return undefined
    }) as unknown as typeof useQuery,
  )

  vi.mocked(useMutation).mockImplementation(
    ((mutationRef: unknown) => {
      const name = getFunctionName(mutationRef as Parameters<typeof getFunctionName>[0])
      if (name === 'tenantSettings:updateShiftGeofence') return mocks.updateShiftGeofence
      return vi.fn()
    }) as unknown as typeof useMutation,
  )
}

describe('GeofenceSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the current geofence settings', () => {
    mockSettingsState({ shiftGeofence: defaultGeofence })
    render(<GeofenceSettingsPage />)

    expect(screen.getByRole('heading', { name: /Clock-in location rules/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Enable geofence/i })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Enforce on clock-in/i })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /Enforce on clock-out/i })).toBeDisabled()
    expect(screen.getByDisplayValue('100')).toBeInTheDocument()
    expect(screen.getByDisplayValue('50')).toBeInTheDocument()
  })

  it('toggles enforcement options when geofence is enabled', async () => {
    const user = userEvent.setup()
    mockSettingsState({ shiftGeofence: defaultGeofence })
    render(<GeofenceSettingsPage />)

    const enabledCheckbox = screen.getByRole('checkbox', { name: /Enable geofence/i })
    await user.click(enabledCheckbox)

    const clockInCheckbox = screen.getByRole('checkbox', { name: /Enforce on clock-in/i })
    const clockOutCheckbox = screen.getByRole('checkbox', { name: /Enforce on clock-out/i })
    expect(clockInCheckbox).toBeEnabled()
    expect(clockOutCheckbox).toBeEnabled()

    await user.click(clockInCheckbox)
    await user.click(clockOutCheckbox)
    expect(clockInCheckbox).toBeChecked()
    expect(clockOutCheckbox).toBeChecked()
  })

  it('saves updated geofence settings', async () => {
    const user = userEvent.setup()
    mocks.updateShiftGeofence.mockResolvedValueOnce(undefined)
    mockSettingsState({ shiftGeofence: defaultGeofence })
    render(<GeofenceSettingsPage />)

    await user.click(screen.getByRole('checkbox', { name: /Enable geofence/i }))
    await user.click(screen.getByRole('checkbox', { name: /Enforce on clock-in/i }))

    const radiusInput = within(screen.getByText('Default radius (meters)').parentElement!).getByRole('spinbutton')
    const accuracyInput = within(screen.getByText('Max accuracy (meters)').parentElement!).getByRole('spinbutton')

    await user.clear(radiusInput)
    await user.type(radiusInput, '200')
    await user.clear(accuracyInput)
    await user.type(accuracyInput, '25')

    await user.click(screen.getByRole('button', { name: /Save geofence settings/i }))

    await waitFor(() => {
      expect(mocks.updateShiftGeofence).toHaveBeenCalledTimes(1)
    })
    expect(mocks.updateShiftGeofence).toHaveBeenCalledWith({
      clerkOrgId: 'org_123',
      enabled: true,
      enforceClockIn: true,
      enforceClockOut: false,
      defaultRadiusMeters: 200,
      maxAccuracyMeters: 25,
    })
    expect(screen.getByText('Geofence settings saved.')).toBeInTheDocument()
  })
})
