import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { getFunctionName } from 'convex/server'

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
    useConvex: () => ({ query: vi.fn() }),
    useQuery: vi.fn(),
    useMutation: vi.fn(() => vi.fn()),
  }
})

import { useQuery } from 'convex/react'

function mockNotifications(notifications: unknown[]) {
  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(
        queryRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'notifications:list') return notifications
      if (name === 'notifications:unreadCount') return 0
      return undefined
    }) as unknown as typeof useQuery,
  )
}

// Imported lazily inside the tests so the convex/react mock is in place.
let NotificationsPageUnderTest: (typeof import('./NotificationsPage'))['NotificationsPage']

function renderPage() {
  return render(
    <MemoryRouter>
      <NotificationsPageUnderTest />
    </MemoryRouter>,
  )
}

describe('NotificationsPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('./NotificationsPage')
    NotificationsPageUnderTest = module.NotificationsPage
  })

  it('deep-links SIR notifications to the incident detail page', () => {
    mockNotifications([
      {
        _id: 'notif_1',
        type: 'sir_overdue',
        message: 'SIR overdue for Alex Rivera: missing 48h written report.',
        metadata: { incidentId: 'incident_9' },
        read: true,
        createdAt: '2026-08-19T10:00:00.000Z',
      },
      {
        _id: 'notif_2',
        type: 'audit',
        message: 'A shift was approved.',
        read: true,
        createdAt: '2026-08-19T09:00:00.000Z',
      },
    ])

    renderPage()

    const link = screen.getByRole('link', { name: /view incident/i })
    expect(link).toHaveAttribute('href', '/incidents/incident_9')
    // Notifications without an incidentId render no deep link.
    expect(screen.getAllByRole('link', { name: /view incident/i })).toHaveLength(1)
  })

  it('renders no deep link when metadata has no incidentId', () => {
    mockNotifications([
      {
        _id: 'notif_1',
        type: 'audit',
        message: 'A shift was approved.',
        metadata: { shiftId: 'shift_1' },
        read: true,
        createdAt: '2026-08-19T09:00:00.000Z',
      },
    ])

    renderPage()

    expect(
      screen.queryByRole('link', { name: /view incident/i }),
    ).not.toBeInTheDocument()
  })
})
