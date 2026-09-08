import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Scheduler } from 'convex/server'
import {
  isDevInvitationBypassEnabled,
  generateClerkSignInTicket,
  updateClerkUserPassword,
  createClerkUserAndJoinOrg,
  friendlyClerkMessage,
  clerkErrorMessage,
  accountTypeLabel,
} from './_utils/invitationBypass'


describe('accountTypeLabel', () => {
  it('maps roles to human account-type labels', () => {
    expect(accountTypeLabel('org:admin')).toBe('owner')
    expect(accountTypeLabel('owner')).toBe('owner')
    expect(accountTypeLabel('org:coordinator')).toBe('coordinator')
    expect(accountTypeLabel('org:caregiver')).toBe('employee')
    expect(accountTypeLabel('org:candidate')).toBe('ATRIA-X')
  })
})


describe('isDevInvitationBypassEnabled', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('is disabled in all environments', () => {
    expect(isDevInvitationBypassEnabled()).toBe(false)
  })
})

describe('generateClerkSignInTicket', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'sit_test',
              token: 'sint_test',
              user_id: 'user_test',
            }),
        }),
      ) as unknown as typeof fetch,
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('returns a ticket token', async () => {
    const token = await generateClerkSignInTicket({
      secretKey: 'sk_test',
      clerkUserId: 'user_test',
    })
    expect(token).toBe('sint_test')
  })
})

describe('updateClerkUserPassword', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'user_test' }),
        }),
      ) as unknown as typeof fetch,
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('updates the user password', async () => {
    await expect(
      updateClerkUserPassword({
        secretKey: 'sk_test',
        clerkUserId: 'user_test',
        password: 'new-password',
      }),
    ).resolves.toBeUndefined()
  })

  it('sends skip_password_checks: false so Clerk rejects breached passwords', async () => {
    await updateClerkUserPassword({
      secretKey: 'sk_test',
      clerkUserId: 'user_test',
      password: 'new-password',
    })
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][]
    expect(calls).toHaveLength(1)
    const [url, init] = calls[0]
    expect(url).toBe('https://api.clerk.com/v1/users/user_test')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({
      password: 'new-password',
      skip_password_checks: false,
    })
  })
})

describe('createClerkUserAndJoinOrg', () => {
  beforeEach(() => {
    vi.stubEnv('CLERK_SECRET_KEY', '***')
    vi.stubEnv('APP_URL', 'http://localhost:5173')
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit | undefined) => {
        if (url === 'https://api.clerk.com/v1/users' && init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                id: 'user_created',
                email_addresses: [{ email_address: 'test@example.com' }],
              }),
          })
        }
        if (url.includes('/memberships') && init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ id: 'mem_created' }),
          })
        }
        if (url.includes('/sign_in_tokens')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                id: 'sit_created',
                token: 'sint_created',
                user_id: 'user_created',
              }),
          })
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ errors: [{ message: 'Not found' }] }),
        })
      }) as unknown as typeof fetch,
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('creates a user, joins org, returns magic link and initial password', async () => {
    const result = await createClerkUserAndJoinOrg({
      ctx: {
      scheduler: {
        runAfter: async () => 'scheduled_test',
        runAt: async () => 'scheduled_test',
        cancel: async () => undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    },
      secretKey: 'sk_test',
      clerkOrgId: 'org_test',
      emailAddress: 'test@example.com',
      displayName: 'Test User',
      role: 'org:candidate',
      appBaseUrl: 'http://localhost:5173',
    })
    expect(result.clerkUserId).toBe('user_created')
    expect(result.invitationId).toMatch(/^manual:user_created/)
    expect(result.magicLink).toContain('__clerk_ticket=sint_created')
    expect(result.initialPassword).toBeDefined()
    expect(result.initialPassword.length).toBeGreaterThanOrEqual(12)
  })
})


describe('createClerkUserAndJoinOrg', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/v1/users') && !url.includes('/email_addresses')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: 'user_new',
                email_addresses: [{ id: 'email_new', email_address: 'new@example.com' }],
              }),
          })
        }
        if (url.includes('/email_addresses/')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'email_new' }) })
        }
        if (url.includes('/memberships')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'mem_new' }) })
        }
        if (url.includes('/sign_in_tokens')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ token: 'ticket_new' }),
          })
        }
        // totp / backup_codes delete
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      }) as unknown as typeof fetch,
    )
    vi.stubGlobal('process', { env: { EMAIL_ENABLED: 'false' } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('creates a user, verifies the email, disables mfa, joins org and returns a magic link', async () => {
    const ctx = {
      scheduler: {
        runAfter: vi.fn(() => Promise.resolve('sched_1')),
        runAt: vi.fn(() => Promise.resolve('sched_2')),
        cancel: vi.fn(() => Promise.resolve()),
      } as unknown as Scheduler,
    }
    const result = await createClerkUserAndJoinOrg({
      ctx,
      secretKey: 'sk_test',
      clerkOrgId: 'org_test',
      emailAddress: 'new@example.com',
      displayName: 'New User',
      role: 'org:caregiver',
      appBaseUrl: 'http://localhost:5173',
    })
    expect(result.clerkUserId).toBe('user_new')
    expect(result.magicLink).toContain('/sign-in?__clerk_ticket=ticket_new')
    expect(result.initialPassword).toBeDefined()
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][]
    const verifyCall = calls.find(([url]) =>
      url.includes('/email_addresses/email_new'),
    )
    expect(verifyCall).toBeDefined()
    expect(verifyCall?.[1]?.body).toContain('"verified":true')
    // Temporary passwords must still bypass Clerk's breach checks
    const createCall = calls.find(([url, init]) =>
      url === 'https://api.clerk.com/v1/users' && init?.method === 'POST',
    )
    expect(createCall).toBeDefined()
    expect(JSON.parse(createCall?.[1]?.body as string).skip_password_checks).toBe(true)
    const mfaDeletes = calls.filter(([url]) =>
      url.includes('/totp') || url.includes('/backup_codes'),
    )
    expect(mfaDeletes.length).toBeGreaterThanOrEqual(2)
  })

  it('throws before any Clerk API call when the email domain is not allowed', async () => {
    const fetchSpy = fetch as unknown as ReturnType<typeof vi.fn>
    fetchSpy.mockClear()
    const ctx = {
      scheduler: {
        runAfter: vi.fn(() => Promise.resolve('sched_1')),
        runAt: vi.fn(() => Promise.resolve('sched_2')),
        cancel: vi.fn(() => Promise.resolve()),
      } as unknown as Scheduler,
    }
    await expect(
      createClerkUserAndJoinOrg({
        ctx,
        secretKey: 'sk_test',
        clerkOrgId: 'org_test',
        emailAddress: 'blocked@other.com',
        displayName: 'Blocked User',
        role: 'org:candidate',
        appBaseUrl: 'http://localhost:5173',
        allowedEmailDomains: ['example.com'],
      }),
    ).rejects.toThrow(/email domain is not allowed/i)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('creates the user when the email domain is allowed', async () => {
    const ctx = {
      scheduler: {
        runAfter: vi.fn(() => Promise.resolve('sched_1')),
        runAt: vi.fn(() => Promise.resolve('sched_2')),
        cancel: vi.fn(() => Promise.resolve()),
      } as unknown as Scheduler,
    }
    const result = await createClerkUserAndJoinOrg({
      ctx,
      secretKey: 'sk_test',
      clerkOrgId: 'org_test',
      emailAddress: 'new@example.com',
      displayName: 'New User',
      role: 'org:candidate',
      appBaseUrl: 'http://localhost:5173',
      allowedEmailDomains: ['example.com'],
    })
    expect(result.clerkUserId).toBe('user_new')
  })

  it('sends a role-aware welcome email naming the account type', async () => {
    const runAfter = vi.fn(() => Promise.resolve('sched_1'))
    const ctx = {
      scheduler: {
        runAfter,
        runAt: vi.fn(() => Promise.resolve('sched_2')),
        cancel: vi.fn(() => Promise.resolve()),
      } as unknown as Scheduler,
    }
    await createClerkUserAndJoinOrg({
      ctx,
      secretKey: 'sk_test',
      clerkOrgId: 'org_test',
      emailAddress: 'new@example.com',
      displayName: 'New User',
      role: 'org:coordinator',
      appBaseUrl: 'http://localhost:5173',
      accountType: 'coordinator',
      agencyName: 'Sunrise <Care>',
    })
    expect(runAfter).toHaveBeenCalled()
    const emailArgs = (
      runAfter.mock.calls as unknown as [
        number,
        unknown,
        { subject: string; html: string },
      ][]
    )[0][2]
    expect(emailArgs.subject).toBe('Your coordinator account is ready')
    // Agency name is HTML-escaped before interpolation.
    expect(emailArgs.html).toContain(
      'Your coordinator account for Sunrise &lt;Care&gt; is ready.',
    )
  })

  it('keeps the generic subject when no account type is given', async () => {
    const runAfter = vi.fn(() => Promise.resolve('sched_1'))
    const ctx = {
      scheduler: {
        runAfter,
        runAt: vi.fn(() => Promise.resolve('sched_2')),
        cancel: vi.fn(() => Promise.resolve()),
      } as unknown as Scheduler,
    }
    await createClerkUserAndJoinOrg({
      ctx,
      secretKey: 'sk_test',
      clerkOrgId: 'org_test',
      emailAddress: 'new@example.com',
      displayName: 'New User',
      role: 'org:candidate',
      appBaseUrl: 'http://localhost:5173',
    })
    const emailArgs = (
      runAfter.mock.calls as unknown as [number, unknown, { subject: string }][]
    )[0][2]
    expect(emailArgs.subject).toBe('Your ATRIA-X account is ready')
  })

  it('includes the payment-setup link paragraph when provided', async () => {
    const runAfter = vi.fn(() => Promise.resolve('sched_1'))
    const ctx = {
      scheduler: {
        runAfter,
        runAt: vi.fn(() => Promise.resolve('sched_2')),
        cancel: vi.fn(() => Promise.resolve()),
      } as unknown as Scheduler,
    }
    await createClerkUserAndJoinOrg({
      ctx,
      secretKey: 'sk_test',
      clerkOrgId: 'org_test',
      emailAddress: 'new@example.com',
      displayName: 'New User',
      role: 'org:admin',
      appBaseUrl: 'http://localhost:5173',
      accountType: 'owner',
      agencyName: 'Sunrise Care',
      paymentSetupUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
    })
    const emailArgs = (
      runAfter.mock.calls as unknown as [number, unknown, { html: string }][]
    )[0][2]
    expect(emailArgs.html).toContain(
      'href="https://checkout.stripe.com/c/pay/cs_test_123"',
    )
    expect(emailArgs.html).toContain('set up your payment method')
  })
})

describe('friendlyClerkMessage', () => {
  it('maps the weak-password Clerk error to friendly text', () => {
    expect(friendlyClerkMessage('Given password is not strong enough.')).toBe(
      'Your password is not strong enough. Please use a mix of uppercase and lowercase letters, numbers, and symbols. Avoid common passwords.',
    )
  })

  it('maps the duplicate-email Clerk error to friendly text', () => {
    expect(friendlyClerkMessage('That email address is already in use.')).toBe(
      'An account with this email already exists. Please sign in instead.',
    )
  })

  it('maps the invalid-phone Clerk error to friendly text', () => {
    expect(friendlyClerkMessage('That phone number is invalid.')).toBe(
      'Please enter a valid 10-digit phone number.',
    )
  })

  it('maps the invalid-email Clerk error to friendly text', () => {
    expect(friendlyClerkMessage('That email address is invalid.')).toBe(
      'Please enter a valid email address.',
    )
  })

  it('maps the lowercase not-found Clerk error to friendly text', () => {
    expect(friendlyClerkMessage('user not found')).toBe(
      'Account not found. Please check your email or use the sign-in link.',
    )
  })

  it('maps the identification_exists Clerk error to friendly text', () => {
    expect(friendlyClerkMessage('identification_exists')).toBe(
      'An account with this email already exists.',
    )
  })

  it("matches Clerk's capitalized 'Not found' error case-insensitively", () => {
    expect(friendlyClerkMessage('Not found')).toBe(
      'Account not found. Please check your email or use the sign-in link.',
    )
  })

  it("matches 'NOT FOUND' case-insensitively", () => {
    expect(friendlyClerkMessage('NOT FOUND')).toBe(
      'Account not found. Please check your email or use the sign-in link.',
    )
  })

  it("strips the 'at async handler' suffix from unmapped errors", () => {
    expect(
      friendlyClerkMessage(
        'Something went sideways. at async handler (../convex/candidates.ts:2609:6)',
      ),
    ).toBe('Something went sideways.')
  })

  it("strips the 'Called by client' suffix from unmapped errors", () => {
    expect(
      friendlyClerkMessage('Something went sideways. Called by client'),
    ).toBe('Something went sideways.')
  })

  it('strips both Convex wrapper suffixes from unmapped errors', () => {
    expect(
      friendlyClerkMessage(
        'Something went sideways. at async handler (../convex/candidates.ts:2609:6) Called by client',
      ),
    ).toBe('Something went sideways.')
  })

  it('returns unmapped errors unchanged apart from wrapper stripping', () => {
    expect(friendlyClerkMessage('A totally unknown Clerk error.')).toBe(
      'A totally unknown Clerk error.',
    )
  })
})

describe('clerkErrorMessage', () => {
  it('translates a mapped Clerk error payload', () => {
    expect(
      clerkErrorMessage({
        errors: [{ message: 'Given password is not strong enough.' }],
      }),
    ).toBe(
      'Your password is not strong enough. Please use a mix of uppercase and lowercase letters, numbers, and symbols. Avoid common passwords.',
    )
  })

  it('prefers long_message over message', () => {
    expect(
      clerkErrorMessage({
        errors: [
          {
            message: 'short',
            long_message: 'That email address is already in use.',
          },
        ],
      }),
    ).toBe('An account with this email already exists. Please sign in instead.')
  })

  it("translates Clerk's capitalized 'Not found' payload", () => {
    expect(clerkErrorMessage({ errors: [{ message: 'Not found' }] })).toBe(
      'Account not found. Please check your email or use the sign-in link.',
    )
  })

  it('falls back to a generic message for non-string error payloads', () => {
    expect(clerkErrorMessage({ errors: [{ code: 422 }] })).toBe(
      'Clerk request failed.',
    )
  })

  it('falls back to a generic message for non-object payloads', () => {
    expect(clerkErrorMessage(null)).toBe('Clerk request failed.')
    expect(clerkErrorMessage('boom')).toBe('Clerk request failed.')
    expect(clerkErrorMessage(undefined)).toBe('Clerk request failed.')
  })

  it('falls back to a generic message when errors is not an array', () => {
    expect(clerkErrorMessage({ errors: 'nope' })).toBe('Clerk request failed.')
  })
})
