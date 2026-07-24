import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

// Match the new default training step IDs (8 steps from handbook)
const completions = [
  { trainingId: 'welcome', status: 'complete' },
  { trainingId: 'org_structure', status: 'complete' },
  { trainingId: 'role_of_staff', status: 'complete' },
  { trainingId: 'consumer_rights', status: 'complete' },
  { trainingId: 'policies_conduct', status: 'complete' },
  { trainingId: 'medication_procedures', status: 'complete' },
  { trainingId: 'emergency_procedures', status: 'complete' },
  { trainingId: 'clockin_flow', status: 'complete' },
  { trainingId: 'quiz', status: 'complete' },
]

// Track which query was called by reference identity
let callCount = 0
vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => {
    callCount++
    // 1st call = listMyCompletions, 2nd = hasProduct, 3rd = getTrainingConfig
    if (callCount === 1) return completions
    if (callCount === 2) return true  // hasFullPlatform = true
    return undefined  // getTrainingConfig = undefined (use defaults)
  }),
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
      expect(screen.getByText(/Training complete/i)).toBeInTheDocument()
    })

    expect(
      screen.getByText(/You have finished all required training modules/i),
    ).toBeInTheDocument()

    const goButton = screen.getByRole('button', { name: /Go to dashboard/i })
    expect(goButton).toBeInTheDocument()

    goButton.click()
    expect(navigateMock).toHaveBeenCalledWith('/onboarding', { replace: true })
  })
})
