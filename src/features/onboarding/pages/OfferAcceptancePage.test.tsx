import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OfferAcceptancePage } from './OfferAcceptancePage'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('@/app/useTenant', () => ({
  useTenant: () => ({
    clerkOrgId: 'org_123',
    tenantName: 'Test Agency',
    isLoading: false,
  }),
  getStoredClerkOrgId: () => 'org_123',
}))

vi.mock('@clerk/react', () => ({
  useClerk: () => ({ signOut: vi.fn() }),
}))

let mockQueryResult: unknown

vi.mock('convex/react', () => ({
  useQuery: vi.fn((_query: unknown, args: unknown) =>
    args === 'skip' ? undefined : mockQueryResult,
  ),
  useMutation: () => vi.fn(),
}))

const offerData = {
  candidate: { status: 'offer_sent', displayName: 'Jane Doe' },
  application: {
    fields: {
      position: 'Caregiver',
      payRate: '$22.00 / hr',
      startDate: '2026-08-01',
      schedule: 'Flexible',
      supervisor: 'Coordinator',
    },
  },
}

describe('OfferAcceptancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQueryResult = undefined
  })

  it('shows a loader (not "No pending offer") while the query is undefined', () => {
    render(<OfferAcceptancePage />)

    expect(screen.getByText('Loading your offer')).toBeInTheDocument()
    expect(screen.queryByText('No pending offer')).not.toBeInTheDocument()
  })

  it('shows "No pending offer" only for resolved data without an offer_sent status', () => {
    mockQueryResult = { candidate: { status: 'documents' }, application: null }
    render(<OfferAcceptancePage />)

    expect(screen.getByText('No pending offer')).toBeInTheDocument()
    expect(screen.queryByText('Loading your offer')).not.toBeInTheDocument()
  })

  it('keeps rendering the offer when the query blips to undefined after loading', () => {
    mockQueryResult = offerData
    const { rerender } = render(<OfferAcceptancePage />)
    expect(screen.getByText('You have an offer!')).toBeInTheDocument()

    mockQueryResult = undefined
    rerender(<OfferAcceptancePage />)

    expect(screen.getByText('You have an offer!')).toBeInTheDocument()
    expect(screen.queryByText('Loading your offer')).not.toBeInTheDocument()
    expect(screen.queryByText('No pending offer')).not.toBeInTheDocument()
  })

  it('is not sticky across a real resolution with a different status', () => {
    mockQueryResult = offerData
    const { rerender } = render(<OfferAcceptancePage />)
    expect(screen.getByText('You have an offer!')).toBeInTheDocument()

    mockQueryResult = { candidate: { status: 'offer_accepted' }, application: null }
    rerender(<OfferAcceptancePage />)

    expect(screen.queryByText('You have an offer!')).not.toBeInTheDocument()
    expect(screen.getByText('No pending offer')).toBeInTheDocument()
  })
})
