import { ClerkProvider, useAuth } from '@clerk/react'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithAuth } from 'convex/react'
import type { PropsWithChildren, ReactElement } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { useCallback, useMemo, useRef } from 'react'

const ClerkProviderFromEnv = ClerkProvider as unknown as (
  props: PropsWithChildren & { publishableKey?: string },
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
        return null
      }
    },
    // Clerk's getToken is not memoized, so we depend on org context instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orgId, orgRole],
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
    <ClerkProviderFromEnv publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <ConvexProviderWithAuth client={convex} useAuth={useAuthFromClerk}>
        <BrowserRouter>{children}</BrowserRouter>
      </ConvexProviderWithAuth>
    </ClerkProviderFromEnv>
  )
}
