import { describe, it, expect, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import {
  assertEmailDomainAllowed,
  extractEmailDomain,
  isAllowListError,
  sendClerkInvitation,
} from './invitations'

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

  it('matches our Convex-based domain allowlist error', () => {
    expect(
      isAllowListError(
        new ConvexError(
          "email domain is not allowed: user@other.com is not on this agency's allowed email domains list.",
        ),
      ),
    ).toBe(true)
    expect(
      isAllowListError(new Error('email domain is not allowed: user@other.com')),
    ).toBe(true)
  })
})

describe('extractEmailDomain', () => {
  it('extracts and lowercases the domain', () => {
    expect(extractEmailDomain('User@Example.COM')).toBe('example.com')
    expect(extractEmailDomain('  user@sub.example.org  ')).toBe(
      'sub.example.org',
    )
  })

  it('returns null for malformed emails', () => {
    expect(extractEmailDomain('not-an-email')).toBeNull()
    expect(extractEmailDomain('user@')).toBeNull()
  })
})

describe('assertEmailDomainAllowed', () => {
  it('allows any domain when the list is undefined or empty', () => {
    expect(() =>
      assertEmailDomainAllowed('user@anything.com', undefined),
    ).not.toThrow()
    expect(() => assertEmailDomainAllowed('user@anything.com', null)).not.toThrow()
    expect(() => assertEmailDomainAllowed('user@anything.com', [])).not.toThrow()
  })

  it('allows emails whose domain is in the list (case-insensitive)', () => {
    expect(() =>
      assertEmailDomainAllowed('User@Gmail.COM', ['gmail.com', 'agency.org']),
    ).not.toThrow()
  })

  it('throws an isAllowListError-compatible error for disallowed domains', () => {
    try {
      assertEmailDomainAllowed('user@other.com', ['agency.org'])
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ConvexError)
      expect(isAllowListError(err)).toBe(true)
    }
  })

  it('throws for malformed emails when a list is configured', () => {
    expect(() =>
      assertEmailDomainAllowed('not-an-email', ['agency.org']),
    ).toThrow(/email domain is not allowed/i)
  })
})

describe('sendClerkInvitation domain check', () => {
  it('throws before calling the Clerk API when the domain is not allowed', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await expect(
      sendClerkInvitation({
        secretKey: 'sk_test',
        inviterUserId: 'user_admin',
        clerkOrgId: 'org_test',
        emailAddress: 'user@blocked.com',
        role: 'org:candidate',
        appBaseUrl: 'http://localhost:5173',
        allowedEmailDomains: ['agency.org'],
      }),
    ).rejects.toThrow(/email domain is not allowed/i)
    expect(fetchSpy).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('calls the Clerk API when the domain is allowed', async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'inv_1',
            email_address: 'user@agency.org',
            role: 'org:member',
            status: 'pending',
            created_at: 1700000000,
          }),
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const invitation = await sendClerkInvitation({
      secretKey: 'sk_test',
      inviterUserId: 'user_admin',
      clerkOrgId: 'org_test',
      emailAddress: 'user@agency.org',
      role: 'org:candidate',
      appBaseUrl: 'http://localhost:5173',
      allowedEmailDomains: ['agency.org'],
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(invitation.id).toBe('inv_1')

    vi.unstubAllGlobals()
  })

  it('calls the Clerk API when no domains are configured', async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'inv_2',
            email_address: 'user@anything.com',
            role: 'org:member',
            status: 'pending',
            created_at: 1700000000,
          }),
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await sendClerkInvitation({
      secretKey: 'sk_test',
      inviterUserId: 'user_admin',
      clerkOrgId: 'org_test',
      emailAddress: 'user@anything.com',
      role: 'org:candidate',
      appBaseUrl: 'http://localhost:5173',
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    vi.unstubAllGlobals()
  })
})
