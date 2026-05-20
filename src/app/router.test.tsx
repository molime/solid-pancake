import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppRouter } from './router'

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

vi.mock('./auth/SelectAgencyPage', () => ({
  SelectAgencyPage: () => (
    <div data-testid="select-agency">SelectAgencyPage</div>
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
