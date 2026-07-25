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
    useUser: vi.fn(() => ({ user: { firstName: 'Carla' } })),
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
import { ReviewDetail } from './ReviewDetail'

const shiftId = 'shift_1' as import('../../../../convex/_generated/dataModel').Id<'shifts'>
const tenantId = 'tenant_1' as import('../../../../convex/_generated/dataModel').Id<'tenants'>
const clientId = 'client_1' as import('../../../../convex/_generated/dataModel').Id<'clients'>
const noteId = 'note_1' as import('../../../../convex/_generated/dataModel').Id<'progressNotes'>
const taskId = 'task_1' as import('../../../../convex/_generated/dataModel').Id<'shiftTasks'>

function makeDetails(overrides?: {
  status?: 'submitted' | 'needs_correction' | 'billing_ready'
  note?: Partial<{
    startTime: string
    endTime: string
    servicesProvided: string
    clientResponse: string
    narrative: string
    submittedAt: string
  }>
  tasks?: Array<{
    _id: import('../../../../convex/_generated/dataModel').Id<'shiftTasks'>
    title: string
    requiredProof: boolean
    status: 'pending' | 'complete'
    proofName?: string
  }>
  reviews?: Array<{
    _id: string
    createdAt: string
    decision: 'approved' | 'correction_requested'
    comment: string
  }>
}) {
  return {
    shift: {
      _id: shiftId,
      _creationTime: Date.now(),
      tenantId,
      clientId,
      caregiverId: 'user_cg_1',
      scheduledStart: '2026-06-25T09:00:00Z',
      scheduledEnd: '2026-06-25T13:00:00Z',
      status: overrides?.status ?? 'submitted',
      serviceType: 'SLS',
      rate: 28.5,
    },
    client: {
      _id: clientId,
      _creationTime: Date.now(),
      tenantId,
      displayName: 'Maria Lopez',
      serviceType: 'SLS',
      authorizationHours: 40,
      riskFlags: [],
    },
    note: {
      _id: noteId,
      _creationTime: Date.now(),
      tenantId,
      shiftId,
      startTime: '09:00',
      endTime: '13:00',
      servicesProvided: 'Bathing, Meals, Walking',
      clientResponse: 'No problems — all good today',
      narrative: 'I helped Maria with her morning bath and got her dressed.',
      submittedAt: '2026-06-25T13:04:00Z',
      ...overrides?.note,
    },
    tasks:
      overrides?.tasks ?? [
        {
          _id: taskId,
          tenantId,
          shiftId,
          title: 'Observation note',
          requiredProof: false,
          status: 'complete' as const,
        },
      ],
    reviews: overrides?.reviews ?? [],
    verification: {
      locationMatched: true,
      submittedOnSite: true,
    },
  }
}

function mockDetailState(options?: { details?: ReturnType<typeof makeDetails> }) {
  const details = options?.details ?? makeDetails()

  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(
        queryRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'shiftQueries:getWithDetails') return details
      if (name === 'files:getDownloadUrl') return null
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

describe('ReviewDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders note sections from getWithDetails', () => {
    mockDetailState()

    render(
      <ReviewDetail
        clerkOrgId="org_123"
        caregiverName="Ana Silva"
        clientName="Maria Lopez"
        shiftId={shiftId}
      />,
    )

    expect(screen.getByText(/Ana Silva's shift notes/i)).toBeInTheDocument()
    expect(screen.getByText(/Maria Lopez/i)).toBeInTheDocument()
    expect(screen.getByText(/Bathing · Meals · Walking/i)).toBeInTheDocument()
    expect(
      screen.getByText(/I helped Maria with her morning bath/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/No problems — all good today/i)).toBeInTheDocument()
  })

  it('calls approve mutation when Approve is clicked', async () => {
    const user = userEvent.setup()
    mocks.approve.mockResolvedValueOnce(shiftId)
    mockDetailState()

    render(
      <ReviewDetail
        clerkOrgId="org_123"
        caregiverName="Ana Silva"
        clientName="Maria Lopez"
        shiftId={shiftId}
      />,
    )

    await user.click(screen.getByRole('button', { name: /^Approve$/i }))

    await waitFor(() => {
      expect(mocks.approve).toHaveBeenCalledTimes(1)
    })
    expect(mocks.approve).toHaveBeenCalledWith({
      clerkOrgId: 'org_123',
      shiftId,
      comment: '',
    })
  })

  it('shows validation and does not call requestCorrection with a blank comment', async () => {
    const user = userEvent.setup()
    mockDetailState()

    render(
      <ReviewDetail
        clerkOrgId="org_123"
        caregiverName="Ana Silva"
        clientName="Maria Lopez"
        shiftId={shiftId}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: /^Request Correction$/i }),
    )

    expect(mocks.requestCorrection).not.toHaveBeenCalled()
    expect(
      screen.getByText(/Add a comment before requesting a correction/i),
    ).toBeInTheDocument()
  })

  it('calls requestCorrection mutation after typing a comment', async () => {
    const user = userEvent.setup()
    mocks.requestCorrection.mockResolvedValueOnce(shiftId)
    mockDetailState()

    render(
      <ReviewDetail
        clerkOrgId="org_123"
        caregiverName="Ana Silva"
        clientName="Maria Lopez"
        shiftId={shiftId}
      />,
    )

    await user.type(
      screen.getByPlaceholderText(/Add a review comment/i),
      'Please add the missing proof.',
    )
    await user.click(
      screen.getByRole('button', { name: /^Request Correction$/i }),
    )

    await waitFor(() => {
      expect(mocks.requestCorrection).toHaveBeenCalledTimes(1)
    })
    expect(mocks.requestCorrection).toHaveBeenCalledWith({
      clerkOrgId: 'org_123',
      shiftId,
      comment: 'Please add the missing proof.',
    })
  })
})
