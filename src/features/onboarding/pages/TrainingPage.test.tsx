import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TrainingPage } from './TrainingPage'
import { getFunctionName } from 'convex/server'

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
  useClerk: () => ({ signOut: vi.fn() }),
}))

let mockTenant: { clerkOrgId: string | undefined, tenantName: string, isLoading: boolean }

vi.mock('@/app/useTenant', () => ({
  useTenant: () => mockTenant,
  getStoredClerkOrgId: () => null,
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

const customTrainingConfig = {
  steps: [
    {
      id: 'agency_custom_step',
      title: 'Agency Custom Step',
      type: 'text',
      content: 'FIRST SECTION: Alpha details here\n\nSECOND SECTION: Beta details here',
      minDurationSec: 0,
      required: true,
    },
  ],
  passingScore: 80,
}

let mockCompletionsResult: unknown
let mockHasFullPlatformResult: unknown
let mockTrainingConfigResult: unknown

const mutationCalls: { name: string; args: unknown }[] = []

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: vi.fn((query: unknown, args: unknown) => {
    if (args === 'skip') return undefined
    const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
    if (name.includes('listMyCompletions')) return mockCompletionsResult
    if (name.includes('hasProduct')) return mockHasFullPlatformResult
    if (name.includes('getTrainingConfig')) return mockTrainingConfigResult
    return undefined
  }),
  useMutation: vi.fn((mutation: unknown) => {
    const name = getFunctionName(mutation as Parameters<typeof getFunctionName>[0])
    return vi.fn((args: unknown) => {
      mutationCalls.push({ name, args })
      return Promise.resolve()
    })
  }),
}))

function resetMocks() {
  mockTenant = { clerkOrgId: 'org_123', tenantName: 'Test Agency', isLoading: false }
  mockCompletionsResult = completions
  mockHasFullPlatformResult = true
  mockTrainingConfigResult = undefined
}

function blipAllQueries() {
  mockCompletionsResult = undefined
  mockHasFullPlatformResult = undefined
  mockTrainingConfigResult = undefined
}

describe('TrainingPage when complete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
    mutationCalls.length = 0
    resetMocks()
  })

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
    expect(navigateMock).toHaveBeenCalledWith('/caregiver/today', { replace: true })
  })

  it('navigates to /onboarding/success when the candidate has no full platform access', async () => {
    mockHasFullPlatformResult = false
    render(
      <MemoryRouter>
        <TrainingPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/Training complete/i)).toBeInTheDocument()
    })

    const finishButton = screen.getByRole('button', { name: /Finish/i })
    finishButton.click()
    expect(navigateMock).toHaveBeenCalledWith('/onboarding/success', { replace: true })
  })

  it('records the aggregate platform_training completion once all steps are done', async () => {
    mutationCalls.length = 0
    render(
      <MemoryRouter>
        <TrainingPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/Training complete/i)).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(
        mutationCalls.some((call) => call.name.includes('completePlatformTraining')),
      ).toBe(true)
    })

    const platformTrainingCalls = mutationCalls.filter((call) =>
      call.name.includes('completePlatformTraining'),
    )
    expect(platformTrainingCalls).toHaveLength(1)
    expect(platformTrainingCalls[0].args).toMatchObject({ clerkOrgId: 'org_123' })
  })
})

describe('TrainingPage query blips mid-training', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
    mutationCalls.length = 0
    resetMocks()
    mockCompletionsResult = []
    mockTrainingConfigResult = customTrainingConfig
  })

  function renderTraining() {
    return render(
      <MemoryRouter>
        <TrainingPage />
      </MemoryRouter>,
    )
  }

  it('keeps rendering the current step when all queries blip to undefined', () => {
    const { rerender } = renderTraining()
    expect(screen.getByText('Agency Custom Step')).toBeInTheDocument()

    blipAllQueries()
    rerender(
      <MemoryRouter>
        <TrainingPage />
      </MemoryRouter>,
    )

    // Step content persists — no blank screen, no "Loading training..."
    expect(screen.getByText('Agency Custom Step')).toBeInTheDocument()
    expect(screen.queryByText('Loading training...')).not.toBeInTheDocument()
    // Custom steps must not revert to the defaults mid-training
    expect(screen.queryByText('Welcome to Individuals Choice')).not.toBeInTheDocument()
  })

  it('keeps rendering through a transient isLoading/org-id blip once started', () => {
    const { rerender } = renderTraining()
    expect(screen.getByText('Agency Custom Step')).toBeInTheDocument()

    mockTenant = { clerkOrgId: undefined, tenantName: 'Test Agency', isLoading: true }
    blipAllQueries()
    rerender(
      <MemoryRouter>
        <TrainingPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Agency Custom Step')).toBeInTheDocument()
  })

  it('does not remount StepView (expanded cards stay expanded) across a blip', () => {
    const { rerender } = renderTraining()

    // Expand both cards — expanding all of them surfaces the confirmation
    fireEvent.click(screen.getByText('FIRST SECTION:'))
    fireEvent.click(screen.getByText('SECOND SECTION:'))
    expect(screen.getByText(/All sections reviewed!/i)).toBeInTheDocument()

    blipAllQueries()
    rerender(
      <MemoryRouter>
        <TrainingPage />
      </MemoryRouter>,
    )

    // InteractiveContent state survives => StepView was not remounted
    expect(screen.getByText(/All sections reviewed!/i)).toBeInTheDocument()
  })
})
