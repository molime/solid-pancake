import { describe, expect, it, afterEach, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

type TestConvex = ReturnType<typeof createTestConvex>

afterEach(() => {
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

async function seedTenant(
  t: TestConvex,
  clerkOrgId: string,
  adminId: string,
) {
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

async function requestGrant(
  t: TestConvex,
  tenantId: Id<'tenants'>,
  overrides: { reason?: string; durationMinutes?: number } = {},
) {
  return asPlatformAdmin(t).mutation(api.platform.requestSupportAccess, {
    tenantId,
    reason: overrides.reason ?? 'Investigate billing issue',
    durationMinutes: overrides.durationMinutes ?? 60,
  })
}

async function grantsFor(t: TestConvex, tenantId: Id<'tenants'>) {
  return t.run(async (ctx) =>
    ctx.db
      .query('supportAccessGrants')
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

describe('supportAccess lifecycle', () => {
  it('platform admin request creates a pending grant, audits, and notifies tenant org:admins', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a', 'admin_a')
    await seedPlatformAdmin(t)
    vi.useFakeTimers()

    const grantId = await requestGrant(t, tenantId, {
      reason: 'Investigate billing issue',
      durationMinutes: 90,
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const grants = await grantsFor(t, tenantId)
    expect(grants).toHaveLength(1)
    expect(grants[0]).toMatchObject({ _id: grantId, status: 'pending' })

    const events = await auditEvents(t, tenantId)
    const requested = events.find((e) => e.action === 'support_access_requested')
    expect(requested).toMatchObject({
      category: 'access',
      kind: 'platform',
      actorRole: 'platform_admin',
    })

    const notify = await notifications(t)
    const adminNotice = notify.find(
      (n) =>
        n.clerkUserId === 'admin_a' && n.type === 'support_access_requested',
    )
    expect(adminNotice).toBeDefined()
    expect(adminNotice?.message).toContain('Investigate billing issue')
    expect(adminNotice?.message).toContain('90 minutes')
  })

  it('non-platform-admin cannot request support access', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a', 'admin_a')

    await expect(
      asOrgUser(t, 'admin_a', 'org_a', 'org:admin').mutation(
        api.platform.requestSupportAccess,
        { tenantId, reason: 'x', durationMinutes: 30 },
      ),
    ).rejects.toThrow(/platform admin/)
  })

  it('org:admin approves a pending grant (activates immediately) and the requester is notified', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a', 'admin_a')
    await seedPlatformAdmin(t)
    vi.useFakeTimers()
    const grantId = await requestGrant(t, tenantId)
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    await asOrgUser(t, 'admin_a', 'org_a', 'org:admin').mutation(
      api.supportAccess.approve,
      { clerkOrgId: 'org_a', grantId },
    )
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const grants = await grantsFor(t, tenantId)
    expect(grants[0]?.status).toBe('active')

    const events = await auditEvents(t, tenantId)
    expect(
      events.find((e) => e.action === 'support_access_approved'),
    ).toMatchObject({ category: 'access', kind: 'tenant' })

    const notify = await notifications(t)
    expect(
      notify.find(
        (n) => n.clerkUserId === 'plat1' && n.type === 'support_access_approved',
      ),
    ).toBeDefined()
  })

  it('platform admin CANNOT approve, and a foreign tenant admin CANNOT approve', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a', 'admin_a')
    await seedTenant(t, 'org_b', 'admin_b')
    await seedPlatformAdmin(t)
    const grantId = await requestGrant(t, tenantId)

    // Platform admin has no tenant membership — requireTenantRole rejects.
    await expect(
      asPlatformAdmin(t).mutation(api.supportAccess.approve, {
        clerkOrgId: 'org_a',
        grantId,
      }),
    ).rejects.toThrow(/Forbidden|not a member/)

    // Admin of tenant B is a member of tenant B but the grant belongs to
    // tenant A — assertTenantDoc rejects the cross-tenant access.
    await expect(
      asOrgUser(t, 'admin_b', 'org_b', 'org:admin').mutation(
        api.supportAccess.approve,
        { clerkOrgId: 'org_b', grantId },
      ),
    ).rejects.toThrow(/cross-tenant/)
  })

  it('org:admin rejects a pending grant and the requester is notified', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a', 'admin_a')
    await seedPlatformAdmin(t)
    vi.useFakeTimers()
    const grantId = await requestGrant(t, tenantId)
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    await asOrgUser(t, 'admin_a', 'org_a', 'org:admin').mutation(
      api.supportAccess.reject,
      { clerkOrgId: 'org_a', grantId },
    )
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const grants = await grantsFor(t, tenantId)
    expect(grants[0]?.status).toBe('rejected')
    expect(
      (await auditEvents(t, tenantId)).find(
        (e) => e.action === 'support_access_rejected',
      ),
    ).toBeDefined()
    const notify = await notifications(t)
    expect(
      notify.find(
        (n) => n.clerkUserId === 'plat1' && n.type === 'support_access_rejected',
      ),
    ).toBeDefined()
  })

  it('cannot approve or reject a grant twice', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a', 'admin_a')
    await seedPlatformAdmin(t)
    const grantId = await requestGrant(t, tenantId)
    const admin = asOrgUser(t, 'admin_a', 'org_a', 'org:admin')

    await admin.mutation(api.supportAccess.approve, {
      clerkOrgId: 'org_a',
      grantId,
    })
    await expect(
      admin.mutation(api.supportAccess.approve, {
        clerkOrgId: 'org_a',
        grantId,
      }),
    ).rejects.toThrow(/Cannot approve/)
  })

  it('platform admin ends the active grant via the stable platform api path', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a', 'admin_a')
    await seedPlatformAdmin(t)
    await requestGrant(t, tenantId)
    // Approve by finding the pending grant first.
    const pending = (await grantsFor(t, tenantId))[0]
    await asOrgUser(t, 'admin_a', 'org_a', 'org:admin').mutation(
      api.supportAccess.approve,
      { clerkOrgId: 'org_a', grantId: pending!._id },
    )

    await asPlatformAdmin(t).mutation(api.platform.endSupportAccess, {
      tenantId,
    })

    const grants = await grantsFor(t, tenantId)
    expect(grants[0]?.status).toBe('ended')
    expect(grants[0]?.endedAt).toBeTruthy()
    expect(
      (await auditEvents(t, tenantId)).find(
        (e) => e.action === 'support_access_ended',
      ),
    ).toBeDefined()
  })

  it('endSupportAccess throws when there is no active grant', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a', 'admin_a')
    await seedPlatformAdmin(t)

    await expect(
      asPlatformAdmin(t).mutation(api.platform.endSupportAccess, { tenantId }),
    ).rejects.toThrow(/No active support access grant/)
  })

  it('expireDueGrants flips overdue grants and audits; fresh grants survive', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a', 'admin_a')
    await seedPlatformAdmin(t)
    const overdueId = await requestGrant(t, tenantId, { durationMinutes: 60 })
    const freshId = await requestGrant(t, tenantId, { durationMinutes: 120 })

    // Simulate approval moments: overdue grant started 2h ago, fresh 5 min ago.
    const now = Date.now()
    await t.run(async (ctx) => {
      await ctx.db.patch(overdueId, {
        status: 'active',
        startedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      })
      await ctx.db.patch(freshId, {
        status: 'active',
        startedAt: new Date(now - 5 * 60 * 1000).toISOString(),
      })
    })

    const expired = await t.mutation(internal.supportAccess.expireDueGrants, {})
    expect(expired).toBe(1)

    const grants = await grantsFor(t, tenantId)
    const overdue = grants.find((g) => g._id === overdueId)
    const fresh = grants.find((g) => g._id === freshId)
    expect(overdue?.status).toBe('expired')
    expect(fresh?.status).toBe('active')

    const events = await auditEvents(t, tenantId)
    expect(
      events.find((e) => e.action === 'support_access_expired'),
    ).toBeDefined()
  })

  it('listForTenant is org:admin only and scoped to its tenant', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a', 'admin_a')
    await seedTenant(t, 'org_b', 'admin_b')
    await seedPlatformAdmin(t)
    await requestGrant(t, tenantId)

    // HR cannot list grants.
    await expect(
      asOrgUser(t, 'hr_org_a', 'org_a', 'org:hr').query(
        api.supportAccess.listForTenant,
        { clerkOrgId: 'org_a' },
      ),
    ).rejects.toThrow(/Forbidden/)

    // Admin of tenant A sees their own grant.
    const mine = await asOrgUser(t, 'admin_a', 'org_a', 'org:admin').query(
      api.supportAccess.listForTenant,
      { clerkOrgId: 'org_a' },
    )
    expect(mine).toHaveLength(1)

    // Admin of tenant B sees none (tenant-scoped index, not a member of A).
    const theirs = await asOrgUser(t, 'admin_b', 'org_b', 'org:admin').query(
      api.supportAccess.listForTenant,
      { clerkOrgId: 'org_b' },
    )
    expect(theirs).toHaveLength(0)
  })

  it('listPendingForTenant returns only pending grants', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a', 'admin_a')
    await seedPlatformAdmin(t)
    const first = await requestGrant(t, tenantId)
    await requestGrant(t, tenantId)
    await asOrgUser(t, 'admin_a', 'org_a', 'org:admin').mutation(
      api.supportAccess.approve,
      { clerkOrgId: 'org_a', grantId: first },
    )

    const pending = await asOrgUser(t, 'admin_a', 'org_a', 'org:admin').query(
      api.supportAccess.listPendingForTenant,
      { clerkOrgId: 'org_a' },
    )
    expect(pending).toHaveLength(1)
    expect(pending[0]?.status).toBe('pending')
  })
})
