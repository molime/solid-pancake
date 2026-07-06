import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'

const mocks = {
  resolveCoverage: vi.fn(),
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
  role: 'org:caregiver',
}

const replacement = {
  _id: 'member_2',
  clerkUserId: 'user_replacement',
  displayName: 'Pedro Ramírez',
  email: 'pedro@agency.com',
  role: 'org:caregiver',
}

const request = {
  _id: 'coverage_1',
  shiftId: 'shift_1',
  requesterId: 'user_caregiver',
  reason: 'Family emergency',
  status: 'open',
  shift: {
    scheduledStart: '2026-06-20T09:00:00.000Z',
    scheduledEnd: '2026-06-20T13:00:00.000Z',
  },
  clientName: 'Rosa Díaz',
}

function mockCoverageState() {
  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(
        queryRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'scheduling:listCoverageRequests') return [request]
      if (name === 'members:listCaregivers') return [caregiver, replacement]
      return undefined
    }) as unknown as typeof useQuery,
  )

  vi.mocked(useMutation).mockImplementation(
    ((mutationRef: unknown) => {
      const name = getFunctionName(
        mutationRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'scheduling:resolveCoverage') return mocks.resolveCoverage
      return vi.fn()
    }) as unknown as typeof useMutation,
  )
}

describe('CoverageRequestsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders open coverage requests', async () => {
    const { CoverageRequestsPanel } = await import('./CoverageRequestsPanel')
    mockCoverageState()

    render(<CoverageRequestsPanel clerkOrgId="org_123" />)

    expect(screen.getByText('Coverage requests')).toBeInTheDocument()
    expect(screen.getByText(/Family emergency/)).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
  })

  it('resolves a coverage request with the selected caregiver', async () => {
    const user = userEvent.setup()
    const { CoverageRequestsPanel } = await import('./CoverageRequestsPanel')
    mocks.resolveCoverage.mockResolvedValueOnce({
      shiftId: 'shift_1',
      coverageRequestId: 'coverage_1',
    })
    mockCoverageState()

    render(<CoverageRequestsPanel clerkOrgId="org_123" />)

    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'user_replacement' } })

    await user.click(screen.getByRole('button', { name: /Assign/i }))

    await waitFor(() => {
      expect(mocks.resolveCoverage).toHaveBeenCalledTimes(1)
    })

    expect(mocks.resolveCoverage).toHaveBeenCalledWith({
      clerkOrgId: 'org_123',
      coverageRequestId: 'coverage_1',
      reassignedTo: 'user_replacement',
    })
  })
})
