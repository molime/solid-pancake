import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isDevInvitationBypassEnabled,
  generateClerkSignInTicket,
  updateClerkUserPassword,
  createClerkUserAndJoinOrg,
} from './_utils/invitationBypass'


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
    const ctx = { scheduler: { runAfter: vi.fn(() => Promise.resolve('sched_1')) } as unknown as Scheduler }
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
    const mfaDeletes = calls.filter(([url]) =>
      url.includes('/totp') || url.includes('/backup_codes'),
    )
    expect(mfaDeletes.length).toBeGreaterThanOrEqual(2)
  })
})
