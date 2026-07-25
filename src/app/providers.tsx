import { ClerkProvider, useAuth, useClerk } from '@clerk/react'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithAuth } from 'convex/react'
import type { PropsWithChildren, ReactElement } from 'react'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import { useCallback, useMemo, useRef } from 'react'

const ClerkProviderFromEnv = ClerkProvider as unknown as (
  props: PropsWithChildren & {
    publishableKey?: string
    routerPush?: (to: string) => void
    routerReplace?: (to: string) => void
    signInUrl?: string
    signUpUrl?: string
    signInFallbackRedirectUrl?: string
    signUpFallbackRedirectUrl?: string
  },
) => ReactElement

const convex = new ConvexReactClient(
  import.meta.env.VITE_CONVEX_URL ?? 'https://tidy-crocodile-154.convex.cloud',
)

/** Clerk + Convex auth adapter using the default Clerk session token.
 *
 *  Fetches the default token (not a named template) and forces a refresh
 *  when the active organization changes so Convex receives the new org
 *  claims immediately.
 */
function useAuthFromClerk() {
  const { isLoaded, isSignedIn, getToken, orgId, orgRole } = useAuth()
  const { setActive } = useClerk()
  const lastFetchedOrgIdRef = useRef<string | null | undefined>(undefined)

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const orgChanged = lastFetchedOrgIdRef.current !== orgId
      if (orgChanged) {
        lastFetchedOrgIdRef.current = orgId
      }
      try {
        return await getToken({ skipCache: forceRefreshToken || orgChanged })
      } catch {
        // Caregiver/candidate users have no Clerk org membership. If Clerk
        // still has a stale active organization from a previous session,
        // getToken throws 'not a member of the organization'. Clear the
        // stale org and retry without org claims so Convex gets a valid JWT.
        try {
          await setActive?.({ organization: null })
          return await getToken({ skipCache: true })
        } catch {
          return null
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orgId, orgRole, setActive],
  )

  return useMemo(
    () => ({
      isLoading: !isLoaded,
      isAuthenticated: isSignedIn ?? false,
      fetchAccessToken,
    }),
    [isLoaded, isSignedIn, fetchAccessToken],
  )
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <BrowserRouter>
      <ClerkWithRouter>{children}</ClerkWithRouter>
    </BrowserRouter>
  )
}

function ClerkWithRouter({ children }: PropsWithChildren) {
  const navigate = useNavigate()

  return (
    <ClerkProviderFromEnv
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/select-agency"
      signUpFallbackRedirectUrl="/select-agency"
    >
      <ConvexProviderWithAuth client={convex} useAuth={useAuthFromClerk}>
        {children}
      </ConvexProviderWithAuth>
    </ClerkProviderFromEnv>
  )
}
