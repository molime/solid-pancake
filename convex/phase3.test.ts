import { describe, expect, it, afterEach, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { checkComplianceBlocked } from './compliance'

const modules = import.meta.glob('./**/*.*s')

const DAY_MS = 24 * 60 * 60 * 1000

function createTestConvex() {
  return convexTest({ schema, modules })
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}

async function seedTenant(t: ReturnType<typeof createTestConvex>, clerkOrgId: string) {
  return t.run(async (ctx) => {
    return ctx.db.insert('tenants', {
      clerkOrgId,
      name: 'Test Agency',
      slug: 'test-agency',
      createdAt: new Date().toISOString(),
    })
  })
}

async function addMember(
  t: ReturnType<typeof createTestConvex>,
  tenantId: Id<'tenants'>,
  clerkUserId: string,
  role: 'org:admin' | 'org:coordinator' | 'org:caregiver' | 'org:hr',
) {
  return t.run(async (ctx) => {
    return ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId,
      role,
      displayName: `User ${clerkUserId}`,
      email: `${clerkUserId}@example.com`,
    })
  })
}

function asUser(
  t: ReturnType<typeof createTestConvex>,
  clerkUserId: string,
  clerkOrgId: string,
  role: 'org:admin' | 'org:coordinator' | 'org:caregiver' | 'org:hr',
) {
  return t.withIdentity({
    subject: clerkUserId,
    org_id: clerkOrgId,
    org_role: role,
  })
}

async function seedCaregiverProfile(
  t: ReturnType<typeof createTestConvex>,
  tenantId: Id<'tenants'>,
  caregiverId: string,
) {
  return t.run(async (ctx) => {
    return ctx.db.insert('employeeProfiles', {
      tenantId,
      clerkUserId: caregiverId,
      displayName: 'Test Caregiver',
      email: 'caregiver@example.com',
      adpSyncStatus: 'queued',
      createdAt: new Date().toISOString(),
    })
  })
}

async function seedArchiveItem(
  t: ReturnType<typeof createTestConvex>,
  opts: {
    tenantId: Id<'tenants'>
    subjectId: string
    category: string
    status: string
    expiresAt?: string
    overrideStatus?: string
  },
) {
  return t.run(async (ctx) => {
    const fileId = await ctx.db.insert('files', {
      tenantId: opts.tenantId,
      storageId: `storage-${opts.category}-${opts.status}`,
      uploadedBy: 'user_admin',
      fileName: `${opts.category}.pdf`,
      linkedType: 'complianceDoc',
      linkedId: opts.subjectId,
      visibility: 'all_staff',
      createdAt: new Date().toISOString(),
    })

    return ctx.db.insert('documentArchiveItems', {
      tenantId: opts.tenantId,
      fileId,
      subjectType: 'employee',
      subjectId: opts.subjectId,
      category: opts.category,
      status: opts.status,
      expiresAt: opts.expiresAt,
      overrideStatus: opts.overrideStatus,
      createdAt: new Date().toISOString(),
    })
  })
}

async function seedDocumentedShift(
  t: ReturnType<typeof createTestConvex>,
  opts: {
    tenantId: Id<'tenants'>
    caregiverId: string
    clientName?: string
    shiftStatus?: 'scheduled' | 'submitted' | 'billing_ready'
  },
) {
  return t.run(async (ctx) => {
    const clientId = await ctx.db.insert('clients', {
      tenantId: opts.tenantId,
      displayName: opts.clientName ?? 'John Doe',
      serviceType: 'SLS',
      authorizationHours: 100,
      riskFlags: [],
    })

    const shiftId = await ctx.db.insert('shifts', {
      tenantId: opts.tenantId,
      clientId,
      caregiverId: opts.caregiverId,
      scheduledStart: '2026-08-01T08:00:00Z',
      scheduledEnd: '2026-08-01T12:00:00Z',
      status: opts.shiftStatus ?? 'submitted',
      serviceType: 'SLS',
      rate: 25,
    })

    await ctx.db.insert('progressNotes', {
      tenantId: opts.tenantId,
      shiftId,
      startTime: '08:00',
      endTime: '12:00',
      servicesProvided: 'ADL support',
      clientResponse: 'Cooperative',
      narrative: 'Shift completed as planned.',
    })

    await ctx.db.insert('shiftTasks', {
      tenantId: opts.tenantId,
      shiftId,
      title: 'Document services',
      requiredProof: false,
      status: 'complete',
    })

    return { clientId, shiftId }
  })
}

async function seedBillingLine(
  t: ReturnType<typeof createTestConvex>,
  opts: {
    tenantId: Id<'tenants'>
    shiftId: Id<'shifts'>
    amount?: number
    createdAt?: string
    blockedReason?: string
    exportBatchId?: Id<'exportBatches'>
  },
) {
  return t.run(async (ctx) => {
    return ctx.db.insert('billingLines', {
      tenantId: opts.tenantId,
      shiftId: opts.shiftId,
      hours: 4,
      rate: 25,
      amount: opts.amount ?? 100,
      blockedReason: opts.blockedReason,
      blockedAt: opts.blockedReason ? new Date().toISOString() : undefined,
      exportBatchId: opts.exportBatchId,
      createdAt: opts.createdAt ?? '2026-08-10T12:00:00.000Z',
    })
  })
}

describe('checkComplianceBlocked', () => {
  it('blocks on a rejected credential document', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_ccb_rejected'
    const caregiverId = 'user_cg_rejected'
    const tenantId = await seedTenant(t, clerkOrgId)
    const profileId = await seedCaregiverProfile(t, tenantId, caregiverId)
    await seedArchiveItem(t, {
      tenantId,
      subjectId: profileId as string,
      category: 'cpr',
      status: 'rejected',
    })

    const result = await t.run(async (ctx) =>
      checkComplianceBlocked(ctx, tenantId, caregiverId),
    )
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('cpr')
  })

  it('blocks on an expired credential document', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_ccb_expired'
    const caregiverId = 'user_cg_expired'
    const tenantId = await seedTenant(t, clerkOrgId)
    const profileId = await seedCaregiverProfile(t, tenantId, caregiverId)
    await seedArchiveItem(t, {
      tenantId,
      subjectId: profileId as string,
      category: 'cpr',
      status: 'verified',
      expiresAt: daysAgo(1),
    })

    const result = await t.run(async (ctx) =>
      checkComplianceBlocked(ctx, tenantId, caregiverId),
    )
    expect(result.blocked).toBe(true)
  })

  it('does not block an expired document that has been overridden', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_ccb_overridden'
    const caregiverId = 'user_cg_overridden'
    const tenantId = await seedTenant(t, clerkOrgId)
    const profileId = await seedCaregiverProfile(t, tenantId, caregiverId)
    await seedArchiveItem(t, {
      tenantId,
      subjectId: profileId as string,
      category: 'cpr',
      status: 'verified',
      expiresAt: daysAgo(1),
      overrideStatus: 'overridden',
    })

    const result = await t.run(async (ctx) =>
      checkComplianceBlocked(ctx, tenantId, caregiverId),
    )
    expect(result.blocked).toBe(false)
  })

  it('blocks when a required credential is missing entirely', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_ccb_missing'
    const caregiverId = 'user_cg_missing'
    const tenantId = await seedTenant(t, clerkOrgId)
    await seedCaregiverProfile(t, tenantId, caregiverId)
    await t.run(async (ctx) => {
      await ctx.db.insert('credentialRequirements', {
        tenantId,
        role: 'org:caregiver',
        category: 'cpr',
        label: 'CPR Certification',
        isRequired: true,
      })
    })

    const result = await t.run(async (ctx) =>
      checkComplianceBlocked(ctx, tenantId, caregiverId),
    )
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('CPR Certification')
  })

  it('does not block when there are no requirements and no bad documents', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_ccb_clean'
    const caregiverId = 'user_cg_clean'
    const tenantId = await seedTenant(t, clerkOrgId)
    const profileId = await seedCaregiverProfile(t, tenantId, caregiverId)
    await seedArchiveItem(t, {
      tenantId,
      subjectId: profileId as string,
      category: 'cpr',
      status: 'verified',
      expiresAt: new Date(Date.now() + 90 * DAY_MS).toISOString(),
    })

    const result = await t.run(async (ctx) =>
      checkComplianceBlocked(ctx, tenantId, caregiverId),
    )
    expect(result.blocked).toBe(false)
  })
})

describe('reviews.approve compliance gate', () => {
  it('creates a blocked billing line without throwing when compliance-blocked', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_approve_blocked'
    const coordinatorId = 'user_coord_blocked'
    const caregiverId = 'user_cg_blocked'
    const tenantId = await seedTenant(t, clerkOrgId)
    await addMember(t, tenantId, coordinatorId, 'org:coordinator')
    await addMember(t, tenantId, caregiverId, 'org:caregiver')
    const profileId = await seedCaregiverProfile(t, tenantId, caregiverId)
    await seedArchiveItem(t, {
      tenantId,
      subjectId: profileId as string,
      category: 'cpr',
      status: 'rejected',
    })
    const { shiftId } = await seedDocumentedShift(t, { tenantId, caregiverId })

    const result = await asUser(t, coordinatorId, clerkOrgId, 'org:coordinator').mutation(
      api.reviews.approve,
      { clerkOrgId, shiftId, comment: 'Looks good' },
    )

    expect(typeof result).toBe('string')
    expect(result as string).toContain('Billing blocked')

    const state = await t.run(async (ctx) => {
      const shift = await ctx.db.get(shiftId)
      const lines = await ctx.db
        .query('billingLines')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .collect()
      const audits = await ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect()
      return { shift, lines, audits }
    })

    expect(state.shift?.status).toBe('billing_ready')
    expect(state.lines).toHaveLength(1)
    expect(state.lines[0]?.blockedReason).toBeDefined()
    expect(state.lines[0]?.blockedAt).toBeDefined()
    expect(
      state.audits.some((a) => a.action === 'billing_blocked_compliance'),
    ).toBe(true)
  })

  it('rejects a compliance override attempted by a non-admin', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_approve_coord_override'
    const coordinatorId = 'user_coord_override'
    const caregiverId = 'user_cg_coord_override'
    const tenantId = await seedTenant(t, clerkOrgId)
    await addMember(t, tenantId, coordinatorId, 'org:coordinator')
    await addMember(t, tenantId, caregiverId, 'org:caregiver')
    const profileId = await seedCaregiverProfile(t, tenantId, caregiverId)
    await seedArchiveItem(t, {
      tenantId,
      subjectId: profileId as string,
      category: 'cpr',
      status: 'rejected',
    })
    const { shiftId } = await seedDocumentedShift(t, { tenantId, caregiverId })

    await expect(
      asUser(t, coordinatorId, clerkOrgId, 'org:coordinator').mutation(
        api.reviews.approve,
        {
          clerkOrgId,
          shiftId,
          comment: 'Override please',
          complianceOverride: true,
          complianceOverrideReason: 'Manager approved verbally',
        },
      ),
    ).rejects.toThrow(/only org:admin/)
  })

  it('creates a clean billing line when an admin applies a compliance override', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_approve_admin_override'
    const adminId = 'user_admin_override'
    const caregiverId = 'user_cg_admin_override'
    const tenantId = await seedTenant(t, clerkOrgId)
    await addMember(t, tenantId, adminId, 'org:admin')
    await addMember(t, tenantId, caregiverId, 'org:caregiver')
    const profileId = await seedCaregiverProfile(t, tenantId, caregiverId)
    await seedArchiveItem(t, {
      tenantId,
      subjectId: profileId as string,
      category: 'cpr',
      status: 'rejected',
    })
    const { shiftId } = await seedDocumentedShift(t, { tenantId, caregiverId })

    const result = await asUser(t, adminId, clerkOrgId, 'org:admin').mutation(
      api.reviews.approve,
      {
        clerkOrgId,
        shiftId,
        comment: 'Approved with override',
        complianceOverride: true,
        complianceOverrideReason: 'Credential re-verified by phone',
      },
    )
    expect(result).toBe(shiftId)

    const state = await t.run(async (ctx) => {
      const lines = await ctx.db
        .query('billingLines')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .collect()
      const reviewEvents = await ctx.db
        .query('reviewEvents')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .collect()
      const audits = await ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect()
      return { lines, reviewEvents, audits }
    })

    expect(state.lines).toHaveLength(1)
    expect(state.lines[0]?.blockedReason).toBeUndefined()
    expect(state.reviewEvents[0]?.complianceOverride).toBe(true)
    expect(state.reviewEvents[0]?.complianceOverrideReason).toBe(
      'Credential re-verified by phone',
    )
    expect(
      state.audits.some((a) => a.action === 'compliance_override_applied'),
    ).toBe(true)
  })

  it('schedules a billing_ready notification after a clean approval', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_approve_clean'
    const coordinatorId = 'user_coord_clean'
    const caregiverId = 'user_cg_clean'
    const tenantId = await seedTenant(t, clerkOrgId)
    await addMember(t, tenantId, coordinatorId, 'org:coordinator')
    await addMember(t, tenantId, caregiverId, 'org:caregiver')
    const { shiftId } = await seedDocumentedShift(t, { tenantId, caregiverId })

    vi.useFakeTimers()
    await asUser(t, coordinatorId, clerkOrgId, 'org:coordinator').mutation(
      api.reviews.approve,
      { clerkOrgId, shiftId, comment: 'All good' },
    )
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const notifications = await t.run(async (ctx) =>
      ctx.db
        .query('notifications')
        .withIndex('by_tenant_user', (q) =>
          q.eq('tenantId', tenantId).eq('clerkUserId', caregiverId),
        )
        .collect(),
    )
    expect(notifications.some((n) => n.type === 'billing_ready')).toBe(true)
  })
})

describe('createPerPatientInvoices', () => {
  it('groups unexported unblocked lines by patient with INV numbering', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_ppi_grouping'
    const adminId = 'user_admin_ppi'
    const caregiverId = 'user_cg_ppi'
    const tenantId = await seedTenant(t, clerkOrgId)
    await addMember(t, tenantId, adminId, 'org:admin')

    const doe = await seedDocumentedShift(t, {
      tenantId,
      caregiverId,
      clientName: 'John Doe',
      shiftStatus: 'billing_ready',
    })
    const smith = await seedDocumentedShift(t, {
      tenantId,
      caregiverId,
      clientName: 'Jane Smith',
      shiftStatus: 'billing_ready',
    })

    const doeLine1 = await seedBillingLine(t, {
      tenantId,
      shiftId: doe.shiftId,
      createdAt: '2026-08-05T12:00:00.000Z',
    })
    const doeLine2 = await seedBillingLine(t, {
      tenantId,
      shiftId: doe.shiftId,
      createdAt: '2026-08-31T10:00:00.000Z',
    })
    const smithLine = await seedBillingLine(t, {
      tenantId,
      shiftId: smith.shiftId,
      createdAt: '2026-08-12T12:00:00.000Z',
    })
    const blockedLine = await seedBillingLine(t, {
      tenantId,
      shiftId: doe.shiftId,
      blockedReason: 'Expired credential: cpr',
      createdAt: '2026-08-15T12:00:00.000Z',
    })
    const outOfRangeLine = await seedBillingLine(t, {
      tenantId,
      shiftId: smith.shiftId,
      createdAt: '2026-09-01T12:00:00.000Z',
    })

    const result = await asUser(t, adminId, clerkOrgId, 'org:admin').mutation(
      api.billing.createPerPatientInvoices,
      { clerkOrgId, startDate: '2026-08-01', endDate: '2026-08-31' },
    )
    expect(result.count).toBe(2)

    const state = await t.run(async (ctx) => {
      const batches = await ctx.db
        .query('exportBatches')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect()
      const lines = await ctx.db
        .query('billingLines')
        .withIndex('by_tenant_export_batch', (q) => q.eq('tenantId', tenantId))
        .collect()
      const audits = await ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect()
      return { batches, lines, audits }
    })

    expect(state.batches).toHaveLength(2)
    const numbers = state.batches.map((b) => b.invoiceNumber).sort()
    expect(numbers).toEqual([
      'INV-test-agency-Doe-202608',
      'INV-test-agency-Smith-202608',
    ])
    for (const batch of state.batches) {
      expect(batch.status).toBe('draft')
      expect(batch.clientId).toBeDefined()
      expect(batch.payerType).toBe('medicaid')
    }

    const byId = new Map(state.lines.map((l) => [l._id as string, l]))
    expect(byId.get(doeLine1 as string)?.exportBatchId).toBeDefined()
    expect(byId.get(doeLine2 as string)?.exportBatchId).toBeDefined()
    expect(byId.get(smithLine as string)?.exportBatchId).toBeDefined()
    expect(byId.get(blockedLine as string)?.exportBatchId).toBeUndefined()
    expect(byId.get(outOfRangeLine as string)?.exportBatchId).toBeUndefined()

    expect(
      state.audits.filter((a) => a.action === 'invoice_created'),
    ).toHaveLength(2)
  })
})

describe('billing block release and invoice lifecycle', () => {
  it('releaseBillingBlock clears the block and audits the release', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_release'
    const coordinatorId = 'user_coord_release'
    const tenantId = await seedTenant(t, clerkOrgId)
    await addMember(t, tenantId, coordinatorId, 'org:coordinator')
    const { shiftId } = await seedDocumentedShift(t, {
      tenantId,
      caregiverId: 'user_cg_release',
      shiftStatus: 'billing_ready',
    })
    const lineId = await seedBillingLine(t, {
      tenantId,
      shiftId,
      blockedReason: 'Expired credential: cpr',
    })

    await asUser(t, coordinatorId, clerkOrgId, 'org:coordinator').mutation(
      api.billing.releaseBillingBlock,
      { clerkOrgId, billingLineId: lineId, reason: 'Credential renewed' },
    )

    const state = await t.run(async (ctx) => {
      const line = await ctx.db.get(lineId)
      const audits = await ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect()
      return { line, audits }
    })

    expect(state.line?.blockedReason).toBeUndefined()
    expect(state.line?.blockedAt).toBeUndefined()
    expect(
      state.audits.some((a) => a.action === 'billing_block_released'),
    ).toBe(true)
  })

  it('releaseBillingBlock rejects non billing roles', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_release_forbidden'
    const caregiverId = 'user_cg_release_forbidden'
    const tenantId = await seedTenant(t, clerkOrgId)
    await addMember(t, tenantId, caregiverId, 'org:caregiver')
    const { shiftId } = await seedDocumentedShift(t, {
      tenantId,
      caregiverId,
      shiftStatus: 'billing_ready',
    })
    const lineId = await seedBillingLine(t, {
      tenantId,
      shiftId,
      blockedReason: 'Expired credential: cpr',
    })

    await expect(
      asUser(t, caregiverId, clerkOrgId, 'org:caregiver').mutation(
        api.billing.releaseBillingBlock,
        { clerkOrgId, billingLineId: lineId, reason: 'Please' },
      ),
    ).rejects.toThrow(/Forbidden/)
  })

  it('transitions invoice status and voiding returns lines to unexported', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_invoice_lifecycle'
    const adminId = 'user_admin_lifecycle'
    const tenantId = await seedTenant(t, clerkOrgId)
    await addMember(t, tenantId, adminId, 'org:admin')
    const { shiftId } = await seedDocumentedShift(t, {
      tenantId,
      caregiverId: 'user_cg_lifecycle',
      shiftStatus: 'billing_ready',
    })

    const invoiceId = await t.run(async (ctx) => {
      const lineId = await ctx.db.insert('billingLines', {
        tenantId,
        shiftId,
        hours: 4,
        rate: 25,
        amount: 100,
        createdAt: '2026-08-10T12:00:00.000Z',
      })
      const batchId = await ctx.db.insert('exportBatches', {
        tenantId,
        name: 'Test invoice',
        exportedAt: '2026-08-10T12:00:00.000Z',
        exportedBy: adminId,
        status: 'draft',
        invoiceNumber: 'INV-test-agency-Doe-202608',
        lineCount: 1,
        totalAmount: 100,
      })
      await ctx.db.patch(lineId, { exportBatchId: batchId })
      return { batchId, lineId }
    })

    const asAdmin = asUser(t, adminId, clerkOrgId, 'org:admin')

    // draft -> paid is not a legal transition
    await expect(
      asAdmin.mutation(api.billing.markInvoicePaid, {
        clerkOrgId,
        invoiceId: invoiceId.batchId,
      }),
    ).rejects.toThrow(/Cannot move invoice/)

    await asAdmin.mutation(api.billing.markInvoiceSent, {
      clerkOrgId,
      invoiceId: invoiceId.batchId,
    })
    await asAdmin.mutation(api.billing.markInvoicePaid, {
      clerkOrgId,
      invoiceId: invoiceId.batchId,
    })

    const afterPaid = await t.run(async (ctx) => ctx.db.get(invoiceId.batchId))
    expect(afterPaid?.status).toBe('paid')

    // paid is terminal
    await expect(
      asAdmin.mutation(api.billing.voidInvoice, {
        clerkOrgId,
        invoiceId: invoiceId.batchId,
      }),
    ).rejects.toThrow(/Cannot move invoice/)

    // A separate draft invoice: voiding clears exportBatchId on its lines.
    const draftId = await t.run(async (ctx) => {
      const lineId = await ctx.db.insert('billingLines', {
        tenantId,
        shiftId,
        hours: 2,
        rate: 25,
        amount: 50,
        createdAt: '2026-08-11T12:00:00.000Z',
      })
      const batchId = await ctx.db.insert('exportBatches', {
        tenantId,
        name: 'Void me',
        exportedAt: '2026-08-11T12:00:00.000Z',
        exportedBy: adminId,
        status: 'draft',
        lineCount: 1,
        totalAmount: 50,
      })
      await ctx.db.patch(lineId, { exportBatchId: batchId })
      return { batchId, lineId }
    })

    await asAdmin.mutation(api.billing.voidInvoice, {
      clerkOrgId,
      invoiceId: draftId.batchId,
    })

    const afterVoid = await t.run(async (ctx) => {
      const batch = await ctx.db.get(draftId.batchId)
      const line = await ctx.db.get(draftId.lineId)
      const audits = await ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect()
      return { batch, line, audits }
    })

    expect(afterVoid.batch?.status).toBe('void')
    expect(afterVoid.line?.exportBatchId).toBeUndefined()
    expect(
      afterVoid.audits.filter((a) => a.action === 'invoice_status_changed')
        .length,
    ).toBeGreaterThanOrEqual(3)
  })

  it('unexported excludes blocked lines', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_unexported_blocked'
    const adminId = 'user_admin_unexported'
    const tenantId = await seedTenant(t, clerkOrgId)
    await addMember(t, tenantId, adminId, 'org:admin')
    const { shiftId } = await seedDocumentedShift(t, {
      tenantId,
      caregiverId: 'user_cg_unexported',
      shiftStatus: 'billing_ready',
    })
    await seedBillingLine(t, { tenantId, shiftId })
    await seedBillingLine(t, {
      tenantId,
      shiftId,
      blockedReason: 'Expired credential: cpr',
    })

    const lines = await asUser(t, adminId, clerkOrgId, 'org:admin').query(
      api.billing.unexported,
      { clerkOrgId },
    )
    expect(lines).toHaveLength(1)
    expect(lines[0]?.blockedReason).toBeUndefined()
  })

  it('createInvoice skips blocked lines and throws when all are blocked', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_create_invoice_blocked'
    const adminId = 'user_admin_cib'
    const tenantId = await seedTenant(t, clerkOrgId)
    await addMember(t, tenantId, adminId, 'org:admin')
    const { shiftId } = await seedDocumentedShift(t, {
      tenantId,
      caregiverId: 'user_cg_cib',
      shiftStatus: 'billing_ready',
    })
    const cleanLine = await seedBillingLine(t, { tenantId, shiftId })
    const blockedLine = await seedBillingLine(t, {
      tenantId,
      shiftId,
      blockedReason: 'Expired credential: cpr',
    })

    const asAdmin = asUser(t, adminId, clerkOrgId, 'org:admin')

    const invoiceId = await asAdmin.mutation(api.billing.createInvoice, {
      clerkOrgId,
      name: 'Mixed invoice',
      lineIds: [cleanLine, blockedLine],
    })

    const detail = await asAdmin.query(api.billing.invoiceDetails, {
      clerkOrgId,
      invoiceId: invoiceId as Id<'exportBatches'>,
    })
    expect(detail.lines).toHaveLength(1)
    expect(detail.lines[0]?._id).toBe(cleanLine)
    expect(detail.invoice.status).toBe('draft')

    await expect(
      asAdmin.mutation(api.billing.createInvoice, {
        clerkOrgId,
        name: 'All blocked',
        lineIds: [blockedLine],
      }),
    ).rejects.toThrow(/blocked from invoicing/)
  })
})

describe('exportPayroll', () => {
  it('falls back to CSV export when ADP is not configured', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_payroll_csv'
    const adminId = 'user_admin_payroll'
    const caregiverId = 'user_cg_payroll'
    const tenantId = await seedTenant(t, clerkOrgId)
    await addMember(t, tenantId, adminId, 'org:admin')
    await addMember(t, tenantId, caregiverId, 'org:caregiver')

    const { shiftId } = await seedDocumentedShift(t, {
      tenantId,
      caregiverId,
      shiftStatus: 'billing_ready',
    })

    const payPeriodId = await t.run(async (ctx) => {
      const periodId = await ctx.db.insert('payPeriods', {
        tenantId,
        startDate: '2026-08-01',
        endDate: '2026-08-15',
        status: 'open',
      })
      await ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_in',
        at: '2026-08-03T08:00:00.000Z',
        source: 'atriax',
        adpSyncStatus: 'queued',
        createdAt: '2026-08-03T08:00:00.000Z',
      })
      await ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_out',
        at: '2026-08-03T12:00:00.000Z',
        source: 'atriax',
        adpSyncStatus: 'queued',
        createdAt: '2026-08-03T12:00:00.000Z',
      })
      return periodId
    })

    const result = await asUser(t, adminId, clerkOrgId, 'org:admin').action(
      api.billing.exportPayroll,
      { clerkOrgId, payPeriodId },
    )
    expect(result.status).toBe('exported')
    expect(result.path).toBe('csv')
    expect(result.caregiverCount).toBe(1)

    const state = await t.run(async (ctx) => {
      const period = await ctx.db.get(payPeriodId)
      const audits = await ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect()
      return { period, audits }
    })

    expect(state.period?.status).toBe('exported')
    expect(state.period?.exportedBy).toBe(adminId)

    const csvAudit = state.audits.find((a) => a.action === 'payroll_exported_csv')
    expect(csvAudit).toBeDefined()
    const csv = csvAudit?.metadata?.csv as string
    expect(csv).toContain('caregiver_id,caregiver_name,hours')
    expect(csv).toContain(`${caregiverId},User ${caregiverId},4.00`)

    // Re-exporting an exported period is refused.
    await expect(
      asUser(t, adminId, clerkOrgId, 'org:admin').action(
        api.billing.exportPayroll,
        { clerkOrgId, payPeriodId },
      ),
    ).rejects.toThrow(/already been exported/)
  })
})

describe('notifications', () => {
  async function seedNotificationRows(
    t: ReturnType<typeof createTestConvex>,
    tenantId: Id<'tenants'>,
    rows: { clerkUserId: string; type: string; read?: boolean; createdAt: string }[],
  ) {
    return t.run(async (ctx) => {
      const ids = []
      for (const row of rows) {
        ids.push(
          await ctx.db.insert('notifications', {
            tenantId,
            clerkUserId: row.clerkUserId,
            type: row.type,
            message: `${row.type} message`,
            read: row.read ?? false,
            createdAt: row.createdAt,
          }),
        )
      }
      return ids
    })
  }

  it('lists only the current user notifications, newest first', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_notif_list'
    const adminId = 'user_admin_notif'
    const otherId = 'user_coord_notif'
    const tenantId = await seedTenant(t, clerkOrgId)
    await addMember(t, tenantId, adminId, 'org:admin')
    await addMember(t, tenantId, otherId, 'org:coordinator')

    await seedNotificationRows(t, tenantId, [
      { clerkUserId: adminId, type: 'billing_ready', createdAt: '2026-08-01T00:00:00Z' },
      { clerkUserId: adminId, type: 'invoice_created', createdAt: '2026-08-02T00:00:00Z' },
      { clerkUserId: otherId, type: 'escalation', createdAt: '2026-08-03T00:00:00Z' },
    ])

    const list = await asUser(t, adminId, clerkOrgId, 'org:admin').query(
      api.notifications.list,
      { clerkOrgId },
    )
    expect(list).toHaveLength(2)
    expect(list[0]?.type).toBe('invoice_created')
    expect(list[1]?.type).toBe('billing_ready')

    const unread = await asUser(t, adminId, clerkOrgId, 'org:admin').query(
      api.notifications.unreadCount,
      { clerkOrgId },
    )
    expect(unread).toBe(2)
  })

  it('markRead and markAllRead are scoped to the owning user', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_notif_read'
    const adminId = 'user_admin_read'
    const otherId = 'user_coord_read'
    const tenantId = await seedTenant(t, clerkOrgId)
    await addMember(t, tenantId, adminId, 'org:admin')
    await addMember(t, tenantId, otherId, 'org:coordinator')

    const [mineId, , otherNotifId] = await seedNotificationRows(t, tenantId, [
      { clerkUserId: adminId, type: 'billing_ready', createdAt: '2026-08-01T00:00:00Z' },
      { clerkUserId: adminId, type: 'invoice_created', createdAt: '2026-08-02T00:00:00Z' },
      { clerkUserId: otherId, type: 'escalation', createdAt: '2026-08-03T00:00:00Z' },
    ])

    const asAdmin = asUser(t, adminId, clerkOrgId, 'org:admin')

    // Cannot mark another user's notification.
    await expect(
      asAdmin.mutation(api.notifications.markRead, {
        notificationId: otherNotifId,
      }),
    ).rejects.toThrow(/another user/)

    await asAdmin.mutation(api.notifications.markRead, {
      notificationId: mineId,
    })
    expect(await asAdmin.query(api.notifications.unreadCount, { clerkOrgId })).toBe(1)

    await asAdmin.mutation(api.notifications.markAllRead, { clerkOrgId })
    expect(await asAdmin.query(api.notifications.unreadCount, { clerkOrgId })).toBe(0)

    // The other user's notification is untouched.
    const otherRow = await t.run(async (ctx) => ctx.db.get(otherNotifId))
    expect(otherRow?.read).toBe(false)
  })
})

describe('reporting.listNotifications', () => {
  it('falls back to the derived feed when the table is empty', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_report_fallback'
    const adminId = 'user_admin_fallback'
    const tenantId = await seedTenant(t, clerkOrgId)
    await addMember(t, tenantId, adminId, 'org:admin')

    await t.run(async (ctx) => {
      await ctx.db.insert('auditEvents', {
        tenantId,
        actorId: adminId,
        actorRole: 'org:admin',
        action: 'shift_approved',
        createdAt: '2026-08-01T00:00:00Z',
      })
    })

    const feed = await asUser(t, adminId, clerkOrgId, 'org:admin').query(
      api.reporting.listNotifications,
      { clerkOrgId },
    )
    expect(feed).toHaveLength(1)
    expect(feed[0]?.type).toBe('audit')
    expect(feed[0]?.id.startsWith('audit:')).toBe(true)
  })

  it('reads the notifications table when it has rows', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_report_table'
    const adminId = 'user_admin_table'
    const tenantId = await seedTenant(t, clerkOrgId)
    await addMember(t, tenantId, adminId, 'org:admin')

    await t.run(async (ctx) => {
      await ctx.db.insert('notifications', {
        tenantId,
        clerkUserId: adminId,
        type: 'billing_blocked',
        message: 'Billing blocked for Test Caregiver: Rejected credential: cpr.',
        read: true,
        createdAt: '2026-08-02T00:00:00Z',
      })
      await ctx.db.insert('auditEvents', {
        tenantId,
        actorId: adminId,
        actorRole: 'org:admin',
        action: 'shift_approved',
        createdAt: '2026-08-01T00:00:00Z',
      })
    })

    const feed = await asUser(t, adminId, clerkOrgId, 'org:admin').query(
      api.reporting.listNotifications,
      { clerkOrgId },
    )
    expect(feed).toHaveLength(1)
    expect(feed[0]?.type).toBe('billing_blocked')
    expect(feed[0]?.read).toBe(true)
  })
})

describe('overrideComplianceBlock', () => {
  it('stamps override fields, updates expiry, and unblocks the caregiver', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_override_block'
    const adminId = 'user_admin_overrideblock'
    const caregiverId = 'user_cg_overrideblock'
    const tenantId = await seedTenant(t, clerkOrgId)
    await addMember(t, tenantId, adminId, 'org:admin')
    const profileId = await seedCaregiverProfile(t, tenantId, caregiverId)
    const itemId = await seedArchiveItem(t, {
      tenantId,
      subjectId: profileId as string,
      category: 'cpr',
      status: 'verified',
      expiresAt: daysAgo(5),
    })

    const before = await t.run(async (ctx) =>
      checkComplianceBlocked(ctx, tenantId, caregiverId),
    )
    expect(before.blocked).toBe(true)

    const newExpiry = new Date(Date.now() + 180 * DAY_MS).toISOString()
    await asUser(t, adminId, clerkOrgId, 'org:admin').mutation(
      api.compliance.overrideComplianceBlock,
      {
        clerkOrgId,
        documentArchiveItemId: itemId,
        reason: 'HR verified renewal in progress',
        newExpiry,
      },
    )

    const state = await t.run(async (ctx) => {
      const item = await ctx.db.get(itemId)
      const audits = await ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect()
      return { item, audits }
    })

    expect(state.item?.overrideStatus).toBe('overridden')
    expect(state.item?.overrideReason).toBe('HR verified renewal in progress')
    expect(state.item?.overrideBy).toBe(adminId)
    expect(state.item?.overrideAt).toBeDefined()
    expect(state.item?.expiresAt).toBe(newExpiry)
    expect(
      state.audits.some((a) => a.action === 'compliance_override_applied'),
    ).toBe(true)

    const after = await t.run(async (ctx) =>
      checkComplianceBlocked(ctx, tenantId, caregiverId),
    )
    expect(after.blocked).toBe(false)
  })

  it('rejects non admin/HR callers', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_override_forbidden'
    const coordinatorId = 'user_coord_overrideblock'
    const tenantId = await seedTenant(t, clerkOrgId)
    await addMember(t, tenantId, coordinatorId, 'org:coordinator')
    const profileId = await seedCaregiverProfile(t, tenantId, 'user_cg_of')
    const itemId = await seedArchiveItem(t, {
      tenantId,
      subjectId: profileId as string,
      category: 'cpr',
      status: 'rejected',
    })

    await expect(
      asUser(t, coordinatorId, clerkOrgId, 'org:coordinator').mutation(
        api.compliance.overrideComplianceBlock,
        {
          clerkOrgId,
          documentArchiveItemId: itemId,
          reason: 'Not allowed',
        },
      ),
    ).rejects.toThrow(/Forbidden/)
  })
})

describe('checkEscalations', () => {
  it('escalates open HR cases by age with dedup on rerun', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_escalations'
    const tenantId = await seedTenant(t, clerkOrgId)
    await addMember(t, tenantId, 'user_coord_esc', 'org:coordinator')
    await addMember(t, tenantId, 'user_admin_esc', 'org:admin')
    await addMember(t, tenantId, 'user_hr_esc', 'org:hr')

    const caseIds = await t.run(async (ctx) => {
      async function addCase(ageDays: number, status = 'open') {
        return ctx.db.insert('hrCases', {
          tenantId,
          subjectType: 'employee',
          subjectId: 'user_cg_esc',
          category: 'credentialing',
          title: `Case aged ${ageDays}d (${status})`,
          status,
          createdAt: daysAgo(ageDays),
        })
      }
      return {
        young: await addCase(6),
        level1: await addCase(7),
        level2: await addCase(14),
        level3: await addCase(30),
        resolved: await addCase(45, 'resolved'),
      }
    })

    const first = await t.mutation(internal.escalations.checkEscalations, {})
    expect(first.created).toBe(3)

    const escalations = await t.run(async (ctx) =>
      ctx.db
        .query('escalations')
        .withIndex('by_tenant_level', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(escalations).toHaveLength(3)

    const bySubject = new Map(escalations.map((e) => [e.subjectId, e]))
    expect(bySubject.get(caseIds.level1 as string)?.escalationLevel).toBe(1)
    expect(bySubject.get(caseIds.level1 as string)?.escalatedTo).toBe('org:coordinator')
    expect(bySubject.get(caseIds.level2 as string)?.escalationLevel).toBe(2)
    expect(bySubject.get(caseIds.level2 as string)?.escalatedTo).toBe('org:admin')
    expect(bySubject.get(caseIds.level3 as string)?.escalationLevel).toBe(3)
    expect(bySubject.get(caseIds.level3 as string)?.escalatedTo).toBe('org:hr')
    expect(bySubject.has(caseIds.young as string)).toBe(false)
    expect(bySubject.has(caseIds.resolved as string)).toBe(false)

    // Second run must not duplicate open escalations for the same subject+level.
    const second = await t.mutation(internal.escalations.checkEscalations, {})
    expect(second.created).toBe(0)
  })

  it('listEscalations returns only unresolved rows and resolveEscalation closes them', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_escalations_list'
    const adminId = 'user_admin_esclist'
    const tenantId = await seedTenant(t, clerkOrgId)
    await addMember(t, tenantId, adminId, 'org:admin')

    await t.run(async (ctx) => {
      await ctx.db.insert('hrCases', {
        tenantId,
        subjectType: 'employee',
        subjectId: 'user_cg_esclist',
        category: 'credentialing',
        title: 'Old open case',
        status: 'open',
        createdAt: daysAgo(10),
      })
    })
    await t.mutation(internal.escalations.checkEscalations, {})

    const asAdmin = asUser(t, adminId, clerkOrgId, 'org:admin')
    const active = await asAdmin.query(api.escalations.listEscalations, {
      clerkOrgId,
    })
    expect(active).toHaveLength(1)

    await asAdmin.mutation(api.escalations.resolveEscalation, {
      clerkOrgId,
      escalationId: active[0]!._id,
    })

    const afterResolve = await asAdmin.query(api.escalations.listEscalations, {
      clerkOrgId,
    })
    expect(afterResolve).toHaveLength(0)
  })
})
