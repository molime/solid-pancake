import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'

const mocks = {
  clockIn: vi.fn(),
  clockOut: vi.fn(),
  updateProgressNote: vi.fn(),
}

vi.mock('@clerk/react', async () => {
  const actual = await vi.importActual<typeof import('@clerk/react')>('@clerk/react')
  return {
    ...actual,
    useOrganization: vi.fn(() => ({
      organization: { id: 'org_123', name: 'Agency' },
    })),
    useUser: vi.fn(() => ({ user: { firstName: 'Ana' } })),
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
import { ShiftDocumentationForm } from './ShiftDocumentationForm'

const shiftId = 'shift_123' as import('../../../../convex/_generated/dataModel').Id<'shifts'>

function makeDetails(overrides?: {
  status?: string
  clockInAt?: string | null
  clockOutAt?: string | null
  note?: Record<string, string>
  tasks?: Array<{
    _id: string
    title: string
    requiredProof: boolean
    status: 'pending' | 'complete'
    proofName?: string
  }>
}) {
  return {
    shift: {
      _id: shiftId,
      tenantId: 'tenant_123' as import('../../../../convex/_generated/dataModel').Id<'tenants'>,
      clientId: 'client_123' as import('../../../../convex/_generated/dataModel').Id<'clients'>,
      caregiverId: 'user_123',
      scheduledStart: '2026-06-25T08:00:00Z',
      scheduledEnd: '2026-06-25T16:00:00Z',
      status: overrides?.status ?? 'scheduled',
      serviceType: 'SLS',
      rate: 25,
      clockInAt: overrides?.clockInAt ?? null,
      clockOutAt: overrides?.clockOutAt ?? null,
    },
    client: {
      _id: 'client_123' as import('../../../../convex/_generated/dataModel').Id<'clients'>,
      tenantId: 'tenant_123' as import('../../../../convex/_generated/dataModel').Id<'tenants'>,
      name: 'Client A',
      displayName: 'Maria Lopez',
      serviceType: 'SLS',
      serviceAddress: {
        line1: '1820 Oak Street',
        line2: 'Apt 4',
        city: 'Anytown',
        state: 'CA',
        postalCode: '90210',
      },
    },
    note: {
      _id: 'note_123' as import('../../../../convex/_generated/dataModel').Id<'progressNotes'>,
      tenantId: 'tenant_123' as import('../../../../convex/_generated/dataModel').Id<'tenants'>,
      shiftId,
      startTime: '',
      endTime: '',
      servicesProvided: '',
      clientResponse: '',
      narrative: '',
      ...overrides?.note,
    },
    tasks: overrides?.tasks ?? [
      {
        _id: 'task_1',
        tenantId: 'tenant_123',
        shiftId,
        title: 'Observation note',
        requiredProof: true,
        status: 'pending' as const,
      },
    ],
    reviews: [],
  }
}

function mockState(options?: {
  geofenceEnabled?: boolean
  geofenceEnforceClockIn?: boolean
  geofenceEnforceClockOut?: boolean
  details?: ReturnType<typeof makeDetails>
}) {
  const details = options?.details ?? makeDetails()
  const geofence = {
    enabled: options?.geofenceEnabled ?? false,
    enforceClockIn: options?.geofenceEnforceClockIn ?? false,
    enforceClockOut: options?.geofenceEnforceClockOut ?? false,
    defaultRadiusMeters: 150,
    maxAccuracyMeters: 100,
  }

  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(queryRef as Parameters<typeof getFunctionName>[0])
      if (name === 'shiftQueries:getWithDetails') return details
      if (name === 'tenantSettings:get') return { tenantId: 'tenant_123', shiftGeofence: geofence }
      return undefined
    }) as unknown as typeof useQuery,
  )

  vi.mocked(useMutation).mockImplementation(
    ((mutationRef: unknown) => {
      const name = getFunctionName(mutationRef as Parameters<typeof getFunctionName>[0])
      if (name === 'shifts:clockIn') return mocks.clockIn
      if (name === 'shifts:clockOut') return mocks.clockOut
      if (name === 'shifts:updateProgressNote') return mocks.updateProgressNote
      return vi.fn()
    }) as unknown as typeof useMutation,
  )
}

const mockGetCurrentPosition = vi.fn()

describe('ShiftDocumentationForm', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: mockGetCurrentPosition,
      },
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the clock-in screen when not clocked in', () => {
    mockState({ geofenceEnabled: false })
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} />)
    expect(screen.getByRole('button', { name: /Clock in now/i })).toBeInTheDocument()
  })

  it('does not request location when geofence is disabled', async () => {
    mockState({ geofenceEnabled: false })
    mocks.clockIn.mockResolvedValueOnce({ punchId: 'punch_1', clockInAt: '2026-06-25T08:01:00Z' })
    const user = userEvent.setup()
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} />)

    await user.click(screen.getByRole('button', { name: /Clock in now/i }))

    await waitFor(() => {
      expect(mockGetCurrentPosition).not.toHaveBeenCalled()
      expect(mocks.clockIn).toHaveBeenCalledWith({ clerkOrgId: 'org_123', shiftId, location: undefined })
    })
  })

  it('requests location when geofence is enabled for clock-in', async () => {
    mockState({ geofenceEnabled: true, geofenceEnforceClockIn: true })
    mocks.clockIn.mockResolvedValueOnce({ punchId: 'punch_1', clockInAt: '2026-06-25T08:01:00Z' })
    mockGetCurrentPosition.mockImplementation((success: (p: GeolocationPosition) => void) =>
      success({ coords: { latitude: 44.98, longitude: -93.26, accuracy: 10 } } as GeolocationPosition),
    )
    const user = userEvent.setup()
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} />)

    await user.click(screen.getByRole('button', { name: /Clock in now/i }))

    await waitFor(() => {
      expect(mockGetCurrentPosition).toHaveBeenCalledOnce()
      expect(mocks.clockIn).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        shiftId,
        location: { latitude: 44.98, longitude: -93.26, accuracyMeters: 10 },
      })
    })
  })

  it('shows blocked state when location permission is denied', async () => {
    mockState({ geofenceEnabled: true, geofenceEnforceClockIn: true })
    mockGetCurrentPosition.mockImplementation((_: unknown, error: (e: GeolocationPositionError) => void) =>
      error({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError),
    )
    const user = userEvent.setup()
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} />)

    await user.click(screen.getByRole('button', { name: /Clock in now/i }))

    await waitFor(() => {
      expect(screen.getByText(/Location access was denied/i)).toBeInTheDocument()
    })
    expect(mocks.clockIn).not.toHaveBeenCalled()
  })

  it('disables the clock-in button and shows a loading label while punching', async () => {
    mockState({ geofenceEnabled: false })
    mocks.clockIn.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} />)

    const button = screen.getByRole('button', { name: /Clock in now/i })
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Clocking in…/i })).toBeDisabled()
    })
    expect(mocks.clockIn).toHaveBeenCalledTimes(1)
  })

  it('advances through each wizard step after clock-in', async () => {
    mockState({
      details: makeDetails({
        status: 'in_progress',
        clockInAt: '2026-06-25T08:01:00Z',
        tasks: [
          { _id: 'task_1', title: 'Observation note', requiredProof: false, status: 'pending' },
        ],
      }),
    })
    const user = userEvent.setup()
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} />)

    expect(screen.getByText(/When were you there/i)).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: /Change/i })[0])
    await user.type(screen.getByLabelText(/I started at/i), '08:00')
    await user.click(screen.getByRole('button', { name: /Change/i }))
    await user.type(screen.getByLabelText(/I finished at/i), '16:00')
    await user.click(screen.getByRole('button', { name: /Next Step/i }))
    expect(screen.getByText(/What did you help with/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Bathing/i }))
    await user.click(screen.getByRole('button', { name: /Next Step/i }))
    expect(screen.getByText(/How did the visit go/i)).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/I helped Maria/i), 'Cooperative and in good spirits')
    await user.click(screen.getByRole('button', { name: /Next Step/i }))
    expect(screen.getByText(/Did you work on her goals/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Walk a little each day/i }))
    await user.click(screen.getByRole('button', { name: /Next Step/i }))
    expect(screen.getByText(/Anything we should know/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /No, all good today/i }))
    await user.click(screen.getByRole('checkbox', { name: /Mark Observation note complete/i }))
    await user.click(screen.getByRole('button', { name: /Next Step/i }))
    expect(screen.getByText(/One last look/i)).toBeInTheDocument()
  })

  it('calls clockOut with location when geofence is enabled and note is complete', async () => {
    mockState({
      geofenceEnabled: true,
      geofenceEnforceClockOut: true,
      details: makeDetails({
        status: 'in_progress',
        clockInAt: '2026-06-25T08:01:00Z',
        note: {
          startTime: '08:00',
          endTime: '16:00',
          servicesProvided: 'Bathing, Meals, Walk a little each day goal',
          clientResponse: 'No problems — all good today',
          narrative: 'Done',
        },
        tasks: [
          { _id: 'task_1', title: 'Observation note', requiredProof: false, status: 'complete' },
        ],
      }),
    })
    mocks.clockOut.mockResolvedValueOnce({ punchId: 'punch_2', clockOutAt: '2026-06-25T16:01:00Z' })
    mockGetCurrentPosition.mockImplementation((success: (p: GeolocationPosition) => void) =>
      success({ coords: { latitude: 44.98, longitude: -93.26, accuracy: 10 } } as GeolocationPosition),
    )
    const user = userEvent.setup()
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} />)

    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByRole('button', { name: /Next Step/i }))
    }

    const confirmCheckbox = screen.getByRole('checkbox', { name: /I confirm this is accurate/i })
    await user.click(confirmCheckbox)

    const submitButton = screen.getByRole('button', { name: /Submit my notes/i })
    await waitFor(() => expect(submitButton).toBeEnabled())
    await user.click(submitButton)

    const submitButton2 = await screen.findByRole('button', { name: /Clock out now/i })
    await waitFor(() => expect(submitButton2).toBeEnabled())
    await user.click(submitButton2)

    await waitFor(() => {
      expect(mocks.clockOut).toHaveBeenCalledWith(
        expect.objectContaining({
          clerkOrgId: 'org_123',
          shiftId,
          location: { latitude: 44.98, longitude: -93.26, accuracyMeters: 10 },
        }),
      )
    })
  })

  it('shows outside-radius server error in plain language', async () => {
    mockState({
      geofenceEnabled: true,
      geofenceEnforceClockOut: true,
      details: makeDetails({
        status: 'in_progress',
        clockInAt: '2026-06-25T08:01:00Z',
        note: {
          startTime: '08:00',
          endTime: '16:00',
          servicesProvided: 'Bathing, Meals, Walk a little each day goal',
          clientResponse: 'No problems — all good today',
          narrative: 'Done',
        },
        tasks: [
          { _id: 'task_1', title: 'Observation note', requiredProof: false, status: 'complete' },
        ],
      }),
    })
    mocks.clockOut.mockRejectedValueOnce(
      new Error('You are 500m from the service location and outside the allowed 100m radius.'),
    )
    mockGetCurrentPosition.mockImplementation((success: (p: GeolocationPosition) => void) =>
      success({ coords: { latitude: 44.98, longitude: -93.26, accuracy: 10 } } as GeolocationPosition),
    )
    const user = userEvent.setup()
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} />)

    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByRole('button', { name: /Next Step/i }))
    }

    const confirmCheckbox = screen.getByRole('checkbox', { name: /I confirm this is accurate/i })
    await user.click(confirmCheckbox)

    const submitButton = screen.getByRole('button', { name: /Submit my notes/i })
    await waitFor(() => expect(submitButton).toBeEnabled())
    await user.click(submitButton)

    const submitButton2 = await screen.findByRole('button', { name: /Clock out now/i })
    await waitFor(() => expect(submitButton2).toBeEnabled())
    await user.click(submitButton2)

    await waitFor(() => {
      expect(document.body.textContent).toContain('500m from the service location')
    })
  })

  it('disables the clock-out button and shows a loading label while submitting', async () => {
    mockState({
      geofenceEnabled: false,
      details: makeDetails({
        status: 'in_progress',
        clockInAt: '2026-06-25T08:01:00Z',
        note: {
          startTime: '08:00',
          endTime: '16:00',
          servicesProvided: 'Bathing, Meals, Walk a little each day goal',
          clientResponse: 'No problems — all good today',
          narrative: 'Done',
        },
        tasks: [
          { _id: 'task_1', title: 'Observation note', requiredProof: false, status: 'complete' },
        ],
      }),
    })
    mocks.clockOut.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} />)

    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByRole('button', { name: /Next Step/i }))
    }

    const confirmCheckbox = screen.getByRole('checkbox', { name: /I confirm this is accurate/i })
    await user.click(confirmCheckbox)

    const submitButton = screen.getByRole('button', { name: /Submit my notes/i })
    await waitFor(() => expect(submitButton).toBeEnabled())
    await user.click(submitButton)

    const submitButton2 = await screen.findByRole('button', { name: /Clock out now/i })
    await waitFor(() => expect(submitButton2).toBeEnabled())
    await user.click(submitButton2)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Submitting…/i })).toBeDisabled()
    })
    expect(mocks.clockOut).toHaveBeenCalledTimes(1)
  })

  it('calls onDone when returning home from the success screen', async () => {
    const onDone = vi.fn()
    mockState({
      geofenceEnabled: false,
      details: makeDetails({
        status: 'in_progress',
        clockInAt: '2026-06-25T08:01:00Z',
        note: {
          startTime: '08:00',
          endTime: '16:00',
          servicesProvided: 'Bathing, Meals, Walk a little each day goal',
          clientResponse: 'No problems — all good today',
          narrative: 'Done',
        },
        tasks: [
          { _id: 'task_1', title: 'Observation note', requiredProof: false, status: 'complete' },
        ],
      }),
    })
    mocks.clockOut.mockResolvedValueOnce({ punchId: 'punch_2', clockOutAt: '2026-06-25T16:01:00Z' })
    const user = userEvent.setup()
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} onDone={onDone} />)

    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByRole('button', { name: /Next Step/i }))
    }

    const confirmCheckbox = screen.getByRole('checkbox', { name: /I confirm this is accurate/i })
    await user.click(confirmCheckbox)

    const submitButton = screen.getByRole('button', { name: /Submit my notes/i })
    await waitFor(() => expect(submitButton).toBeEnabled())
    await user.click(submitButton)

    const clockOutButton = await screen.findByRole('button', { name: /Clock out now/i })
    await waitFor(() => expect(clockOutButton).toBeEnabled())
    await user.click(clockOutButton)

    const homeButton = await screen.findByRole('button', { name: /Back to home/i })
    await user.click(homeButton)

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1)
    })
  })

  it('autosaves draft note fields', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockState({
      details: makeDetails({ status: 'in_progress', clockInAt: '2026-06-25T08:01:00Z' }),
    })
    mocks.updateProgressNote.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} />)

    await user.click(screen.getAllByRole('button', { name: /Change/i })[0])
    await user.type(screen.getByLabelText(/I started at/i), '08:00')

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(mocks.updateProgressNote).toHaveBeenCalledWith(
        expect.objectContaining({
          clerkOrgId: 'org_123',
          shiftId,
          startTime: '08:00',
        }),
      )
    })
    vi.useRealTimers()
  })
})
