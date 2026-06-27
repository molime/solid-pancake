import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'

const mocks = {
  approve: vi.fn(),
  requestCorrection: vi.fn(),
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
import { CoordinatorReviewPage } from './CoordinatorReviewPage'

const clientId = 'client_1' as import('../../../../convex/_generated/dataModel').Id<'clients'>
const shiftId = 'shift_1' as import('../../../../convex/_generated/dataModel').Id<'shifts'>
const tenantId = 'tenant_1' as import('../../../../convex/_generated/dataModel').Id<'tenants'>

function makeShift(overrides?: {
  status?: 'submitted' | 'needs_correction' | 'billing_ready'
  caregiverId?: string
  scheduledStart?: string
  scheduledEnd?: string
}): import('../../../../convex/_generated/dataModel').Doc<'shifts'> {
  return {
    _id: shiftId,
    _creationTime: Date.now(),
    tenantId,
    clientId,
    caregiverId: overrides?.caregiverId ?? 'user_cg_1',
    scheduledStart: overrides?.scheduledStart ?? '2026-06-25T09:00:00Z',
    scheduledEnd: overrides?.scheduledEnd ?? '2026-06-25T13:00:00Z',
    status: overrides?.status ?? 'submitted',
    serviceType: 'SLS',
    rate: 28.5,
  }
}

function mockQueueState(options: {
  reviewShifts?: import('../../../../convex/_generated/dataModel').Doc<'shifts'>[]
  approvedShifts?: import('../../../../convex/_generated/dataModel').Doc<'shifts'>[]
  clients?: { _id: import('../../../../convex/_generated/dataModel').Id<'clients'>; displayName: string }[]
  caregivers?: { clerkUserId: string; displayName: string }[]
}) {
  const reviewShifts = options.reviewShifts ?? []
  const approvedShifts = options.approvedShifts ?? []
  const clients = options.clients ?? []
  const caregivers = options.caregivers ?? []

  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(
        queryRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'shiftQueries:listForReview') return reviewShifts
      if (name === 'shiftQueries:listBillingReady') return approvedShifts
      if (name === 'clients:list') return clients
      if (name === 'members:listCaregivers') return caregivers
      return undefined
    }) as unknown as typeof useQuery,
  )

  vi.mocked(useMutation).mockImplementation(
    ((mutationRef: unknown) => {
      const name = getFunctionName(
        mutationRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'reviews:approve') return mocks.approve
      if (name === 'reviews:requestCorrection') return mocks.requestCorrection
      return vi.fn()
    }) as unknown as typeof useMutation,
  )
}

describe('CoordinatorReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state while queries are unresolved', () => {
    vi.mocked(useQuery).mockReturnValue(undefined)

    render(<CoordinatorReviewPage />)

    expect(screen.getByText(/Loading review queue/i)).toBeInTheDocument()
  })

  it('renders empty state for the active filter', () => {
    mockQueueState({})

    render(<CoordinatorReviewPage />)

    expect(screen.getByText(/No pending shifts/i)).toBeInTheDocument()
    expect(screen.getByText(/Documentation to review/i)).toBeInTheDocument()
  })

  it('renders populated queue with status pills', async () => {
    mockQueueState({
      reviewShifts: [
        makeShift({ status: 'submitted' }),
        makeShift({
          status: 'needs_correction',
          caregiverId: 'user_cg_2',
          scheduledStart: '2026-06-25T08:00:00Z',
          scheduledEnd: '2026-06-25T12:30:00Z',
        }),
      ],
      approvedShifts: [
        makeShift({
          status: 'billing_ready',
          caregiverId: 'user_cg_3',
          scheduledStart: '2026-06-25T07:00:00Z',
          scheduledEnd: '2026-06-25T11:00:00Z',
        }),
      ],
      clients: [{ _id: clientId, displayName: 'Maria Lopez' }],
      caregivers: [
        { clerkUserId: 'user_cg_1', displayName: 'Ana Silva' },
        { clerkUserId: 'user_cg_2', displayName: 'Julia Costa' },
        { clerkUserId: 'user_cg_3', displayName: 'Aisha Mohammed' },
      ],
    })

    render(<CoordinatorReviewPage />)

    expect(screen.getByText(/Ana Silva/)).toBeInTheDocument()
    expect(screen.getByText(/Maria Lopez/)).toBeInTheDocument()
    expect(screen.getByText('Submitted')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Returned/i }))
    await waitFor(() => {
      expect(screen.getByText(/Julia Costa/)).toBeInTheDocument()
      expect(screen.getByText('Needs correction')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: /Approved/i }))
    await waitFor(() => {
      expect(screen.getByText(/Aisha Mohammed/)).toBeInTheDocument()
      expect(screen.getByText('Approved')).toBeInTheDocument()
    })
  })

  it('switches to the approved filter and shows approved rows', async () => {
    mockQueueState({
      approvedShifts: [
        makeShift({
          status: 'billing_ready',
          caregiverId: 'user_cg_3',
          scheduledStart: '2026-06-25T07:00:00Z',
          scheduledEnd: '2026-06-25T11:00:00Z',
        }),
      ],
      clients: [{ _id: clientId, displayName: 'Maria Lopez' }],
      caregivers: [{ clerkUserId: 'user_cg_3', displayName: 'Aisha Mohammed' }],
    })

    render(<CoordinatorReviewPage />)

    const approvedTab = screen.getByRole('button', { name: /Approved/i })
    await userEvent.click(approvedTab)

    await waitFor(() => {
      expect(screen.getByText('Approved')).toBeInTheDocument()
      expect(screen.getByText(/Aisha Mohammed/)).toBeInTheDocument()
    })
  })
})
