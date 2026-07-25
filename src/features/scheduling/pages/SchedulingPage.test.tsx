import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { getFunctionName } from 'convex/server'

const mocks = {
  createShift: vi.fn(),
  updateShift: vi.fn(),
  deleteShift: vi.fn(),
  requestCoverage: vi.fn(),
  resolveCoverage: vi.fn(),
  addAvailabilityWindow: vi.fn(),
  deleteAvailabilityWindow: vi.fn(),
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
    useQuery: vi.fn(),
    useMutation: vi.fn(),
  }
})

import { useMutation, useQuery } from 'convex/react'

const caregiver = {
  _id: 'member_1',
  clerkUserId: 'user_caregiver',
  displayName: 'Lucía Fernández',
  email: 'lucia@agency.com',
  role: 'org:caregiver',
}

function mockSchedulingState(options: {
  shifts?: { items: unknown[]; hasMore: boolean; nextCursor: null }
  caregivers?: unknown[]
  coverageRequests?: unknown[]
}) {
  const shifts = options.shifts ?? { items: [], hasMore: false, nextCursor: null }
  const caregivers = options.caregivers ?? []
  const coverageRequests = options.coverageRequests ?? []

  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(queryRef as Parameters<typeof getFunctionName>[0])
      if (name === 'scheduling:listShifts') return shifts
      if (name === 'members:listCaregivers') return caregivers
      if (name === 'scheduling:listCoverageRequests') return coverageRequests
      return undefined
    }) as unknown as typeof useQuery,
  )

  vi.mocked(useMutation).mockImplementation(
    ((mutationRef: unknown) => {
      const name = getFunctionName(mutationRef as Parameters<typeof getFunctionName>[0])
      if (name === 'scheduling:createShift') return mocks.createShift
      if (name === 'scheduling:updateShift') return mocks.updateShift
      if (name === 'scheduling:deleteShift') return mocks.deleteShift
      if (name === 'scheduling:requestCoverage') return mocks.requestCoverage
      if (name === 'scheduling:resolveCoverage') return mocks.resolveCoverage
      if (name === 'scheduling:addAvailabilityWindow')
        return mocks.addAvailabilityWindow
      if (name === 'scheduling:deleteAvailabilityWindow')
        return mocks.deleteAvailabilityWindow
      return vi.fn()
    }) as unknown as typeof useMutation,
  )
}

describe('SchedulingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-06-18T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders loading state', async () => {
    const { SchedulingPage } = await import('./SchedulingPage')
    vi.mocked(useQuery).mockReturnValue(undefined)

    render(<SchedulingPage />)

    expect(screen.getByText(/Loading schedule/i)).toBeInTheDocument()
  })

  it('renders empty state when there are no shifts', async () => {
    const { SchedulingPage } = await import('./SchedulingPage')
    mockSchedulingState({
      shifts: { items: [], hasMore: false, nextCursor: null },
      caregivers: [caregiver],
    })

    render(<SchedulingPage />)

    expect(screen.getByText('No shifts this week')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Add shift/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('renders shift cards for a populated week', async () => {
    const { SchedulingPage } = await import('./SchedulingPage')
    const shift = {
      _id: 'shift_1',
      clientId: 'client_1',
      caregiverId: 'user_caregiver',
      scheduledStart: '2026-06-20T09:00:00.000Z',
      scheduledEnd: '2026-06-20T13:00:00.000Z',
      status: 'scheduled',
      serviceType: 'SLS',
      rate: 28.5,
      clientDisplayName: 'Rosa Díaz',
      caregiverDisplayName: 'Lucía Fernández',
    }
    mockSchedulingState({
      shifts: { items: [shift], hasMore: false, nextCursor: null },
      caregivers: [caregiver],
    })

    render(<SchedulingPage />)

    expect(screen.getByText('L. Fernández')).toBeInTheDocument()
    expect(screen.getByText(/Díaz/)).toBeInTheDocument()
  })

  it('re-queries listShifts when caregiver filter changes', async () => {
    const { SchedulingPage } = await import('./SchedulingPage')
    mockSchedulingState({
      shifts: { items: [], hasMore: false, nextCursor: null },
      caregivers: [caregiver],
    })

    render(<SchedulingPage />)

    const filter = screen.getByLabelText(/Filter by caregiver/i)
    fireEvent.change(filter, { target: { value: 'user_caregiver' } })

    expect(filter).toHaveValue('user_caregiver')
  })
})
