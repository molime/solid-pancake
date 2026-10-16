import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { getFunctionName } from 'convex/server'
import { PlatformSupportPage } from './PlatformSupportPage'

const setStatusMock = vi.fn(() => Promise.resolve('ticket_1'))
const addNoteMock = vi.fn(() => Promise.resolve('ticket_1'))
const requestAccessMock = vi.fn(() => Promise.resolve(null))

vi.mock('convex/react', async () => {
  const actual =
    await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn((fn: unknown) => {
      const name = getFunctionName(fn as Parameters<typeof getFunctionName>[0])
      if (name === 'supportTickets:setStatus') return setStatusMock
      if (name === 'supportTickets:addNote') return addNoteMock
      return requestAccessMock
    }),
  }
})

import { useQuery } from 'convex/react'

const openTicket = {
  _id: 'ticket_1',
  tenantId: 'tenant_1',
  tenantName: 'Golden Ages Home Care',
  tenantSlug: 'golden-ages-home-care',
  subject: 'Candidate Is Not showing',
  description: 'The candidate disappeared from the pipeline.',
  category: 'technical',
  priority: 'high',
  status: 'open',
  createdAt: '2026-10-14T06:06:16.597Z',
  updatedAt: '2026-10-14T06:06:16.597Z',
  createdByName: 'Samira Manney',
  platformNotes: null,
}

function mockQueries() {
  vi.mocked(useQuery).mockImplementation(((
    query: unknown,
    args: unknown,
  ) => {
    if (args === 'skip') return undefined
    const name = getFunctionName(
      query as Parameters<typeof getFunctionName>[0],
    )
    switch (name) {
      case 'platform:isAdmin':
        return true
      case 'platform:listTenantsWithUsage':
        return []
      case 'platform:listAuditEvents':
        return []
      case 'supportTickets:listAll':
        return [openTicket]
      case 'supportTickets:get':
        return openTicket
      default:
        return undefined
    }
  }) as unknown as typeof useQuery)
}

describe('PlatformSupportPage ticket status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQueries()
  })

  it('closes a ticket from the dialog and confirms the update', async () => {
    render(<PlatformSupportPage />)

    // Open the ticket detail dialog from the table row.
    fireEvent.click(screen.getByText('Candidate Is Not showing'))

    const dialog = await screen.findByRole('dialog')
    const statusSelect = within(dialog).getByRole('combobox')
    expect((statusSelect as HTMLSelectElement).value).toBe('open')

    fireEvent.change(statusSelect, { target: { value: 'closed' } })

    // The mutation fires immediately with the chosen status.
    expect(setStatusMock).toHaveBeenCalledWith({
      ticketId: 'ticket_1',
      status: 'closed',
    })

    // A success confirmation is shown once the mutation resolves — a failed
    // close can never be silent.
    await screen.findByText('Status updated.')
  })

  it('shows the server error when the close fails', async () => {
    setStatusMock.mockRejectedValueOnce(
      new Error('Invalid status transition: closed → open.'),
    )
    render(<PlatformSupportPage />)

    fireEvent.click(screen.getByText('Candidate Is Not showing'))
    const dialog = await screen.findByRole('dialog')
    const statusSelect = within(dialog).getByRole('combobox')
    fireEvent.change(statusSelect, { target: { value: 'closed' } })

    await screen.findByText('Invalid status transition: closed → open.')
    expect(screen.queryByText('Status updated.')).toBeNull()
  })
})
