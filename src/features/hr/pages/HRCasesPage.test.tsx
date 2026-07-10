import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'

const mocks = {
  createHrCase: vi.fn(),
  updateHrCase: vi.fn(),
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

import { useQuery, useMutation } from 'convex/react'

const cases = [
  {
    _id: 'case_1',
    subjectName: 'Sofia Herrera',
    category: 'discrepancy',
    status: 'open',
    ownerName: 'HR Person',
    createdAt: '2024-06-01T00:00:00.000Z',
  },
]

const employees = [
  {
    _id: 'profile_1',
    displayName: 'Sofia Herrera',
    clerkUserId: 'user_1',
  },
]

function mockCasesState() {
  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(queryRef as Parameters<typeof getFunctionName>[0])
      if (name === 'hrCases:listHrCases') return cases
      if (name === 'employeeProfiles:listEmployeeProfiles') return employees
      if (name === 'candidates:listCandidates') return []
      return undefined
    }) as unknown as typeof useQuery,
  )

  vi.mocked(useMutation).mockImplementation(
    ((mutationRef: unknown) => {
      const name = getFunctionName(mutationRef as Parameters<typeof getFunctionName>[0])
      if (name === 'hrCases:createHrCase') return mocks.createHrCase
      if (name === 'hrCases:updateHrCase') return mocks.updateHrCase
      return vi.fn()
    }) as unknown as typeof useMutation,
  )
}

describe('HRCasesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders cases table', async () => {
    const { HRCasesPage } = await import('./HRCasesPage')
    mockCasesState()

    render(<HRCasesPage />)

    expect(screen.getByText('HR Cases')).toBeInTheDocument()
    expect(screen.getByText('Sofia Herrera')).toBeInTheDocument()
  })

  it('opens new case modal', async () => {
    const user = userEvent.setup()
    const { HRCasesPage } = await import('./HRCasesPage')
    mockCasesState()

    render(<HRCasesPage />)

    await user.click(screen.getByRole('button', { name: /new case/i }))
    expect(screen.getByText('New HR case')).toBeInTheDocument()
  })
})
