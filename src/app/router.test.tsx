import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppRouter } from './router'
import { getFunctionName } from 'convex/server'

vi.mock('@clerk/react', async () => {
  const actual =
    await vi.importActual<typeof import('@clerk/react')>('@clerk/react')
  return {
    ...actual,
    SignIn: () => <div data-testid="sign-in">SignIn</div>,
    SignUp: () => <div data-testid="sign-up">SignUp</div>,
    CreateOrganization: () => (
      <div data-testid="create-org">CreateOrganization</div>
    ),
    useOrganization: vi.fn(() => ({ organization: null, isLoaded: true })),
    useOrganizationList: vi.fn(() => ({
      userMemberships: { data: [] },
      isLoaded: true,
    })),
    useUser: vi.fn(() => ({ user: null, isLoaded: true })),
    useAuth: vi.fn(() => ({ isLoaded: true, isSignedIn: false })),
    useClerk: vi.fn(() => ({ signOut: vi.fn() })),
  }
})

vi.mock('convex/react', async () => {
  const actual =
    await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: vi.fn(() => undefined),
    useMutation: vi.fn(() => vi.fn()),
    useAction: vi.fn(() => vi.fn()),
    useConvexAuth: vi.fn(() => ({ isLoading: false, isAuthenticated: false })),
    ConvexProviderWithAuth: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  }
})

import { useAuth, useOrganization, useUser } from '@clerk/react'
import { useQuery } from 'convex/react'

vi.mock('./auth/SelectAgencyPage', () => ({
  SelectAgencyPage: () => (
    <div data-testid="select-agency">SelectAgencyPage</div>
  ),
}))

vi.mock('./shell/Topbar', () => ({
  Topbar: () => <div data-testid="topbar">Topbar</div>,
}))

vi.mock('@/features/scheduling/pages/SchedulingPage', () => ({
  SchedulingPage: () => <div data-testid="scheduling-page">SchedulingPage</div>,
}))

vi.mock('@/features/scheduling/pages/CaregiverSchedulePage', () => ({
  CaregiverSchedulePage: () => (
    <div data-testid="caregiver-schedule-page">CaregiverSchedulePage</div>
  ),
}))

vi.mock('@/features/caregiver/pages/CaregiverTodayPage', () => ({
  CaregiverTodayPage: () => (
    <div data-testid='caregiver-today-page'>CaregiverTodayPage</div>
  ),
}))

vi.mock('@/features/scheduling/pages/AvailabilityPage', () => ({
  AvailabilityPage: () => (
    <div data-testid="availability-page">AvailabilityPage</div>
  ),
}))

vi.mock('@/features/hr/pages/HRDashboardPage', () => ({
  HRDashboardPage: () => <div data-testid="hr-dashboard-page">HRDashboardPage</div>,
}))

vi.mock('@/features/hr/pages/CandidatePipelinePage', () => ({
  CandidatePipelinePage: () => (
    <div data-testid="hr-candidate-pipeline-page">CandidatePipelinePage</div>
  ),
}))

function TestRouter({ initialEntries }: { initialEntries: string[] }) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <AppRouter />
    </MemoryRouter>
  )
}

describe('AppRouter auth routes', () => {
  it('renders SignUp at /sign-up', () => {
    render(<TestRouter initialEntries={['/sign-up']} />)
    expect(screen.getByTestId('sign-up')).toBeInTheDocument()
  })

  it('renders SignUp at /sign-up/verify-email-address', () => {
    render(<TestRouter initialEntries={['/sign-up/verify-email-address']} />)
    expect(screen.getByTestId('sign-up')).toBeInTheDocument()
  })

  it('renders SignUp at /sign-up/continue', () => {
    render(<TestRouter initialEntries={['/sign-up/continue']} />)
    expect(screen.getByTestId('sign-up')).toBeInTheDocument()
  })

  it('renders SignUp at /accept-invitation', () => {
    render(<TestRouter initialEntries={['/accept-invitation']} />)
    expect(screen.getByTestId('sign-up')).toBeInTheDocument()
  })

  it('renders SignIn at /sign-in', () => {
    render(<TestRouter initialEntries={['/sign-in']} />)
    expect(screen.getByTestId('sign-in')).toBeInTheDocument()
  })

  it('renders SignIn at /sign-in/factor-one', () => {
    render(<TestRouter initialEntries={['/sign-in/factor-one']} />)
    expect(screen.getByTestId('sign-in')).toBeInTheDocument()
  })
})

function mockSignedInWithRole(role: string) {
  vi.mocked(useAuth).mockReturnValue({
    isLoaded: true,
    isSignedIn: true,
  } as unknown as ReturnType<typeof useAuth>)

  vi.mocked(useOrganization).mockReturnValue({
    isLoaded: true,
    organization: { id: 'org_123', name: 'Agency' },
  } as unknown as ReturnType<typeof useOrganization>)

  vi.mocked(useUser).mockReturnValue({
    isLoaded: true,
    user: { id: 'user_123', firstName: 'Test' },
  } as unknown as ReturnType<typeof useUser>)

  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(
        queryRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'members:me') return { role }
      if (name === 'members:checkMembership') return true
      if (name === 'platformTrainingCompletions:listMyCompletions') {
        return role === 'org:caregiver' || role === 'org:candidate'
          ? [{ trainingId: 'platform_training', status: 'complete' }]
          : []
      }
      if (name === 'onboarding:hasPlatformTrainingCompleted') return role === 'org:caregiver' || role === 'org:candidate'
      return undefined
    }) as unknown as typeof useQuery,
  )
}

function mockSignedInWithRoleAndTraining(role: string, trainingComplete: boolean) {
  vi.mocked(useAuth).mockReturnValue({
    isLoaded: true,
    isSignedIn: true,
  } as unknown as ReturnType<typeof useAuth>)

  vi.mocked(useOrganization).mockReturnValue({
    isLoaded: true,
    organization: { id: 'org_123', name: 'Agency' },
  } as unknown as ReturnType<typeof useOrganization>)

  vi.mocked(useUser).mockReturnValue({
    isLoaded: true,
    user: { id: 'user_123', firstName: 'Test' },
  } as unknown as ReturnType<typeof useUser>)

  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(
        queryRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'members:me') return { role }
      if (name === 'members:checkMembership') return true
      if (name === 'platformTrainingCompletions:listMyCompletions') {
        if (role !== 'org:caregiver' && role !== 'org:candidate') return []
        return trainingComplete
          ? [{ trainingId: 'platform_training', status: 'completed' }]
          : []
      }
      if (name === 'onboarding:hasPlatformTrainingCompleted') return trainingComplete
      return undefined
    }) as unknown as typeof useQuery,
  )
}

describe('AppRouter scheduling routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders SchedulingPage at /scheduling for org:admin', async () => {
    mockSignedInWithRole('org:admin')

    render(<TestRouter initialEntries={['/scheduling']} />)

    await waitFor(() => {
      expect(screen.getByTestId('scheduling-page')).toBeInTheDocument()
    })
  })

  it('renders SchedulingPage at /scheduling for org:coordinator', async () => {
    mockSignedInWithRole('org:coordinator')

    render(<TestRouter initialEntries={['/scheduling']} />)

    await waitFor(() => {
      expect(screen.getByTestId('scheduling-page')).toBeInTheDocument()
    })
  })

  it('renders CaregiverSchedulePage at /caregiver/schedule for org:caregiver', async () => {
    mockSignedInWithRole('org:caregiver')

    render(<TestRouter initialEntries={['/caregiver/schedule']} />)

    await waitFor(() => {
      expect(screen.getByTestId('caregiver-schedule-page')).toBeInTheDocument()
    })
  })

  it('renders AvailabilityPage at /caregiver/availability for org:caregiver', async () => {
    mockSignedInWithRole('org:caregiver')

    render(<TestRouter initialEntries={['/caregiver/availability']} />)

    await waitFor(() => {
      expect(screen.getByTestId('availability-page')).toBeInTheDocument()
    })
  })

  it('redirects caregiver away from /scheduling', async () => {
    mockSignedInWithRole('org:caregiver')

    render(<TestRouter initialEntries={['/scheduling']} />)

    await waitFor(() => {
      expect(
        screen.queryByTestId('scheduling-page'),
      ).not.toBeInTheDocument()
    })
  })

  it('allows caregiver to /caregiver/today when training is complete (legacy completed status)', async () => {
    mockSignedInWithRoleAndTraining('org:caregiver', true)

    render(<TestRouter initialEntries={['/caregiver/today']} />)

    await waitFor(() => {
      expect(screen.getByTestId('caregiver-today-page')).toBeInTheDocument()
    })
  })

  it('redirects caregiver from /caregiver/today to training when incomplete', async () => {
    mockSignedInWithRoleAndTraining('org:caregiver', false)

    render(<TestRouter initialEntries={['/caregiver/today']} />)

    await waitFor(() => {
      expect(
        screen.queryByTestId('caregiver-today-page'),
      ).not.toBeInTheDocument()
    })
  })
})

describe('AppRouter HR routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders HRDashboardPage at /hr for org:hr', async () => {
    mockSignedInWithRole('org:hr')

    render(<TestRouter initialEntries={['/hr']} />)

    await waitFor(() => {
      expect(screen.getByTestId('hr-dashboard-page')).toBeInTheDocument()
    })
  })

  it('renders CandidatePipelinePage at /hr/candidates for org:hr', async () => {
    mockSignedInWithRole('org:hr')

    render(<TestRouter initialEntries={['/hr/candidates']} />)

    await waitFor(() => {
      expect(
        screen.getByTestId('hr-candidate-pipeline-page'),
      ).toBeInTheDocument()
    })
  })

  it('renders HRDashboardPage at /hr for org:admin', async () => {
    mockSignedInWithRole('org:admin')

    render(<TestRouter initialEntries={['/hr']} />)

    await waitFor(() => {
      expect(screen.getByTestId('hr-dashboard-page')).toBeInTheDocument()
    })
  })

  it('redirects org:caregiver away from /hr', async () => {
    mockSignedInWithRole('org:caregiver')

    render(<TestRouter initialEntries={['/hr']} />)

    await waitFor(() => {
      expect(
        screen.queryByTestId('hr-dashboard-page'),
      ).not.toBeInTheDocument()
    })
  })
})
