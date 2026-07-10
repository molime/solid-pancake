import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'
import type { Id } from '../../../../convex/_generated/dataModel'

const mocks = {
  deleteShift: vi.fn(),
  requestCoverage: vi.fn(),
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

const caregiver = {
  _id: 'member_1',
  clerkUserId: 'user_caregiver',
  displayName: 'Lucía Fernández',
  email: 'lucia@agency.com',
  phone: '+52 55 1234 5678',
  rating: 4.9,
  visits: 214,
  role: 'org:caregiver',
}

const client = {
  _id: 'client_1',
  displayName: 'Rosa Díaz',
  serviceAddress: {
    line1: 'Av. Reforma 1234',
    line2: 'Apt 4B',
    city: 'Mexico City',
    state: 'CDMX',
    postalCode: '06600',
    country: 'Mexico',
  },
  phone: '+52 55 9876 5432',
}

const shift = {
  _id: 'shift_1' as Id<'shifts'>,
  _creationTime: Date.now(),
  tenantId: 'tenant_1' as Id<'tenants'>,
  clientId: 'client_1' as Id<'clients'>,
  caregiverId: 'user_caregiver',
  scheduledStart: '2026-06-20T09:00:00.000Z',
  scheduledEnd: '2026-06-20T13:00:00.000Z',
  status: 'scheduled',
  serviceType: 'SLS' as const,
  rate: 28.5,
  clientDisplayName: 'Rosa Díaz',
  caregiverDisplayName: 'Lucía Fernández',
}

const tasks = [
  { _id: 'task_1', title: 'Help with morning bath', status: 'pending' },
  { _id: 'task_2', title: 'Prepare breakfast', status: 'pending' },
]

function mockPacketState(role: 'org:admin' | 'org:coordinator' | 'org:caregiver') {
  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(
        queryRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'members:me') return { role }
      if (name === 'shiftQueries:getWithDetails')
        return { shift, client, note: null, tasks, reviews: [], verification: { locationMatched: true, submittedOnSite: true } }
      if (name === 'audit:list')
        return role === 'org:caregiver'
          ? undefined
          : [
              {
                _id: 'audit_1',
                actorId: 'user_coordinator',
                actorRole: 'org:coordinator',
                action: 'created shift',
                kind: 'shift.created',
                shiftId: shift._id,
                createdAt: '2026-06-15T10:00:00.000Z',
              },
            ]
      if (name === 'members:listCaregivers') return [caregiver]
      return undefined
    }) as unknown as typeof useQuery,
  )

  vi.mocked(useMutation).mockImplementation(
    ((mutationRef: unknown) => {
      const name = getFunctionName(
        mutationRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'scheduling:deleteShift') return mocks.deleteShift
      if (name === 'scheduling:requestCoverage') return mocks.requestCoverage
      return vi.fn()
    }) as unknown as typeof useMutation,
  )
}

describe('ShiftPacketPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.confirm = vi.fn(() => true)
  })

  it('renders shift details and audit history for staff', async () => {
    const { ShiftPacketPanel } = await import('./ShiftPacketPanel')
    mockPacketState('org:admin')

    render(
      <ShiftPacketPanel
        shift={shift}
        clerkOrgId="org_123"
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    expect(screen.getByText(/Saturday.*visit/)).toBeInTheDocument()
    expect(screen.getByText('Rosa Díaz')).toBeInTheDocument()
    expect(screen.getByText('Edit shift')).toBeInTheDocument()
    expect(screen.getByText('Cancel shift')).toBeInTheDocument()
    expect(screen.getByText('Audit history')).toBeInTheDocument()
    expect(screen.getByText(/created shift/)).toBeInTheDocument()
  })

  it('calls onEdit when Edit shift is clicked', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const { ShiftPacketPanel } = await import('./ShiftPacketPanel')
    mockPacketState('org:coordinator')

    render(
      <ShiftPacketPanel
        shift={shift}
        clerkOrgId="org_123"
        onClose={vi.fn()}
        onEdit={onEdit}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Edit shift/i }))
    expect(onEdit).toHaveBeenCalledWith(shift)
  })

  it('calls deleteShift when Cancel shift is confirmed', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    mocks.deleteShift.mockResolvedValueOnce({ shiftId: shift._id })
    const { ShiftPacketPanel } = await import('./ShiftPacketPanel')
    mockPacketState('org:admin')

    render(
      <ShiftPacketPanel
        shift={shift}
        clerkOrgId="org_123"
        onClose={onClose}
        onEdit={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Cancel shift/i }))

    await waitFor(() => {
      expect(mocks.deleteShift).toHaveBeenCalledTimes(1)
    })

    expect(mocks.deleteShift).toHaveBeenCalledWith({
      clerkOrgId: 'org_123',
      shiftId: shift._id,
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('hides edit/cancel actions and audit history for caregivers', async () => {
    const { ShiftPacketPanel } = await import('./ShiftPacketPanel')
    mockPacketState('org:caregiver')

    render(
      <ShiftPacketPanel
        shift={shift}
        clerkOrgId="org_123"
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    expect(screen.queryByText('Edit shift')).not.toBeInTheDocument()
    expect(screen.queryByText('Cancel shift')).not.toBeInTheDocument()
    expect(screen.queryByText('Audit history')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Request Coverage/i })).toBeInTheDocument()
  })

  it('sends a coverage request from caregiver view', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    mocks.requestCoverage.mockResolvedValueOnce({ coverageRequestId: 'cov_1' })
    const { ShiftPacketPanel } = await import('./ShiftPacketPanel')
    mockPacketState('org:caregiver')

    render(
      <ShiftPacketPanel
        shift={shift}
        clerkOrgId="org_123"
        onClose={onClose}
        onEdit={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Request Coverage/i }))
    const reason = screen.getByPlaceholderText(/Why do you need coverage/i)
    await user.type(reason, 'Family emergency')

    await user.click(screen.getByRole('button', { name: /Send request/i }))

    await waitFor(() => {
      expect(mocks.requestCoverage).toHaveBeenCalledTimes(1)
    })

    expect(mocks.requestCoverage).toHaveBeenCalledWith({
      clerkOrgId: 'org_123',
      shiftId: shift._id,
      reason: 'Family emergency',
    })
    expect(onClose).toHaveBeenCalled()
  })
})
