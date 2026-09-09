import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { CoursePlayerPage } from './CoursePlayerPage'
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

vi.mock('@clerk/react', () => ({
  useClerk: () => ({ signOut: vi.fn() }),
}))

const mockCourse = {
  _id: 'course_1',
  courseKey: 'golden_ages_onboarding',
  title: 'Golden Ages Home Care Onboarding',
  description: 'Learn our mission and policies.',
  category: 'agency_onboarding',
  durationMinutes: 120,
  passingScore: 80,
  active: true,
  isDefault: true,
  requiredRoles: [],
  tenantId: 'tenant_1',
  _creationTime: Date.now(),
  createdAt: new Date().toISOString(),
  steps: [
    {
      id: 'welcome',
      title: 'Welcome',
      type: 'text' as const,
      content: 'A\n\nB',
      required: true,
    },
    {
      id: 'mission',
      title: 'Mission',
      type: 'text' as const,
      content: 'C\n\nD',
      required: true,
    },
  ],
  completedStepIds: [] as string[],
  isCompleted: false,
  expiresAt: null,
}

let mockGetCourseResult: unknown

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: vi.fn((query: unknown, args: unknown) => {
    if (args === 'skip') return undefined
    const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
    if (name.includes('getCourse')) return mockGetCourseResult
    return undefined
  }),
  useMutation: () => vi.fn().mockResolvedValue(undefined),
}))

function resetMocks() {
  mockTenant = {
    clerkOrgId: 'org_123',
    tenantName: 'Golden Ages Home Care',
    isLoading: false,
  }
  mockGetCourseResult = { ...mockCourse }
}

function renderPlayer(initialEntry = '/training/course_1') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="training/:courseId" element={<CoursePlayerPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CoursePlayerPage', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('shows a loader while the course is loading', () => {
    mockGetCourseResult = undefined
    renderPlayer()
    expect(screen.getByText('Loading course...')).toBeInTheDocument()
  })

  it('shows a not-found card when the course is missing', async () => {
    mockGetCourseResult = null
    renderPlayer()

    await waitFor(() => {
      expect(screen.getByText('Course not found')).toBeInTheDocument()
    })

    expect(
      screen.getByText(
        'The course you are looking for does not exist or is not available.',
      ),
    ).toBeInTheDocument()
  })

  it('renders the first incomplete step and course progress', async () => {
    renderPlayer()

    await waitFor(() => {
      expect(screen.getByText('Step 1 of 2')).toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
  })

  it('shows the completion card when the course is already completed', async () => {
    mockGetCourseResult = {
      ...mockCourse,
      completedStepIds: ['welcome', 'mission'],
      isCompleted: true,
    }
    renderPlayer()

    await waitFor(() => {
      expect(screen.getByText('Course complete! 🎉')).toBeInTheDocument()
    })

    expect(
      screen.getByRole('button', { name: /Back to training hub/i }),
    ).toBeInTheDocument()
  })

  it('allows the user to complete a text step and advance', async () => {
    const user = userEvent.setup()
    renderPlayer()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    })

    // Expand all cards for the text step.
    const cards = screen.getAllByText(/\.{3}/)
    for (const card of cards) {
      await user.click(card)
    }

    // Acknowledge the step and continue.
    await user.click(
      screen.getByRole('checkbox', {
        name: /I have read and understood this section/i,
      }),
    )
    await user.click(screen.getByRole('button', { name: /Complete & continue/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mission' })).toBeInTheDocument()
    })
  })
})
