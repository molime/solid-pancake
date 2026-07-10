import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TrainingPage } from './TrainingPage'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('@clerk/react', () => ({
  useOrganization: () => ({ organization: { id: 'org_123' }, isLoaded: true }),
}))

const completions = [
  { trainingId: 'welcome', status: 'complete' },
  { trainingId: 'shifts', status: 'complete' },
  { trainingId: 'documentation', status: 'complete' },
  { trainingId: 'compliance', status: 'complete' },
  { trainingId: 'help', status: 'complete' },
]

vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => completions),
  useMutation: () => vi.fn(),
}))

describe('TrainingPage when complete', () => {
  it('shows the completion summary and a Go to dashboard button', async () => {
    render(
      <MemoryRouter>
        <TrainingPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Training complete!')).toBeInTheDocument()
    })

    expect(
      screen.getByText('You have finished all required training modules. You can now access your caregiver dashboard.'),
    ).toBeInTheDocument()

    const goButton = screen.getByRole('button', { name: /Go to dashboard/i })
    expect(goButton).toBeInTheDocument()

    fireEvent.click(goButton)
    expect(navigateMock).toHaveBeenCalledWith('/onboarding', { replace: true })
  })
})
