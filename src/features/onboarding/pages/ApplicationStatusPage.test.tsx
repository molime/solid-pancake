import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ApplicationStatusPage } from './ApplicationStatusPage'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('@clerk/react', () => ({
  useOrganization: () => ({ organization: { id: 'org_123' }, isLoaded: true }),
}))

vi.mock('convex/react', () => ({
  useQuery: () => ({
    candidate: { status: 'applied', displayName: 'Jane Doe' },
    application: { submittedAt: '2026-07-09T10:00:00.000Z' },
    tasks: [
      { _id: 'task_photo', type: 'photo_id', status: 'pending' },
      { _id: 'task_cpr', type: 'cpr_certificate', status: 'pending' },
    ],
  }),
}))

describe('ApplicationStatusPage', () => {
  it('shows a warning when documents are pending and links to upload', () => {
    render(
      <MemoryRouter>
        <ApplicationStatusPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Your application is waiting on documents')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Upload required document/i }))
    expect(navigateMock).toHaveBeenCalledWith('/onboarding/upload/task_photo')
  })
})
