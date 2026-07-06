import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { getFunctionName } from 'convex/server'

const mocks = {
  createShift: vi.fn(),
  updateShift: vi.fn(),
}

vi.mock('@clerk/react', () => ({
  useOrganization: () => ({ organization: { id: 'org_123', name: 'Agency' } }),
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

import { useMutation, useQuery } from 'convex/react'

const client = {
  _id: 'client_1',
  displayName: 'Rosa Díaz',
  serviceType: 'SLS',
  authorizationHours: 40,
  riskFlags: [],
}

const caregiver = {
  _id: 'member_1',
  clerkUserId: 'user_caregiver',
  displayName: 'Lucía Fernández',
  email: 'lucia@agency.com',
  role: 'org:caregiver',
}

function mockEditorState(options: { availability?: unknown[] }) {
  const clientsList = [client]
  const caregiversList = [caregiver]
  const availability = options.availability ?? []

  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(
        queryRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'clients:list') return clientsList
      if (name === 'members:listCaregivers') return caregiversList
      if (name === 'scheduling:listAvailabilityForScheduling')
        return availability
      return undefined
    }) as unknown as typeof useQuery,
  )

  vi.mocked(useMutation).mockImplementation(
    ((mutationRef: unknown) => {
      const name = getFunctionName(
        mutationRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'scheduling:createShift') return mocks.createShift
      if (name === 'scheduling:updateShift') return mocks.updateShift
      return vi.fn()
    }) as unknown as typeof useMutation,
  )
}

describe('ShiftEditorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls createShift with correct args', async () => {
    const { ShiftEditorModal } = await import('./ShiftEditorModal')
    mocks.createShift.mockResolvedValueOnce({ shiftId: 'shift_1' })
    mockEditorState({})

    const onSuccess = vi.fn()
    render(
      <ShiftEditorModal
        open
        onClose={vi.fn()}
        clerkOrgId="org_123"
        onSuccess={onSuccess}
      />,
    )

    fireEvent.change(screen.getByRole('combobox', { name: /CLIENT/i }), {
      target: { value: 'client_1' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: /CAREGIVER/i }), {
      target: { value: 'user_caregiver' },
    })
    fireEvent.change(screen.getByLabelText(/DATE/i), {
      target: { value: '2026-06-20' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: /SERVICE TYPE/i }), {
      target: { value: 'SLS' },
    })
    fireEvent.change(screen.getByLabelText(/RATE/i), {
      target: { value: '30.00' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Save shift/i }))

    await waitFor(() => {
      expect(mocks.createShift).toHaveBeenCalledTimes(1)
    })

    const call = mocks.createShift.mock.calls[0][0]
    expect(call.clerkOrgId).toBe('org_123')
    expect(call.clientId).toBe('client_1')
    expect(call.caregiverId).toBe('user_caregiver')
    expect(call.serviceType).toBe('SLS')
    expect(call.rate).toBe(30)
    expect(call.scheduledStart).toMatch(/^2026-06-20T/)
    expect(call.scheduledEnd).toMatch(/^2026-06-20T/)
  })

  it('displays the conflict error with formatted times', async () => {
    const { ShiftEditorModal } = await import('./ShiftEditorModal')
    mocks.createShift.mockRejectedValueOnce(
      new Error(
        'Shift conflicts with shift_existing (2026-06-20T08:00:00.000Z - 2026-06-20T12:00:00.000Z)',
      ),
    )
    mockEditorState({})

    render(
      <ShiftEditorModal open onClose={vi.fn()} clerkOrgId="org_123" />,
    )

    fireEvent.change(screen.getByRole('combobox', { name: /CLIENT/i }), {
      target: { value: 'client_1' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: /CAREGIVER/i }), {
      target: { value: 'user_caregiver' },
    })
    fireEvent.change(screen.getByLabelText(/DATE/i), {
      target: { value: '2026-06-20' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: /SERVICE TYPE/i }), {
      target: { value: 'SLS' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Save shift/i }))

    await waitFor(() => {
      expect(
        screen.getByText(
          'Schedule conflict: this caregiver already has a shift from 08:00 to 12:00 on this date.',
        ),
      ).toBeInTheDocument()
    })
  })
})
