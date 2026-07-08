import { describe, it, expect } from 'vitest'
import { ConvexError } from 'convex/values'
import { isAllowListError } from './invitations'

describe('isAllowListError', () => {
  it('matches the dev Clerk allow-list message', () => {
    expect(
      isAllowListError(
        new ConvexError(
          'e2e.bypass.candidate.1783526775764@gmail.com is not allowed to access this application.',
        ),
      ),
    ).toBe(true)
  })

  it('matches plain allow-list strings', () => {
    expect(isAllowListError(new Error('Email not on the allowlist'))).toBe(true)
    expect(isAllowListError('email_address is blocked')).toBe(true)
    expect(isAllowListError('invalid email domain')).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isAllowListError(new Error('Network timeout'))).toBe(false)
    expect(isAllowListError('Something went wrong')).toBe(false)
  })
})
