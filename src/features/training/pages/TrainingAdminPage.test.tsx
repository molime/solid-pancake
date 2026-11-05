import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TrainingAdminPage } from './TrainingAdminPage'
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

const activeCourse = {
  _id: 'course_active',
  courseKey: 'ga_california_emergency',
  title: 'California Emergency Procedures',
  description: 'Emergency steps.',
  category: 'regulatory',
  durationMinutes: 45,
  steps: [{ id: 's1', kind: 'text', title: 'Intro', required: true }],
  passingScore: 80,
  active: true,
  isDefault: true,
  requiredRoles: [],
}

const inactiveCourse = {
  ...activeCourse,
  _id: 'course_deprecated',
  courseKey: 'golden_ages_california_requirements',
  title: 'California Care Requirements — Safety & Emergency Training',
  active: false,
}

const mockMembers = [
  {
    _id: 'member_1',
    clerkUserId: 'user_1',
    displayName: 'Samira Manney',
    email: 'admin@goldenagesinhomecare.com',
    role: 'org:admin',
  },
]

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: vi.fn((query: unknown, args: unknown) => {
    if (args === 'skip') return undefined
    const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
    if (name === 'training:listAllCourses') return [activeCourse, inactiveCourse]
    if (name === 'training:listCompletions')
      return [
        { courseId: 'course_active', completions: [] },
        { courseId: 'course_deprecated', completions: [] },
      ]
    if (name === 'members:list') return mockMembers
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
}

describe('TrainingAdminPage completions panel', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('shows the completions roster for active courses only', async () => {
    render(
      <MemoryRouter>
        <TrainingAdminPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('California Emergency Procedures')).toBeInTheDocument()
    })

    // Exactly one completions roster (the active course). The deprecated
    // inactive course must not render one — a "Not started" roster on a
    // superseded course reads as a compliance gap (GA, Nov 2026).
    expect(screen.getAllByText(/members completed/)).toHaveLength(1)

    const inactiveCard = screen
      .getByText(
        'California Care Requirements — Safety & Emergency Training',
      )
      .closest('div[class*="rounded"]') ?? document.body
    expect(within(inactiveCard as HTMLElement).queryByText(/members completed/)).toBeNull()
  })
})
