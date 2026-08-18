import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

function asAdmin(
  t: ReturnType<typeof createTestConvex>,
  adminId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: adminId,
    org_id: clerkOrgId,
    org_role: 'org:admin',
  })
}

function asCaregiver(
  t: ReturnType<typeof createTestConvex>,
  caregiverId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: caregiverId,
    org_id: clerkOrgId,
    org_role: 'org:caregiver',
  })
}

async function seedTenant(
  t: ReturnType<typeof createTestConvex>,
  clerkOrgId: string,
  adminId: string,
) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId,
      name: 'Test Agency',
      slug: 'test-agency',
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: adminId,
      role: 'org:admin',
      displayName: 'Admin',
      email: 'admin@example.com',
    })
    return tenantId
  })
}

async function seedCaregiver(
  t: ReturnType<typeof createTestConvex>,
  clerkOrgId: string,
  caregiverId: string,
) {
  return t.run(async (ctx) => {
    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
      .unique()
    if (!tenant) throw new Error('Tenant not found.')
    await ctx.db.insert('tenantMembers', {
      tenantId: tenant._id,
      clerkUserId: caregiverId,
      role: 'org:caregiver',
      displayName: 'Caregiver',
      email: 'caregiver@example.com',
    })
  })
}

async function seedArchiveItem(
  t: ReturnType<typeof createTestConvex>,
  clerkOrgId: string,
  overrides: {
    subjectType?: string
    subjectId?: string
    category?: string
    status?: string
    expiresAt?: string
    fileName?: string
    createdAt?: string
  } = {},
) {
  return t.run(async (ctx) => {
    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
      .unique()
    if (!tenant) throw new Error('Tenant not found.')
    const fileId = await ctx.db.insert('files', {
      tenantId: tenant._id,
      storageId: 'storage-test',
      uploadedBy: 'user_test',
      fileName: overrides.fileName ?? 'doc.pdf',
      contentType: 'application/pdf',
      size: 2048,
      linkedType: 'shiftTask',
      linkedId: 'task-test',
      visibility: 'all_staff',
      createdAt: overrides.createdAt ?? new Date().toISOString(),
    })
    const itemId = await ctx.db.insert('documentArchiveItems', {
      tenantId: tenant._id,
      fileId,
      subjectType: overrides.subjectType ?? 'candidate',
      subjectId: overrides.subjectId ?? 'candidate-test',
      category: overrides.category ?? 'license',
      status: overrides.status ?? 'active',
      expiresAt: overrides.expiresAt,
      source: 'test',
      createdAt: overrides.createdAt ?? new Date().toISOString(),
    })
    return { tenantId: tenant._id, fileId, itemId }
  })
}

beforeEach(() => {
  // noop
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('listDocumentArchive', () => {
  it('returns archive items joined with file metadata', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_archive_list'
    const adminId = 'user_admin_archive_list'
    await seedTenant(t, clerkOrgId, adminId)
    const { itemId } = await seedArchiveItem(t, clerkOrgId, {
      fileName: 'license.pdf',
    })

    const items = await asAdmin(t, adminId, clerkOrgId).query(
      api.documentArchive.listDocumentArchive,
      { clerkOrgId },
    )

    expect(items).toHaveLength(1)
    expect(items[0]?._id).toBe(itemId)
    expect(items[0]?.file?.fileName).toBe('license.pdf')
    expect(items[0]?.file?.contentType).toBe('application/pdf')
    expect(items[0]?.file?.size).toBe(2048)
  })

  it('filters by linkedTo, status, and documentType', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_archive_filter'
    const adminId = 'user_admin_archive_filter'
    await seedTenant(t, clerkOrgId, adminId)
    await seedArchiveItem(t, clerkOrgId, {
      subjectType: 'candidate',
      subjectId: 'candidate-a',
      category: 'license',
      status: 'active',
    })
    await seedArchiveItem(t, clerkOrgId, {
      subjectType: 'caregiver',
      subjectId: 'caregiver-b',
      category: 'certification',
      status: 'verified',
    })

    const byLinkedTo = await asAdmin(t, adminId, clerkOrgId).query(
      api.documentArchive.listDocumentArchive,
      {
        clerkOrgId,
        linkedTo: { subjectType: 'candidate', subjectId: 'candidate-a' },
      },
    )
    expect(byLinkedTo).toHaveLength(1)
    expect(byLinkedTo[0]?.subjectId).toBe('candidate-a')

    const byStatus = await asAdmin(t, adminId, clerkOrgId).query(
      api.documentArchive.listDocumentArchive,
      { clerkOrgId, status: 'verified' },
    )
    expect(byStatus).toHaveLength(1)
    expect(byStatus[0]?.status).toBe('verified')

    const byType = await asAdmin(t, adminId, clerkOrgId).query(
      api.documentArchive.listDocumentArchive,
      { clerkOrgId, documentType: 'license' },
    )
    expect(byType).toHaveLength(1)
    expect(byType[0]?.category).toBe('license')
  })

  it('expiringSoonDays filter includes only items with expiresAt <= cutoff', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_archive_expiring'
    const adminId = 'user_admin_archive_expiring'
    await seedTenant(t, clerkOrgId, adminId)

    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    const later = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const { itemId: soonId } = await seedArchiveItem(t, clerkOrgId, {
      expiresAt: soon,
      createdAt: new Date().toISOString(),
    })
    await seedArchiveItem(t, clerkOrgId, {
      expiresAt: later,
      createdAt: new Date(Date.now() - 1000).toISOString(),
    })
    await seedArchiveItem(t, clerkOrgId, {
      createdAt: new Date(Date.now() - 2000).toISOString(),
    })

    const items = await asAdmin(t, adminId, clerkOrgId).query(
      api.documentArchive.listDocumentArchive,
      { clerkOrgId, expiringSoonDays: 7 },
    )

    expect(items).toHaveLength(1)
    expect(items[0]?._id).toBe(soonId)
  })

  it('is blocked for org:caregiver', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_archive_block'
    const adminId = 'user_admin_archive_block'
    const caregiverId = 'user_cg_archive_block'
    await seedTenant(t, clerkOrgId, adminId)
    await seedCaregiver(t, clerkOrgId, caregiverId)

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).query(
        api.documentArchive.listDocumentArchive,
        { clerkOrgId },
      ),
    ).rejects.toThrow()
  })
})

describe('updateDocumentArchiveItem', () => {
  it('sets verifiedBy and verifiedAt for verified', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_archive_verify'
    const adminId = 'user_admin_archive_verify'
    await seedTenant(t, clerkOrgId, adminId)
    const { itemId } = await seedArchiveItem(t, clerkOrgId)

    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.documentArchive.updateDocumentArchiveItem,
      {
        clerkOrgId,
        itemId,
        status: 'verified',
      },
    )

    const item = await t.run(async (ctx) =>
      ctx.db.get(itemId as Id<'documentArchiveItems'>),
    )
    expect(item?.status).toBe('verified')
    expect(item?.verifiedBy).toBe(adminId)
    expect(item?.verifiedAt).toBeDefined()
    expect(item?.rejectionReason).toBeUndefined()
  })

  it('sets rejectionReason for rejected and requires it', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_archive_reject'
    const adminId = 'user_admin_archive_reject'
    await seedTenant(t, clerkOrgId, adminId)
    const { itemId } = await seedArchiveItem(t, clerkOrgId)

    await expect(
      asAdmin(t, adminId, clerkOrgId).mutation(
        api.documentArchive.updateDocumentArchiveItem,
        {
          clerkOrgId,
          itemId,
          status: 'rejected',
        },
      ),
    ).rejects.toThrow('Rejection reason is required when rejecting a document.')

    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.documentArchive.updateDocumentArchiveItem,
      {
        clerkOrgId,
        itemId,
        status: 'rejected',
        rejectionReason: 'Blurry scan',
      },
    )

    const item = await t.run(async (ctx) =>
      ctx.db.get(itemId as Id<'documentArchiveItems'>),
    )
    expect(item?.status).toBe('rejected')
    expect(item?.rejectionReason).toBe('Blurry scan')
    expect(item?.verifiedBy).toBeUndefined()
    expect(item?.verifiedAt).toBeUndefined()
  })

  it('writes a document.status_updated audit event', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_archive_audit'
    const adminId = 'user_admin_archive_audit'
    await seedTenant(t, clerkOrgId, adminId)
    const { itemId } = await seedArchiveItem(t, clerkOrgId)

    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.documentArchive.updateDocumentArchiveItem,
      {
        clerkOrgId,
        itemId,
        status: 'verified',
      },
    )

    const events = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      return ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) =>
          q.eq('tenantId', tenant?._id as Id<'tenants'>),
        )
        .collect()
    })

    const event = events.find((e) => e.action === 'document.status_updated')
    expect(event).toBeDefined()
    expect(event?.previousStatus).toBe('active')
    expect(event?.nextStatus).toBe('verified')
    expect(event?.metadata?.itemId).toBe(itemId as string)
  })

  it('is blocked for org:caregiver', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_archive_update_block'
    const adminId = 'user_admin_archive_update_block'
    const caregiverId = 'user_cg_archive_update_block'
    await seedTenant(t, clerkOrgId, adminId)
    await seedCaregiver(t, clerkOrgId, caregiverId)
    const { itemId } = await seedArchiveItem(t, clerkOrgId)

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).mutation(
        api.documentArchive.updateDocumentArchiveItem,
        {
          clerkOrgId,
          itemId,
          status: 'verified',
        },
      ),
    ).rejects.toThrow()
  })
})

describe('computeRetentionUntil', () => {
  it('adds five calendar years to the creation timestamp', async () => {
    const { computeRetentionUntil } = await import('./documentArchive')
    expect(computeRetentionUntil('2026-08-18T00:00:00.000Z')).toBe(
      '2031-08-18T00:00:00.000Z',
    )
  })
})

describe('setLegalHold', () => {
  it('sets and clears legalHold on an archive item and writes an audit event', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_hold_set'
    const adminId = 'user_admin_hold_set'
    await seedTenant(t, clerkOrgId, adminId)
    const { itemId } = await seedArchiveItem(t, clerkOrgId)

    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.documentArchive.setLegalHold,
      {
        clerkOrgId,
        table: 'documentArchiveItems',
        recordId: itemId as string,
        legalHold: true,
      },
    )

    const item = await t.run(async (ctx) =>
      ctx.db.get(itemId as Id<'documentArchiveItems'>),
    )
    expect(item?.legalHold).toBe(true)

    const events = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      return ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) =>
          q.eq('tenantId', tenant?._id as Id<'tenants'>),
        )
        .collect()
    })
    const event = events.find((e) => e.action === 'legal_hold_updated')
    expect(event).toBeDefined()
    expect(event?.metadata?.table).toBe('documentArchiveItems')
    expect(event?.metadata?.recordId).toBe(itemId as string)
    expect(event?.metadata?.legalHold).toBe(true)

    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.documentArchive.setLegalHold,
      {
        clerkOrgId,
        table: 'documentArchiveItems',
        recordId: itemId as string,
        legalHold: false,
      },
    )
    const cleared = await t.run(async (ctx) =>
      ctx.db.get(itemId as Id<'documentArchiveItems'>),
    )
    expect(cleared?.legalHold).toBe(false)
  })

  it('supports specialIncidents and progressReports records', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_hold_tables'
    const adminId = 'user_admin_hold_tables'
    await seedTenant(t, clerkOrgId, adminId)

    const { incidentId, reportId } = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      const tenantId = tenant?._id as Id<'tenants'>
      const clientId = await ctx.db.insert('clients', {
        tenantId,
        displayName: 'Client One',
        serviceType: 'SLS',
        authorizationHours: 20,
        riskFlags: [],
      })
      const incidentId = await ctx.db.insert('specialIncidents', {
        tenantId,
        clientId,
        category: 'medication_error',
        occurredAt: new Date().toISOString(),
        learnedAt: new Date().toISOString(),
        location: 'Client home',
        description: 'Missed dose',
        actionsTaken: 'Notified nurse',
        agenciesNotified: [],
        status: 'draft',
        createdBy: adminId,
        createdAt: new Date().toISOString(),
      })
      const reportId = await ctx.db.insert('progressReports', {
        tenantId,
        clientId,
        periodType: 'quarterly',
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        entries: [],
        status: 'draft',
        generatedBy: adminId,
        createdAt: new Date().toISOString(),
      })
      return { incidentId, reportId }
    })

    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.documentArchive.setLegalHold,
      {
        clerkOrgId,
        table: 'specialIncidents',
        recordId: incidentId as string,
        legalHold: true,
      },
    )
    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.documentArchive.setLegalHold,
      {
        clerkOrgId,
        table: 'progressReports',
        recordId: reportId as string,
        legalHold: true,
      },
    )

    const { incident, report } = await t.run(async (ctx) => ({
      incident: await ctx.db.get(incidentId),
      report: await ctx.db.get(reportId),
    }))
    expect(incident?.legalHold).toBe(true)
    expect(report?.legalHold).toBe(true)
  })

  it('is blocked for org:hr (admin only)', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_hold_hr_block'
    const adminId = 'user_admin_hold_hr_block'
    const hrId = 'user_hr_hold_hr_block'
    await seedTenant(t, clerkOrgId, adminId)
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant?._id as Id<'tenants'>,
        clerkUserId: hrId,
        role: 'org:hr',
        displayName: 'HR',
        email: 'hr@example.com',
      })
    })
    const { itemId } = await seedArchiveItem(t, clerkOrgId)

    await expect(
      t
        .withIdentity({ subject: hrId, org_id: clerkOrgId, org_role: 'org:hr' })
        .mutation(api.documentArchive.setLegalHold, {
          clerkOrgId,
          table: 'documentArchiveItems',
          recordId: itemId as string,
          legalHold: true,
        }),
    ).rejects.toThrow()
  })

  it('rejects records from another tenant', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_hold_tenant_a'
    const otherOrgId = 'org_hold_tenant_b'
    const adminId = 'user_admin_hold_tenant'
    await seedTenant(t, clerkOrgId, adminId)
    const { itemId } = await seedArchiveItem(t, clerkOrgId)

    // The same admin user is also an admin of a second tenant.
    await t.run(async (ctx) => {
      const otherTenantId = await ctx.db.insert('tenants', {
        clerkOrgId: otherOrgId,
        name: 'Other Agency',
        slug: 'other-agency',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('tenantMembers', {
        tenantId: otherTenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })
    })

    await expect(
      asAdmin(t, adminId, otherOrgId).mutation(
        api.documentArchive.setLegalHold,
        {
          clerkOrgId: otherOrgId,
          table: 'documentArchiveItems',
          recordId: itemId as string,
          legalHold: true,
        },
      ),
    ).rejects.toThrow()
  })
})

describe('getRetentionReport', () => {
  it('counts records approaching retention expiry and under legal hold per type', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_retention_report'
    const adminId = 'user_admin_retention_report'
    await seedTenant(t, clerkOrgId, adminId)

    const DAY = 24 * 60 * 60 * 1000
    // createdAt ~5 years ago minus/plus slack so createdAt + 5y lands inside
    // or outside the 90-day window via the legacy fallback path.
    const createdExpiring = new Date(
      Date.now() - 5 * 365 * DAY + 30 * DAY,
    ).toISOString()
    const createdNotExpiring = new Date(
      Date.now() - 5 * 365 * DAY - 30 * DAY,
    ).toISOString()

    await seedArchiveItem(t, clerkOrgId, { createdAt: createdExpiring })
    await seedArchiveItem(t, clerkOrgId, { createdAt: createdNotExpiring })
    const { itemId: holdItemId } = await seedArchiveItem(t, clerkOrgId, {
      createdAt: new Date().toISOString(),
    })

    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.documentArchive.setLegalHold,
      {
        clerkOrgId,
        table: 'documentArchiveItems',
        recordId: holdItemId as string,
        legalHold: true,
      },
    )

    const report = await asAdmin(t, adminId, clerkOrgId).query(
      api.documentArchive.getRetentionReport,
      { clerkOrgId },
    )

    expect(report.windowDays).toBe(90)
    const archive = report.recordTypes.find(
      (rt) => rt.key === 'documentArchiveItems',
    )
    expect(archive?.total).toBe(3)
    expect(archive?.expiringSoon).toBe(1)
    expect(archive?.legalHold).toBe(1)
    expect(
      report.recordTypes.find((rt) => rt.key === 'specialIncidents')?.total,
    ).toBe(0)
    expect(
      report.recordTypes.find((rt) => rt.key === 'progressReports')?.total,
    ).toBe(0)
  })

  it('is blocked for org:caregiver', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_retention_block'
    const adminId = 'user_admin_retention_block'
    const caregiverId = 'user_cg_retention_block'
    await seedTenant(t, clerkOrgId, adminId)
    await seedCaregiver(t, clerkOrgId, caregiverId)

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).query(
        api.documentArchive.getRetentionReport,
        { clerkOrgId },
      ),
    ).rejects.toThrow()
  })
})
