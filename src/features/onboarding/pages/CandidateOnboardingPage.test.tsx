import { describe, it, expect, vi, beforeEach } from 'vitest'
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

// 8 tasks in the new order
const baseTasks = [
  { _id: 'task_form', type: 'form_submission', status: 'complete' },
  { _id: 'task_photo', type: 'photo_id', status: 'pending' },
  { _id: 'task_tax', type: 'tax_id_ssn', status: 'pending' },
  { _id: 'task_cpr', type: 'cpr_certificate', status: 'pending' },
  { _id: 'task_health', type: 'health_screen', status: 'pending' },
  { _id: 'task_bg', type: 'background_check', status: 'pending' },
  { _id: 'task_agreement', type: 'employment_agreement', status: 'pending' },
  { _id: 'task_certs', type: 'additional_certifications', status: 'pending' },
]

let tasks = [...baseTasks]

vi.mock('convex/react', () => ({
  useQuery: () => tasks,
}))

describe('CandidateOnboardingPage', () => {
  beforeEach(() => {
    tasks = [...baseTasks]
    navigateMock.mockClear()
  })
  it('renders eight tasks and routes the next upload step by task id', () => {
    render(
      <MemoryRouter>
        <CandidateOnboardingPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('1 of 8 complete')).toBeInTheDocument()
    expect(screen.getByText('Photo ID')).toBeInTheDocument()
    expect(screen.getByText('Tax ID or SSN')).toBeInTheDocument()
    expect(screen.getByText('CPR certificate')).toBeInTheDocument()
    expect(screen.getByText('Health screen')).toBeInTheDocument()
    expect(screen.getByText('Background check')).toBeInTheDocument()
    expect(screen.getByText('Employment agreement & privacy policy')).toBeInTheDocument()
    expect(screen.getByText('Additional certifications')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Upload Photo ID \u2192' }))

    expect(navigateMock).toHaveBeenCalledWith('/onboarding/upload/task_photo')
  })

  it('shows a locked badge on pending tasks that are not next', () => {
    render(
      <MemoryRouter>
        <CandidateOnboardingPage />
      </MemoryRouter>,
    )

    expect(screen.getAllByText('Locked').length).toBeGreaterThan(0)
  })

  it('does not navigate when clicking a locked task', () => {
    render(
      <MemoryRouter>
        <CandidateOnboardingPage />
      </MemoryRouter>,
    )

    // CPR certificate is locked (not next, not complete, not optional)
    const cprButton = screen.getByText('CPR certificate').closest('button')
    expect(cprButton).toBeDisabled()
  })

  it('shows Optional badge on additional certifications', () => {
    render(
      <MemoryRouter>
        <CandidateOnboardingPage />
      </MemoryRouter>,
    )

    expect(screen.getAllByText('Optional').length).toBeGreaterThan(0)
  })

  it('hides the car insurance step when its task is skipped', () => {
    tasks = [...baseTasks, { _id: 'task_car', type: 'car_insurance', status: 'skipped' }]
    render(
      <MemoryRouter>
        <CandidateOnboardingPage />
      </MemoryRouter>,
    )

    expect(screen.queryByText('Car insurance policy')).not.toBeInTheDocument()
    // skipped tasks do not count toward progress either
    expect(screen.getByText('1 of 8 complete')).toBeInTheDocument()
  })

  it('shows the car insurance step when its task is pending', () => {
    tasks = [...baseTasks, { _id: 'task_car', type: 'car_insurance', status: 'pending' }]
    render(
      <MemoryRouter>
        <CandidateOnboardingPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Car insurance policy')).toBeInTheDocument()
    expect(screen.getByText('1 of 9 complete')).toBeInTheDocument()
  })
})
