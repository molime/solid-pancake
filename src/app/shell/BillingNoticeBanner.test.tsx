import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))
vi.mock('@/app/useTenant', () => ({
  useTenant: () => ({ clerkOrgId: 'org_test' }),
}))

import { useQuery } from 'convex/react'
import { BillingNoticeBanner } from './BillingNoticeBanner'

const mockedUseQuery = vi.mocked(useQuery)

function mockNotice(notice: unknown) {
  mockedUseQuery.mockReturnValue(notice as never)
}

describe('BillingNoticeBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when there is no billing notice', () => {
    mockNotice(null)
    const { container } = render(<BillingNoticeBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the past-due banner with a pay link for admins', () => {
    mockNotice({
      status: 'past_due',
      graceUntil: new Date('2026-10-06T23:59:59Z').getTime(),
      totalDue: 199,
      hostedInvoiceUrl: 'https://invoice.stripe.com/i/test',
      isAdmin: true,
    })
    render(<BillingNoticeBanner />)
    expect(screen.getByText(/Payment required\./)).toBeInTheDocument()
    expect(
      screen.getByText(/pay by October 6, 2026 to avoid service suspension/i),
    ).toBeInTheDocument()
    const payLink = screen.getByRole('link', { name: /Pay \$199\.00 now/i })
    expect(payLink).toHaveAttribute(
      'href',
      'https://invoice.stripe.com/i/test',
    )
  })

  it('shows no pay link for non-admins', () => {
    mockNotice({
      status: 'past_due',
      graceUntil: null,
      totalDue: null,
      hostedInvoiceUrl: null,
      isAdmin: false,
    })
    render(<BillingNoticeBanner />)
    expect(screen.getByText(/Payment required\./)).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('blocks the app with a full-screen notice when suspended', () => {
    mockNotice({
      status: 'suspended',
      graceUntil: null,
      totalDue: 199,
      hostedInvoiceUrl: 'https://invoice.stripe.com/i/test',
      isAdmin: true,
    })
    render(<BillingNoticeBanner />)
    expect(screen.getByText('Access suspended')).toBeInTheDocument()
    expect(screen.getByText(/5-day grace period/)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Pay \$199\.00/i }),
    ).toHaveAttribute('href', 'https://invoice.stripe.com/i/test')
  })
})
