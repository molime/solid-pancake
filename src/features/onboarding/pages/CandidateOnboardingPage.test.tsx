import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CandidateOnboardingPage } from './CandidateOnboardingPage'

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

const tasks = [
  { _id: 'task_form', type: 'form_submission', status: 'complete' },
  { _id: 'task_photo', type: 'photo_id', status: 'pending' },
  { _id: 'task_cpr', type: 'cpr_certificate', status: 'pending' },
  { _id: 'task_bg', type: 'background_check', status: 'pending' },
  { _id: 'task_agreement', type: 'employment_agreement', status: 'pending' },
  { _id: 'task_training', type: 'platform_training', status: 'pending' },
]

vi.mock('convex/react', () => ({
  useQuery: () => tasks,
}))

describe('CandidateOnboardingPage', () => {
  it('renders six tasks and routes the next upload step by task id', () => {
    render(
      <MemoryRouter>
        <CandidateOnboardingPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('1 of 6 complete')).toBeInTheDocument()
    expect(screen.getByText('Upload photo ID')).toBeInTheDocument()
    expect(screen.getByText('Upload CPR certificate')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Next: Photo ID/i }))

    expect(navigateMock).toHaveBeenCalledWith('/onboarding/upload/task_photo')
  })
})
