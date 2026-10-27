import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { resetRateLimitsForTests } from './_utils/rateLimit'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

type TestConvex = ReturnType<typeof createTestConvex>

beforeEach(() => {
  resetRateLimitsForTests()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function asOrgUser(
  t: TestConvex,
  userId: string,
  clerkOrgId: string,
  role: 'org:admin' | 'org:hr' | 'org:coordinator',
) {
  return t.withIdentity({ subject: userId, org_id: clerkOrgId, org_role: role })
}

function asPlatformAdmin(t: TestConvex, userId = 'plat1') {
  return t.withIdentity({ subject: userId })
}

const EMPLOYEE_ID = 'emp_org_a'
const EMPLOYEE_EMAIL = 'emp@example.com'

async function seedTenant(t: TestConvex, clerkOrgId: string, adminId: string) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId,
      name: `Agency ${clerkOrgId}`,
      slug: `slug-${clerkOrgId}`,
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: adminId,
      role: 'org:admin',
      displayName: 'Agency Admin',
      email: `${adminId}@example.com`,
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: `hr_${clerkOrgId}`,
      role: 'org:hr',
      displayName: 'HR User',
      email: `hr_${clerkOrgId}@example.com`,
    })
    if (clerkOrgId === 'org_a') {
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: EMPLOYEE_ID,
        role: 'org:caregiver',
        displayName: 'Employee One',
        email: EMPLOYEE_EMAIL,
      })
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: EMPLOYEE_ID,
        displayName: 'Employee One',
        email: EMPLOYEE_EMAIL,
        adpSyncStatus: 'matched',
        createdAt: new Date().toISOString(),
      })
    }
    return tenantId
  })
}

async function seedPlatformAdmin(t: TestConvex, clerkUserId = 'plat1') {
  return t.run(async (ctx) => {
    await ctx.db.insert('platformAdmins', {
      clerkUserId,
      createdAt: new Date().toISOString(),
    })
  })
}

async function requestsFor(t: TestConvex, tenantId: Id<'tenants'>) {
  return t.run(async (ctx) =>
    ctx.db
      .query('emailChangeRequests')
      .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
      .collect(),
  )
}

async function auditEvents(t: TestConvex, tenantId: Id<'tenants'>) {
  return t.run(async (ctx) =>
    ctx.db
      .query('auditEvents')
      .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
      .collect(),
  )
}

async function notifications(t: TestConvex) {
  return t.run(async (ctx) => ctx.db.query('notifications').collect())
}

async function requestEmailChange(
  t: TestConvex,
  overrides: {
    clerkOrgId?: string
    asUser?: string
    asRole?: 'org:admin' | 'org:hr' | 'org:coordinator'
    memberClerkUserId?: string
    newEmail?: string
    reason?: string
  } = {},
) {
  const clerkOrgId = overrides.clerkOrgId ?? 'org_a'
  return asOrgUser(
    t,
    overrides.asUser ?? `hr_${clerkOrgId}`,
    clerkOrgId,
    overrides.asRole ?? 'org:hr',
  ).mutation(api.emailChanges.request, {
    clerkOrgId,
    memberClerkUserId: overrides.memberClerkUserId ?? EMPLOYEE_ID,
    newEmail: overrides.newEmail ?? 'new@example.com',
    reason: overrides.reason ?? 'No longer has access to the old email',
  })
}

// Clerk fetch stub: routes on URL + method and returns a minimal json payload
// per endpoint (same mocking style as candidates.test.ts).
function stubClerkEmailSwap(employeeId = EMPLOYEE_ID) {
  vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_clerk')
  const fetchMock = vi.fn(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      const respond = (status: number, body: unknown) =>
        Promise.resolve(
          new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
          }),
        )

      if (url === `https://api.clerk.com/v1/users/${employeeId}`) {
        return method === 'GET'
          ? respond(200, {
              id: employeeId,
              primary_email_address_id: 'email_old_id',
              email_addresses: [
                { id: 'email_old_id', email_address: EMPLOYEE_EMAIL },
              ],
            })
          : respond(200, { id: employeeId })
      }
      if (url === 'https://api.clerk.com/v1/email_addresses') {
        return method === 'POST'
          ? respond(200, { id: 'email_new_id', email_address: 'new@example.com' })
          : respond(404, {})
      }
      if (url.endsWith('/v1/email_addresses/email_old_id')) {
        return respond(200, { id: 'email_old_id' })
      }
      return respond(404, {})
    },
  )
  vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
  return fetchMock
}

describe('emailChanges.request', () => {
  it('org:hr request creates a pending row, audits without the old email, and notifies org:admins', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a', 'admin_a')
    vi.useFakeTimers()

    const requestId = await requestEmailChange(t)
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const requests = await requestsFor(t, tenantId)
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      _id: requestId,
      memberClerkUserId: EMPLOYEE_ID,
      memberName: 'Employee One',
      oldEmail: EMPLOYEE_EMAIL,
      newEmail: 'new@example.com',
      status: 'pending',
      requestedBy: 'hr_org_a',
      requesterName: 'hr_org_a',
    })

    const events = await auditEvents(t, tenantId)
    const requested = events.find(
      (e) => e.action === 'member.email_change_requested',
    )
    expect(requested).toMatchObject({ category: 'hr', kind: 'tenant' })
    // The old email must never appear in the audit metadata.
    expect(requested?.metadata).not.toHaveProperty('oldEmail')
    expect(requested?.metadata).toMatchObject({
      memberClerkUserId: EMPLOYEE_ID,
      newEmail: 'new@example.com',
    })

    const notify = await notifications(t)
    const adminNotice = notify.find(
      (n) => n.clerkUserId === 'admin_a' && n.type === 'member.email_change_requested',
    )
    expect(adminNotice).toBeDefined()
    expect(adminNotice?.message).toContain('Employee One')
    expect(adminNotice?.message).toContain('ATRIA')
  })

  it('rejects an invalid email address', async () => {
    const t = createTestConvex()
    await seedTenant(t, 'org_a', 'admin_a')

    await expect(
      requestEmailChange(t, { newEmail: 'not-an-email' }),
    ).rejects.toThrow(/valid email/)
  })

  it('rejects a member that does not belong to the tenant', async () => {
    const t = createTestConvex()
    await seedTenant(t, 'org_a', 'admin_a')

    await expect(
      requestEmailChange(t, { memberClerkUserId: 'stranger' }),
    ).rejects.toThrow(/not a member/)
  })

  it('rejects when the new email equals the current email', async () => {
    const t = createTestConvex()
    await seedTenant(t, 'org_a', 'admin_a')

    await expect(
      requestEmailChange(t, { newEmail: EMPLOYEE_EMAIL }),
    ).rejects.toThrow(/same as the current/)
  })

  it('rejects a duplicate pending request for the same member', async () => {
    const t = createTestConvex()
    await seedTenant(t, 'org_a', 'admin_a')

    await requestEmailChange(t)
    await expect(requestEmailChange(t)).rejects.toThrow(/already pending/)
  })

  it('org:coordinator and platform admins cannot file requests', async () => {
    const t = createTestConvex()
    await seedTenant(t, 'org_a', 'admin_a')
    await seedPlatformAdmin(t)

    await expect(
      requestEmailChange(t, { asUser: 'coord_a', asRole: 'org:coordinator' }),
    ).rejects.toThrow(/Forbidden/)

    await expect(
      asPlatformAdmin(t).mutation(api.emailChanges.request, {
        clerkOrgId: 'org_a',
        memberClerkUserId: EMPLOYEE_ID,
        newEmail: 'new@example.com',
        reason: 'x',
      }),
    ).rejects.toThrow(/not a member|Forbidden/)
  })
})

describe('emailChanges.listForTenant', () => {
  it('is org:admin/org:hr only and scoped to its own tenant', async () => {
    const t = createTestConvex()
    await seedTenant(t, 'org_a', 'admin_a')
    await seedTenant(t, 'org_b', 'admin_b')
    await requestEmailChange(t)

    // Coordinator denied.
    await expect(
      asOrgUser(t, 'coord_a', 'org_a', 'org:coordinator').query(
        api.emailChanges.listForTenant,
        { clerkOrgId: 'org_a' },
      ),
    ).rejects.toThrow(/Forbidden/)

    // Admin of tenant A sees the request.
    const mine = await asOrgUser(t, 'admin_a', 'org_a', 'org:admin').query(
      api.emailChanges.listForTenant,
      { clerkOrgId: 'org_a' },
    )
    expect(mine).toHaveLength(1)

    // HR sees it too.
    const hrView = await asOrgUser(t, 'hr_org_a', 'org_a', 'org:hr').query(
      api.emailChanges.listForTenant,
      { clerkOrgId: 'org_a' },
    )
    expect(hrView).toHaveLength(1)

    // Admin of tenant B sees none.
    const theirs = await asOrgUser(t, 'admin_b', 'org_b', 'org:admin').query(
      api.emailChanges.listForTenant,
      { clerkOrgId: 'org_b' },
    )
    expect(theirs).toHaveLength(0)
  })
})

describe('emailChanges.listPending', () => {
  it('lists pending requests with tenant names for platform admins only', async () => {
    const t = createTestConvex()
    await seedTenant(t, 'org_a', 'admin_a')
    await seedPlatformAdmin(t)
    await requestEmailChange(t)

    await expect(
      asOrgUser(t, 'admin_a', 'org_a', 'org:admin').query(
        api.emailChanges.listPending,
        {},
      ),
    ).rejects.toThrow(/platform admin/)

    const pending = await asPlatformAdmin(t).query(
      api.emailChanges.listPending,
      {},
    )
    expect(pending).toHaveLength(1)
    expect(pending[0]).toMatchObject({
      memberName: 'Employee One',
      oldEmail: EMPLOYEE_EMAIL,
      newEmail: 'new@example.com',
      tenantName: 'Agency org_a',
      status: 'pending',
    })
  })
})

describe('emailChanges.execute', () => {
  it('swaps the Clerk emails in order and updates tenant records, audit, and notifications', async () => {
    const fetchMock = stubClerkEmailSwap()
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a', 'admin_a')
    await seedPlatformAdmin(t)
    const requestId = await requestEmailChange(t)
    vi.useFakeTimers()

    const result = await asPlatformAdmin(t).action(api.emailChanges.execute, {
      requestId,
    })
    expect(result).toBe(requestId)
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    // Clerk call order: GET user (capture old id) → POST new email → PATCH
    // primary → DELETE old email.
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][]
    const sequence = calls.map(([url, init]) => {
      const method = init?.method ?? 'GET'
      if (String(url).endsWith('/email_addresses') && method === 'POST')
        return 'POST'
      if (String(url).endsWith('/email_addresses/email_old_id'))
        return 'DELETE'
      if (method === 'PATCH') return 'PATCH'
      return 'GET'
    })
    expect(sequence).toEqual(['GET', 'POST', 'PATCH', 'DELETE'])

    // POST body creates the new email pre-verified.
    const postCall = calls.find(
      ([url, init]) =>
        String(url).endsWith('/email_addresses') && init?.method === 'POST',
    )
    expect(JSON.parse((postCall?.[1]?.body as string) ?? '{}')).toEqual({
      user_id: EMPLOYEE_ID,
      email_address: 'new@example.com',
      verified: true,
    })
    // PATCH body sets the new address primary.
    const patchCall = calls.find(([, init]) => init?.method === 'PATCH')
    expect(JSON.parse((patchCall?.[1]?.body as string) ?? '{}')).toEqual({
      primary_email_address_id: 'email_new_id',
    })

    // Tenant records updated.
    const state = await t.run(async (ctx) => {
      const member = await ctx.db
        .query('tenantMembers')
        .withIndex('by_tenant_user', (q) =>
          q.eq('tenantId', tenantId).eq('clerkUserId', EMPLOYEE_ID),
        )
        .unique()
      const profile = await ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant_clerk_user', (q) =>
          q.eq('tenantId', tenantId).eq('clerkUserId', EMPLOYEE_ID),
        )
        .first()
      return { memberEmail: member?.email, profileEmail: profile?.email }
    })
    expect(state.memberEmail).toBe('new@example.com')
    expect(state.profileEmail).toBe('new@example.com')

    // Request executed.
    const requests = await requestsFor(t, tenantId)
    expect(requests[0]).toMatchObject({
      status: 'executed',
      executedBy: 'plat1',
    })
    expect(requests[0]?.executedAt).toBeTruthy()

    // Tenant-visible audit (metadata references only the new email).
    const changed = (await auditEvents(t, tenantId)).find(
      (e) => e.action === 'member.email_changed',
    )
    expect(changed).toMatchObject({
      category: 'hr',
      kind: 'platform',
      actorRole: 'platform_admin',
    })
    expect(changed?.metadata).toMatchObject({
      memberClerkUserId: EMPLOYEE_ID,
      newEmail: 'new@example.com',
      requestId: requestId as string,
    })

    // Admins notified the change is complete.
    const notify = await notifications(t)
    const done = notify.find(
      (n) => n.clerkUserId === 'admin_a' && n.type === 'member.email_changed',
    )
    expect(done?.message).toContain('Employee One')

    // Pending queue is now empty.
    const pending = await asPlatformAdmin(t).query(
      api.emailChanges.listPending,
      {},
    )
    expect(pending).toHaveLength(0)
  })

  it('throws a user-friendly error when the new email is taken (422) and stays pending', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_clerk')
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        if (url === `https://api.clerk.com/v1/users/${EMPLOYEE_ID}`) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: EMPLOYEE_ID,
                primary_email_address_id: 'email_old_id',
                email_addresses: [
                  { id: 'email_old_id', email_address: EMPLOYEE_EMAIL },
                ],
              }),
              { status: 200 },
            ),
          )
        }
        if (url.endsWith('/email_addresses') && method === 'POST') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                errors: [
                  {
                    message: 'is already taken',
                    long_message: 'Email address is already taken',
                  },
                ],
                status: 422,
              }),
              { status: 422 },
            ),
          )
        }
        return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }))
      },
    )
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a', 'admin_a')
    await seedPlatformAdmin(t)
    const requestId = await requestEmailChange(t)

    await expect(
      asPlatformAdmin(t).action(api.emailChanges.execute, { requestId }),
    ).rejects.toThrow(/cannot be used|already taken/i)

    const requests = await requestsFor(t, tenantId)
    expect(requests[0]?.status).toBe('pending')
  })

  it('tenant admins cannot execute (platform-admin only)', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a', 'admin_a')
    await seedTenant(t, 'org_b', 'admin_b')
    await seedPlatformAdmin(t)
    const requestId = await requestEmailChange(t)

    // Admin of the requesting tenant.
    await expect(
      asOrgUser(t, 'admin_a', 'org_a', 'org:admin').action(
        api.emailChanges.execute,
        { requestId },
      ),
    ).rejects.toThrow(/platform admin/)

    // Admin of a different tenant (cross-tenant denial).
    await expect(
      asOrgUser(t, 'admin_b', 'org_b', 'org:admin').action(
        api.emailChanges.execute,
        { requestId },
      ),
    ).rejects.toThrow(/platform admin/)

    expect((await requestsFor(t, tenantId))[0]?.status).toBe('pending')
  })
})

describe('emailChanges.reject', () => {
  it('rejects a pending request, audits, and notifies the tenant org:admins', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a', 'admin_a')
    await seedPlatformAdmin(t)
    const requestId = await requestEmailChange(t)
    vi.useFakeTimers()
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    await asPlatformAdmin(t).mutation(api.emailChanges.reject, { requestId })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const requests = await requestsFor(t, tenantId)
    expect(requests[0]).toMatchObject({
      status: 'rejected',
      executedBy: 'plat1',
    })

    const rejected = (await auditEvents(t, tenantId)).find(
      (e) => e.action === 'member.email_change_rejected',
    )
    expect(rejected).toMatchObject({ category: 'hr', kind: 'platform' })

    const notify = await notifications(t)
    expect(
      notify.find(
        (n) =>
          n.clerkUserId === 'admin_a' && n.type === 'member.email_change_rejected',
      ),
    ).toBeDefined()

    // Cannot reject twice.
    await expect(
      asPlatformAdmin(t).mutation(api.emailChanges.reject, { requestId }),
    ).rejects.toThrow(/Cannot reject/)
  })

  it('tenant admins cannot reject (platform-admin only)', async () => {
    const t = createTestConvex()
    await seedTenant(t, 'org_a', 'admin_a')
    await seedTenant(t, 'org_b', 'admin_b')
    await seedPlatformAdmin(t)
    const requestId = await requestEmailChange(t)

    await expect(
      asOrgUser(t, 'admin_a', 'org_a', 'org:admin').mutation(
        api.emailChanges.reject,
        { requestId },
      ),
    ).rejects.toThrow(/platform admin/)

    await expect(
      asOrgUser(t, 'admin_b', 'org_b', 'org:admin').mutation(
        api.emailChanges.reject,
        { requestId },
      ),
    ).rejects.toThrow(/platform admin/)
  })
})
