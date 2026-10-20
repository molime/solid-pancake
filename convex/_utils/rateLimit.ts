/**
 * Minimal in-memory sliding-window rate limiter (compliance mini-phase,
 * Stage 5).
 *
 * DOCUMENTED LIMITATION: counters live in a module-scoped Map, so limits are
 * enforced per running instance/isolate only. A client fanned out across many
 * Convex instances is not bounded in aggregate. This limitation is disclosed
 * in the compliance docs (design doc §5); Convex has no built-in limiter.
 */

const windows = new Map<string, number[]>()

export type RateLimitResult = {
  allowed: boolean
  /** Milliseconds until the oldest hit in the window expires (0 when allowed). */
  retryAfterMs: number
}

/**
 * Sliding-window check: at most `limit` hits per `windowMs` for `key`.
 * A hit is recorded only when allowed, so retrying after `retryAfterMs`
 * always succeeds.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
  const cutoff = now - windowMs
  const hits = (windows.get(key) ?? []).filter((t) => t > cutoff)

  if (hits.length >= limit) {
    windows.set(key, hits)
    return { allowed: false, retryAfterMs: Math.max(1, hits[0]! + windowMs - now) }
  }

  hits.push(now)
  windows.set(key, hits)
  return { allowed: true, retryAfterMs: 0 }
}

/** Clears all windows. Used by tests to keep rate-limit state deterministic. */
export function resetRateLimitsForTests() {
  windows.clear()
}
