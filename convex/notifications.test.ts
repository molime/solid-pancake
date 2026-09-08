import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

type TestConvex = ReturnType<typeof createTestConvex>

const CLERK_ORG_ID = 'org_notifications_test'

async function seedTenant(
  t: TestConvex,
  members: Array<{
    clerkUserId: string
    role: 'org:admin' | 'org:coordinator' | 'org:caregiver' | 'org:hr'
    email?: string
  }>,
) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: CLERK_ORG_ID,
      name: 'Test Agency',
      slug: 'test-agency',
      createdAt: new Date().toISOString(),
    })
    for (const member of members) {
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: member.clerkUserId,
        role: member.role,
        displayName: member.clerkUserId,
        email: member.email ?? `${member.clerkUserId}@example.com`,
      })
    }
    return tenantId
  })
}

function asUser(t: TestConvex, clerkUserId: string, role: string) {
  return t.withIdentity({
    subject: clerkUserId,
    org_id: CLERK_ORG_ID,
    org_role: role,
  })
}

async function insertNotification(
  t: TestConvex,
  tenantId: Id<'tenants'>,
  clerkUserId: string,
  overrides: { type?: string; message?: string; read?: boolean; createdAt?: string } = {},
) {
  return t.run(async (ctx) => {
    return ctx.db.insert('notifications', {
      tenantId,
      clerkUserId,
      type: overrides.type ?? 'billing_ready',
      message: overrides.message ?? 'Test notification',
      read: overrides.read ?? false,
      createdAt: overrides.createdAt ?? new Date().toISOString(),
    })
  })
}

describe('notifications', () => {
  it('lists only the caller\'s own notifications, newest first', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, [
      { clerkUserId: 'user_a', role: 'org:caregiver' },
      { clerkUserId: 'user_b', role: 'org:caregiver' },
    ])

    await insertNotification(t, tenantId, 'user_a', {
      message: 'older',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    await insertNotification(t, tenantId, 'user_a', {
      message: 'newer',
      createdAt: '2026-01-02T00:00:00.000Z',
    })
    await insertNotification(t, tenantId, 'user_b', { message: 'not yours' })

    const list = await asUser(t, 'user_a', 'org:caregiver').query(
      api.notifications.list,
      { clerkOrgId: CLERK_ORG_ID },
    )

    expect(list.map((n) => n.message)).toEqual(['newer', 'older'])
  })

  it('markRead sets read on the caller\'s own row', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, [
      { clerkUserId: 'user_a', role: 'org:caregiver' },
    ])
    const notificationId = await insertNotification(t, tenantId, 'user_a')

    await asUser(t, 'user_a', 'org:caregiver').mutation(
      api.notifications.markRead,
      { notificationId },
    )

    const row = await t.run(async (ctx) => ctx.db.get(notificationId))
    expect(row?.read).toBe(true)
  })

  it('markRead rejects another user\'s notification in the same tenant', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, [
      { clerkUserId: 'user_a', role: 'org:caregiver' },
      { clerkUserId: 'user_b', role: 'org:caregiver' },
    ])
    const notificationId = await insertNotification(t, tenantId, 'user_a')

    await expect(
      asUser(t, 'user_b', 'org:caregiver').mutation(
        api.notifications.markRead,
        { notificationId },
      ),
    ).rejects.toThrow('another user')

    const row = await t.run(async (ctx) => ctx.db.get(notificationId))
    expect(row?.read).toBe(false)
  })

  it('markRead rejects a notification from another tenant', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, [
      { clerkUserId: 'user_a', role: 'org:caregiver' },
    ])
    const notificationId = await insertNotification(t, tenantId, 'user_a')

    // user_b belongs only to a different tenant.
    await t.run(async (ctx) => {
      const otherTenantId = await ctx.db.insert('tenants', {
        clerkOrgId: 'org_other',
        name: 'Other Agency',
        slug: 'other-agency',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('tenantMembers', {
        tenantId: otherTenantId,
        clerkUserId: 'user_b',
        role: 'org:caregiver',
        displayName: 'user_b',
        email: 'user_b@example.com',
      })
    })

    await expect(
      t
        .withIdentity({
          subject: 'user_b',
          org_id: 'org_other',
          org_role: 'org:caregiver',
        })
        .mutation(api.notifications.markRead, { notificationId }),
    ).rejects.toThrow()

    const row = await t.run(async (ctx) => ctx.db.get(notificationId))
    expect(row?.read).toBe(false)
  })

  it('unreadCount counts only the caller\'s unread rows', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, [
      { clerkUserId: 'user_a', role: 'org:caregiver' },
      { clerkUserId: 'user_b', role: 'org:caregiver' },
    ])

    await insertNotification(t, tenantId, 'user_a')
    await insertNotification(t, tenantId, 'user_a')
    await insertNotification(t, tenantId, 'user_a', { read: true })
    await insertNotification(t, tenantId, 'user_b')

    const count = await asUser(t, 'user_a', 'org:caregiver').query(
      api.notifications.unreadCount,
      { clerkOrgId: CLERK_ORG_ID },
    )
    expect(count).toBe(2)
  })

  it('markAllRead marks only the caller\'s unread rows', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, [
      { clerkUserId: 'user_a', role: 'org:caregiver' },
      { clerkUserId: 'user_b', role: 'org:caregiver' },
    ])

    await insertNotification(t, tenantId, 'user_a')
    await insertNotification(t, tenantId, 'user_a')
    await insertNotification(t, tenantId, 'user_b')

    const result = await asUser(t, 'user_a', 'org:caregiver').mutation(
      api.notifications.markAllRead,
      { clerkOrgId: CLERK_ORG_ID },
    )
    expect(result.marked).toBe(2)

    expect(
      await asUser(t, 'user_a', 'org:caregiver').query(
        api.notifications.unreadCount,
        { clerkOrgId: CLERK_ORG_ID },
      ),
    ).toBe(0)
    expect(
      await asUser(t, 'user_b', 'org:caregiver').query(
        api.notifications.unreadCount,
        { clerkOrgId: CLERK_ORG_ID },
      ),
    ).toBe(1)
  })

  it('sendStaffNotification always inserts a row even when no email resolves', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, [
      { clerkUserId: 'user_a', role: 'org:caregiver' },
    ])

    await t.action(internal._utils.notifications.sendStaffNotification, {
      tenantId,
      clerkUserId: 'user_ghost',
      type: 'escalation',
      message: 'Escalated',
    })

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query('notifications')
        .withIndex('by_tenant_user', (q) =>
          q.eq('tenantId', tenantId).eq('clerkUserId', 'user_ghost'),
        )
        .collect(),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.read).toBe(false)
    expect(rows[0]?.type).toBe('escalation')
  })
})

describe('reporting.listNotifications', () => {
  it('falls back to derived audit/review rows when the table is empty', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, [
      { clerkUserId: 'user_admin', role: 'org:admin' },
    ])

    await t.run(async (ctx) => {
      await ctx.db.insert('auditEvents', {
        tenantId,
        actorId: 'user_admin',
        actorRole: 'org:admin',
        action: 'shift_approved',
        createdAt: '2026-01-01T00:00:00.000Z',
      })
    })

    const list = await asUser(t, 'user_admin', 'org:admin').query(
      api.reporting.listNotifications,
      { clerkOrgId: CLERK_ORG_ID },
    )

    expect(list.length).toBeGreaterThan(0)
    expect(list[0]?.type).toBe('audit')
    expect(list[0]?.id).toMatch(/^audit:/)
    expect(list[0]?.message).toBe('Shift approved')
  })

  it('returns table rows when the notifications table has data', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, [
      { clerkUserId: 'user_admin', role: 'org:admin' },
    ])

    await t.run(async (ctx) => {
      await ctx.db.insert('auditEvents', {
        tenantId,
        actorId: 'user_admin',
        actorRole: 'org:admin',
        action: 'shift_approved',
        createdAt: '2026-01-01T00:00:00.000Z',
      })
    })
    await insertNotification(t, tenantId, 'user_admin', {
      type: 'billing_ready',
      message: 'Shift for Jane is ready to bill.',
      read: true,
    })

    const list = await asUser(t, 'user_admin', 'org:admin').query(
      api.reporting.listNotifications,
      { clerkOrgId: CLERK_ORG_ID },
    )

    expect(list).toHaveLength(1)
    expect(list[0]?.type).toBe('billing_ready')
    expect(list[0]?.message).toBe('Shift for Jane is ready to bill.')
    expect(list[0]?.read).toBe(true)
  })
})

describe('reporting.exportReport', () => {
  async function seedBillingData(t: TestConvex) {
    const tenantId = await seedTenant(t, [
      { clerkUserId: 'user_admin', role: 'org:admin' },
      { clerkUserId: 'user_cg', role: 'org:caregiver' },
    ])

    return t.run(async (ctx) => {
      const clientId = await ctx.db.insert('clients', {
        tenantId,
        displayName: 'Test Client',
        serviceType: 'SLS',
        authorizationHours: 100,
        riskFlags: [],
      })

      const shiftInRange = await ctx.db.insert('shifts', {
        tenantId,
        clientId,
        caregiverId: 'user_cg',
        scheduledStart: '2026-01-10T08:00:00.000Z',
        scheduledEnd: '2026-01-10T16:00:00.000Z',
        status: 'billing_ready',
        serviceType: 'SLS',
        rate: 25,
      })
      const shiftOutOfRange = await ctx.db.insert('shifts', {
        tenantId,
        clientId,
        caregiverId: 'user_cg',
        scheduledStart: '2026-03-01T08:00:00.000Z',
        scheduledEnd: '2026-03-01T16:00:00.000Z',
        status: 'approved',
        serviceType: 'SLS',
        rate: 25,
      })

      const batchId = await ctx.db.insert('exportBatches', {
        tenantId,
        name: 'Batch 1',
        exportedAt: '2026-01-15T00:00:00.000Z',
        exportedBy: 'user_admin',
        invoiceNumber: 'ATRIA-20260115-ABCDEF',
      })

      await ctx.db.insert('billingLines', {
        tenantId,
        shiftId: shiftInRange,
        hours: 8,
        rate: 25,
        amount: 200,
        exportBatchId: batchId,
        createdAt: '2026-01-15T00:00:00.000Z',
      })
      await ctx.db.insert('billingLines', {
        tenantId,
        shiftId: shiftOutOfRange,
        hours: 8,
        rate: 25,
        amount: 200,
        createdAt: '2026-03-02T00:00:00.000Z',
      })

      return { tenantId, clientId, shiftInRange }
    })
  }

  it('returns agency CSV with header and in-range rows only', async () => {
    const t = createTestConvex()
    await seedBillingData(t)

    const csv = await asUser(t, 'user_admin', 'org:admin').mutation(
      api.reporting.exportReport,
      {
        clerkOrgId: CLERK_ORG_ID,
        reportType: 'agency',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      },
    )

    const lines = csv.split('\n')
    expect(lines[0]).toBe('date,client,caregiver,serviceType,status,rate')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('2026-01-10')
    expect(lines[1]).toContain('Test Client')
    expect(csv).not.toContain('2026-03-01')
  })

  it('returns billing CSV with invoice number and date filtering', async () => {
    const t = createTestConvex()
    await seedBillingData(t)

    const csv = await asUser(t, 'user_admin', 'org:admin').mutation(
      api.reporting.exportReport,
      {
        clerkOrgId: CLERK_ORG_ID,
        reportType: 'billing',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      },
    )

    const lines = csv.split('\n')
    expect(lines[0]).toBe(
      'date,invoiceNumber,caregiverId,hours,rate,amount,blockedReason',
    )
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('ATRIA-20260115-ABCDEF')
    expect(lines[1]).toContain('200')
    expect(csv).not.toContain('2026-03-02')
  })

  it('returns compliance CSV with document rows', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, [
      { clerkUserId: 'user_admin', role: 'org:admin' },
    ])

    await t.run(async (ctx) => {
      const fileId = await ctx.db.insert('files', {
        tenantId,
        storageId: 'storage-1',
        uploadedBy: 'user_admin',
        fileName: 'license.pdf',
        linkedType: 'complianceDoc',
        linkedId: 'doc-1',
        visibility: 'admins_coordinators',
        createdAt: '2026-01-01T00:00:00.000Z',
      })
      await ctx.db.insert('documentArchiveItems', {
        tenantId,
        fileId,
        subjectType: 'employee',
        subjectId: 'user_cg',
        category: 'Driver License',
        status: 'verified',
        expiresAt: '2026-06-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
      })
    })

    const csv = await asUser(t, 'user_admin', 'org:admin').mutation(
      api.reporting.exportReport,
      {
        clerkOrgId: CLERK_ORG_ID,
        reportType: 'compliance',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    )

    const lines = csv.split('\n')
    expect(lines[0]).toBe(
      'subjectId,category,status,expiresAt,computedStatus,overrideStatus,overrideReason',
    )
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('Driver License')
    expect(lines[1]).toContain('verified')
  })

  it('rejects callers without a reporting role', async () => {
    const t = createTestConvex()
    await seedTenant(t, [{ clerkUserId: 'user_cg', role: 'org:caregiver' }])

    await expect(
      asUser(t, 'user_cg', 'org:caregiver').mutation(
        api.reporting.exportReport,
        {
          clerkOrgId: CLERK_ORG_ID,
          reportType: 'agency',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        },
      ),
    ).rejects.toThrow('required one of')
  })
})

describe('escalations', () => {
  it('checkEscalations escalates aged open HR cases with dedup', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, [
      { clerkUserId: 'user_admin', role: 'org:admin' },
    ])

    const aged = (days: number) =>
      new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    await t.run(async (ctx) => {
      await ctx.db.insert('hrCases', {
        tenantId,
        caseNumber: 'HR-2026-001',
        subjectType: 'employee',
        subjectId: 'user_cg',
        category: 'credentialing',
        title: 'Old case',
        status: 'open',
        createdAt: aged(10),
      })
      await ctx.db.insert('hrCases', {
        tenantId,
        caseNumber: 'HR-2026-002',
        subjectType: 'employee',
        subjectId: 'user_cg',
        category: 'credentialing',
        title: 'Fresh case',
        status: 'open',
        createdAt: aged(2),
      })
    })

    await t.mutation(internal.escalations.checkEscalations, {})

    let escalations = await asUser(t, 'user_admin', 'org:admin').query(
      api.escalations.listEscalations,
      { clerkOrgId: CLERK_ORG_ID },
    )
    expect(escalations).toHaveLength(1)
    expect(escalations[0]?.escalationLevel).toBe(1)
    expect(escalations[0]?.escalatedTo).toBe('org:coordinator')

    // Second run must not duplicate the unresolved escalation.
    await t.mutation(internal.escalations.checkEscalations, {})
    escalations = await asUser(t, 'user_admin', 'org:admin').query(
      api.escalations.listEscalations,
      { clerkOrgId: CLERK_ORG_ID },
    )
    expect(escalations).toHaveLength(1)
  })

  it('resolveEscalation marks resolved and enforces tenant scoping', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, [
      { clerkUserId: 'user_admin', role: 'org:admin' },
    ])

    const escalationId = await t.run(async (ctx) =>
      ctx.db.insert('escalations', {
        tenantId,
        subjectType: 'hrCase',
        subjectId: 'case-1',
        escalationLevel: 2,
        escalatedTo: 'org:admin',
        reason: 'test',
        createdAt: new Date().toISOString(),
      }),
    )

    await asUser(t, 'user_admin', 'org:admin').mutation(
      api.escalations.resolveEscalation,
      { clerkOrgId: CLERK_ORG_ID, escalationId },
    )

    const resolved = await t.run(async (ctx) => ctx.db.get(escalationId))
    expect(resolved?.resolvedAt).toBeDefined()

    const active = await asUser(t, 'user_admin', 'org:admin').query(
      api.escalations.listEscalations,
      { clerkOrgId: CLERK_ORG_ID },
    )
    expect(active).toHaveLength(0)
  })
})
