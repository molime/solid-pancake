import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  clerkProvider: vi.fn(
    ({ children }: { children: React.ReactNode }) => children,
  ),
}))

vi.mock('@clerk/react', () => ({
  ClerkProvider: mocks.clerkProvider,
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: false,
    getToken: vi.fn(),
    orgId: null,
    orgRole: null,
  }),
}))

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  ConvexReactClient: vi.fn(),
  ConvexProviderWithAuth: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="convex-provider">{children}</div>
  ),
}))

describe('AppProviders', () => {
  it('connects Clerk routing to React Router', async () => {
    const { AppProviders } = await import('./providers')

    render(
      <AppProviders>
        <div>App child</div>
      </AppProviders>,
    )

    expect(screen.getByText('App child')).toBeInTheDocument()
    expect(mocks.clerkProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        signInUrl: '/sign-in',
        signUpUrl: '/sign-up',
        signInFallbackRedirectUrl: '/select-agency',
        signUpFallbackRedirectUrl: '/select-agency',
        routerPush: expect.any(Function),
        routerReplace: expect.any(Function),
      }),
      undefined,
    )
  })
})

// The auth adapter uses ConvexProviderWithAuth with a custom hook that
// fetches Clerk's default session token. It tracks lastFetchedOrgIdRef
// and forces skipCache when the active org changes so Convex receives
// fresh org claims immediately after setActive.
