import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { getFunctionName } from 'convex/server'

const mocks = {
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

function mockAvailabilityState(options: { windows?: unknown[] }) {
  const windows = options.windows ?? []

  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(
        queryRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'scheduling:listMyAvailability') return windows
      return undefined
    }) as unknown as typeof useQuery,
  )

  vi.mocked(useMutation).mockImplementation(
    ((mutationRef: unknown) => {
      const name = getFunctionName(
        mutationRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'scheduling:addAvailabilityWindow')
        return mocks.addAvailabilityWindow
      if (name === 'scheduling:deleteAvailabilityWindow')
        return mocks.deleteAvailabilityWindow
      return vi.fn()
    }) as unknown as typeof useMutation,
  )
}

describe('AvailabilityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the weekly availability list', async () => {
    const { AvailabilityPage } = await import('./AvailabilityPage')
    mockAvailabilityState({
      windows: [
        {
          _id: 'window_1',
          kind: 'recurring',
          dayOfWeek: 1,
          startTime: '08:00',
          endTime: '16:00',
          available: true,
        },
      ],
    })

    render(
      <MemoryRouter>
        <AvailabilityPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('My Availability')).toBeInTheDocument()
    expect(screen.getByText('Monday')).toBeInTheDocument()
    expect(screen.getByText(/8:00 AM – 4:00 PM/)).toBeInTheDocument()
  })

  it('calls addAvailabilityWindow when a new window is saved', async () => {
    const user = userEvent.setup()
    const { AvailabilityPage } = await import('./AvailabilityPage')
    mocks.addAvailabilityWindow.mockResolvedValueOnce({ windowId: 'window_2' })
    mockAvailabilityState({ windows: [] })

    render(
      <MemoryRouter>
        <AvailabilityPage />
      </MemoryRouter>,
    )

    await user.click(screen.getAllByRole('button', { name: /Add window/i })[0])

    fireEvent.change(screen.getByLabelText(/Start/i), {
      target: { value: '09:00' },
    })
    fireEvent.change(screen.getByLabelText(/End/i), {
      target: { value: '17:00' },
    })

    await user.click(screen.getByRole('button', { name: /^Save$/i }))

    await waitFor(() => {
      expect(mocks.addAvailabilityWindow).toHaveBeenCalledTimes(1)
    })

    const call = mocks.addAvailabilityWindow.mock.calls[0][0]
    expect(call.clerkOrgId).toBe('org_123')
    expect(call.kind).toBe('recurring')
    expect(call.dayOfWeek).toBe(1)
    expect(call.startTime).toBe('09:00')
    expect(call.endTime).toBe('17:00')
    expect(call.available).toBe(true)
  })
})
