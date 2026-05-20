import { describe, it, expect } from 'vitest'

describe('Auth adapter source', () => {
  it('providers module loads without error', async () => {
    const mod = await import('./providers')
    expect(mod).toHaveProperty('AppProviders')
  })
})

// The auth adapter uses ConvexProviderWithAuth with a custom hook that
// fetches Clerk's default session token. It tracks lastFetchedOrgIdRef
// and forces skipCache when the active org changes so Convex receives
// fresh org claims immediately after setActive.
