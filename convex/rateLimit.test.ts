import { describe, expect, it, afterEach } from 'vitest'
import {
  checkRateLimit,
  resetRateLimitsForTests,
} from './_utils/rateLimit'

afterEach(() => {
  resetRateLimitsForTests()
})

describe('checkRateLimit (sliding window)', () => {
  it('allows requests under the limit', () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit('key:a', 5, 60_000)
      expect(result.allowed).toBe(true)
      expect(result.retryAfterMs).toBe(0)
    }
  })

  it('blocks the request that exceeds the limit', () => {
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit('key:b', 10, 60_000).allowed).toBe(true)
    }
    const blocked = checkRateLimit('key:b', 10, 60_000)
    expect(blocked.allowed).toBe(false)
    // retryAfter points at the oldest hit in the window: positive and
    // bounded by the window length.
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(60_000)
  })

  it('tracks keys independently', () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit('key:c1', 3, 60_000)
    }
    expect(checkRateLimit('key:c1', 3, 60_000).allowed).toBe(false)
    expect(checkRateLimit('key:c2', 3, 60_000).allowed).toBe(true)
  })

  it('resets with resetRateLimitsForTests', () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit('key:d', 3, 60_000)
    }
    expect(checkRateLimit('key:d', 3, 60_000).allowed).toBe(false)
    resetRateLimitsForTests()
    expect(checkRateLimit('key:d', 3, 60_000).allowed).toBe(true)
  })

  it('expires hits after the window elapses', async () => {
    // A 1ms window: the hit is stale by the time we check again.
    expect(checkRateLimit('key:e', 1, 1).allowed).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(checkRateLimit('key:e', 1, 1).allowed).toBe(true)
  })
})
