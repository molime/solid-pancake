import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TrainingHubPage } from './TrainingHubPage'
import { getFunctionName } from 'convex/server'

let mockTenant: {
  clerkOrgId: string | undefined
  tenantName: string
  isLoading: boolean
}

vi.mock('@/app/useTenant', () => ({
  useTenant: () => mockTenant,
  getStoredClerkOrgId: () => null,
}))

const mockCourses = [
  {
    _id: 'course_1',
    courseKey: 'golden_ages_onboarding',
    title: 'Golden Ages Home Care Onboarding',
    description: 'Learn our mission and policies.',
    category: 'agency_onboarding',
    durationMinutes: 120,
    steps: [],
    passingScore: 80,
    active: true,
    isDefault: true,
    requiredRoles: [],
    progressPercent: 0,
    isCompleted: false,
    isAssignable: true,
    completedStepIds: [],
    expiresAt: null,
  },
  {
    _id: 'course_2',
    courseKey: 'golden_ages_california_requirements',
    title: 'California Care Requirements',
    description: 'State regulatory training.',
    category: 'regulatory',
    durationMinutes: 180,
    steps: [],
    passingScore: 80,
    active: true,
    isDefault: true,
    requiredRoles: [],
    progressPercent: 50,
    isCompleted: false,
    isAssignable: true,
    completedStepIds: ['step_1'],
    expiresAt: null,
  },
]

let mockListCoursesResult: unknown

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: vi.fn((query: unknown, args: unknown) => {
    if (args === 'skip') return undefined
    const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
    if (name.includes('listCourses')) return mockListCoursesResult
    return undefined
  }),
  useMutation: () => vi.fn(),
}))

function resetMocks() {
  mockTenant = {
    clerkOrgId: 'org_123',
    tenantName: 'Golden Ages Home Care',
    isLoading: false,
  }
  mockListCoursesResult = mockCourses
}

describe('TrainingHubPage', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('renders the training hub with courses', async () => {
    render(
      <MemoryRouter>
        <TrainingHubPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Training')).toBeInTheDocument()
    })

    expect(
      screen.getByText('Golden Ages Home Care Onboarding'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('California Care Requirements'),
    ).toBeInTheDocument()
    expect(screen.getByText('Start course')).toBeInTheDocument()
    expect(screen.getByText('Continue')).toBeInTheDocument()
  })

  it('shows empty state when no courses are assigned', async () => {
    mockListCoursesResult = []

    render(
      <MemoryRouter>
        <TrainingHubPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('No courses assigned')).toBeInTheDocument()
    })
  })
})
