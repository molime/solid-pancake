import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = {
  createClient: vi.fn(),
  createShift: vi.fn(),
  createManyShifts: vi.fn(),
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

describe('ClientsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    let queryCall = 0
    const clients = [
        {
          _id: 'client_1',
          displayName: 'Alex Rivera',
          serviceType: 'SLS',
          authorizationHours: 40,
          riskFlags: [],
        },
      ]
    const caregivers = [
        {
          _id: 'member_1',
          clerkUserId: 'user_caregiver',
          displayName: 'User',
          email: 'caregiver1@agency.com',
          role: 'org:caregiver',
        },
      ]

    vi.mocked(useQuery).mockImplementation(() => {
      const result = queryCall % 2 === 0 ? clients : caregivers
      queryCall += 1
      return result
    })

    vi.mocked(useMutation)
      .mockReturnValueOnce(
        mocks.createClient as unknown as ReturnType<typeof useMutation>,
      )
      .mockReturnValueOnce(
        mocks.createShift as unknown as ReturnType<typeof useMutation>,
      )
      .mockReturnValueOnce(
        mocks.createManyShifts as unknown as ReturnType<typeof useMutation>,
      )
  })

  it('uses caregiver email as the scheduling dropdown label', async () => {
    const { ClientsPage } = await import('./ClientsPage')

    render(<ClientsPage />)

    await userEvent.click(screen.getByRole('button', { name: /^schedule$/i }))

    expect(screen.getByText('caregiver1@agency.com')).toBeInTheDocument()
    expect(screen.queryByText('User')).not.toBeInTheDocument()
  })
})
