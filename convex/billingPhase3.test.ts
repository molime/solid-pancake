import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { checkBillingBlocked } from './billingHelpers'

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

async function seedTenant(
  t: ReturnType<typeof createTestConvex>,
  options: { clerkOrgId: string; adminId: string; slug?: string },
) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: options.clerkOrgId,
      name: 'Test Agency',
      slug: options.slug ?? 'test-agency',
      createdAt: new Date().toISOString(),
    })

    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: options.adminId,
      role: 'org:admin',
      displayName: 'Admin',
      email: 'admin@example.com',
    })

    return { tenantId }
  })
}

async function seedClientWithLine(
  t: ReturnType<typeof createTestConvex>,
  options: {
    tenantId: Id<'tenants'>
    caregiverId: string
    clientName: string
    createdAt: string
    amount?: number
    blocked?: boolean
  },
) {
  return t.run(async (ctx) => {
    const clientId = await ctx.db.insert('clients', {
      tenantId: options.tenantId,
      displayName: options.clientName,
      serviceType: 'SLS',
      authorizationHours: 100,
      riskFlags: [],
    })

    const shiftId = await ctx.db.insert('shifts', {
      tenantId: options.tenantId,
      clientId,
      caregiverId: options.caregiverId,
      scheduledStart: '2026-07-10T08:00:00.000Z',
      scheduledEnd: '2026-07-10T16:00:00.000Z',
      status: 'billing_ready',
      serviceType: 'SLS',
      rate: 25,
    })

    const lineId = await ctx.db.insert('billingLines', {
      tenantId: options.tenantId,
      shiftId,
      hours: 8,
      rate: 25,
      amount: options.amount ?? 200,
      blockedReason: options.blocked ? 'Missing documentation.' : undefined,
      blockedAt: options.blocked ? new Date().toISOString() : undefined,
      createdAt: options.createdAt,
    })

    return { clientId, shiftId, lineId }
  })
}

describe('createPerPatientInvoices', () => {
  it('groups unexported unblocked lines by client and numbers invoices', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_billing_p3'
    const adminId = 'user_admin_p3'
    const { tenantId } = await seedTenant(t, { clerkOrgId, adminId })

    const doe = await seedClientWithLine(t, {
      tenantId,
      caregiverId: 'user_cg_1',
      clientName: 'Jane Doe',
      createdAt: '2026-07-10T12:00:00.000Z',
    })
    const smith = await seedClientWithLine(t, {
      tenantId,
      caregiverId: 'user_cg_2',
      clientName: 'Bob Smith',
      createdAt: '2026-07-11T12:00:00.000Z',
    })
    const blocked = await seedClientWithLine(t, {
      tenantId,
      caregiverId: 'user_cg_3',
      clientName: 'Blocked Client',
      createdAt: '2026-07-12T12:00:00.000Z',
      blocked: true,
    })

    const result = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.billing.createPerPatientInvoices,
      {
        clerkOrgId,
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-07-31T23:59:59.999Z',
      },
    )
    expect(result.count).toBe(2)
    expect(result.invoices).toHaveLength(2)
    for (const created of result.invoices) {
      expect(created.invoiceId).toBeDefined()
      expect(created.clientId).toBeDefined()
      expect(created.clientName).toBeTruthy()
      expect(created.periodStart).toBe('2026-07-01T00:00:00.000Z')
      expect(created.periodEnd).toBe('2026-07-31T23:59:59.999Z')
    }
    expect(result.invoices.map((i) => i.clientName).sort()).toEqual([
      'Bob Smith',
      'Jane Doe',
    ])

    const invoices = await t.run(async (ctx) =>
      ctx.db
        .query('exportBatches')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(invoices).toHaveLength(2)

    const invoiceNumbers = invoices.map((invoice) => invoice.invoiceNumber)
    expect(invoiceNumbers).toContain('INV-test-agency-Doe-202607')
    expect(invoiceNumbers).toContain('INV-test-agency-Smith-202607')

    for (const invoice of invoices) {
      expect(invoice.status).toBe('draft')
      expect(invoice.payerType).toBe('medicaid')
      expect(invoice.clientId).toBeDefined()
      expect(invoice.lineCount).toBe(1)
      expect(invoice.totalAmount).toBe(200)
    }

    const doeLine = await t.run(async (ctx) => ctx.db.get(doe.lineId))
    const smithLine = await t.run(async (ctx) => ctx.db.get(smith.lineId))
    const blockedLine = await t.run(async (ctx) => ctx.db.get(blocked.lineId))

    expect(doeLine?.exportBatchId).toBeDefined()
    expect(smithLine?.exportBatchId).toBeDefined()
    expect(blockedLine?.exportBatchId).toBeUndefined()
    expect(blockedLine?.blockedReason).toBe('Missing documentation.')

    const auditEvents = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(
      auditEvents.filter((event) => event.action === 'invoice_created'),
    ).toHaveLength(2)

    const second = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.billing.createPerPatientInvoices,
      {
        clerkOrgId,
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-07-31T23:59:59.999Z',
      },
    )
    expect(second.count).toBe(0)
  })
})

describe('releaseBillingBlock', () => {
  it('clears the block and audits the release', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_billing_release'
    const adminId = 'user_admin_release'
    const { tenantId } = await seedTenant(t, { clerkOrgId, adminId })

    const { lineId } = await seedClientWithLine(t, {
      tenantId,
      caregiverId: 'user_cg_release',
      clientName: 'Jane Doe',
      createdAt: '2026-07-10T12:00:00.000Z',
      blocked: true,
    })

    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.billing.releaseBillingBlock,
      { clerkOrgId, billingLineId: lineId, reason: 'Documentation received.' },
    )

    const line = await t.run(async (ctx) => ctx.db.get(lineId))
    expect(line?.blockedReason).toBeUndefined()
    expect(line?.blockedAt).toBeUndefined()

    const auditEvents = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    const release = auditEvents.find(
      (event) => event.action === 'billing_block_released',
    )
    expect(release).toBeDefined()
    expect(release?.metadata?.reason).toBe('Documentation received.')
  })

  it('rejects cross-tenant access', async () => {
    const t = createTestConvex()
    const { tenantId: tenantA } = await seedTenant(t, {
      clerkOrgId: 'org_release_a',
      adminId: 'user_admin_a',
    })
    await seedTenant(t, {
      clerkOrgId: 'org_release_b',
      adminId: 'user_admin_b',
      slug: 'agency-b',
    })

    const { lineId } = await seedClientWithLine(t, {
      tenantId: tenantA,
      caregiverId: 'user_cg_release_b',
      clientName: 'Jane Doe',
      createdAt: '2026-07-10T12:00:00.000Z',
      blocked: true,
    })

    await expect(
      asAdmin(t, 'user_admin_b', 'org_release_b').mutation(
        api.billing.releaseBillingBlock,
        {
          clerkOrgId: 'org_release_b',
          billingLineId: lineId,
          reason: 'Not my tenant.',
        },
      ),
    ).rejects.toThrow()

    const line = await t.run(async (ctx) => ctx.db.get(lineId))
    expect(line?.blockedReason).toBe('Missing documentation.')
  })
})

describe('getBlockedLineForShift', () => {
  it('returns the blocked line for a shift and null when unblocked', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_blocked_line_query'
    const adminId = 'user_admin_blocked_line'
    const { tenantId } = await seedTenant(t, { clerkOrgId, adminId })

    const blocked = await seedClientWithLine(t, {
      tenantId,
      caregiverId: 'user_cg_blq',
      clientName: 'Jane Doe',
      createdAt: '2026-07-10T12:00:00.000Z',
      blocked: true,
    })
    const clean = await seedClientWithLine(t, {
      tenantId,
      caregiverId: 'user_cg_blq',
      clientName: 'Jane Doe',
      createdAt: '2026-07-11T12:00:00.000Z',
    })

    const found = await asAdmin(t, adminId, clerkOrgId).query(
      api.billing.getBlockedLineForShift,
      { clerkOrgId, shiftId: blocked.shiftId },
    )
    expect(found?._id).toBe(blocked.lineId)
    expect(found?.blockedReason).toBe('Missing documentation.')

    const none = await asAdmin(t, adminId, clerkOrgId).query(
      api.billing.getBlockedLineForShift,
      { clerkOrgId, shiftId: clean.shiftId },
    )
    expect(none).toBeNull()
  })
})

describe('invoice status lifecycle', () => {
  async function seedInvoice(
    t: ReturnType<typeof createTestConvex>,
    tenantId: Id<'tenants'>,
  ) {
    return t.run(async (ctx) =>
      ctx.db.insert('exportBatches', {
        tenantId,
        name: 'Lifecycle Invoice',
        exportedAt: new Date().toISOString(),
        exportedBy: 'user_admin_lifecycle',
      }),
    )
  }

  it('allows draft -> sent -> paid and sent -> void', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_billing_lifecycle'
    const adminId = 'user_admin_lifecycle'
    const { tenantId } = await seedTenant(t, { clerkOrgId, adminId })

    const invoiceId = await seedInvoice(t, tenantId)
    const admin = asAdmin(t, adminId, clerkOrgId)

    await admin.mutation(api.billing.markInvoiceSent, { clerkOrgId, invoiceId })
    let invoice = await t.run(async (ctx) => ctx.db.get(invoiceId))
    expect(invoice?.status).toBe('sent')

    await admin.mutation(api.billing.markInvoicePaid, { clerkOrgId, invoiceId })
    invoice = await t.run(async (ctx) => ctx.db.get(invoiceId))
    expect(invoice?.status).toBe('paid')

    const secondInvoiceId = await seedInvoice(t, tenantId)
    await admin.mutation(api.billing.markInvoiceSent, {
      clerkOrgId,
      invoiceId: secondInvoiceId,
    })
    await admin.mutation(api.billing.voidInvoice, {
      clerkOrgId,
      invoiceId: secondInvoiceId,
    })
    const secondInvoice = await t.run(async (ctx) => ctx.db.get(secondInvoiceId))
    expect(secondInvoice?.status).toBe('void')

    const auditEvents = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(
      auditEvents.filter((event) => event.action === 'invoice_status_changed'),
    ).toHaveLength(4)
  })

  it('rejects transitions out of terminal statuses', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_billing_terminal'
    const adminId = 'user_admin_terminal'
    const { tenantId } = await seedTenant(t, { clerkOrgId, adminId })

    const invoiceId = await seedInvoice(t, tenantId)
    const admin = asAdmin(t, adminId, clerkOrgId)

    await admin.mutation(api.billing.markInvoiceSent, { clerkOrgId, invoiceId })
    await admin.mutation(api.billing.markInvoicePaid, { clerkOrgId, invoiceId })

    await expect(
      admin.mutation(api.billing.voidInvoice, { clerkOrgId, invoiceId }),
    ).rejects.toThrow()
    await expect(
      admin.mutation(api.billing.markInvoiceSent, { clerkOrgId, invoiceId }),
    ).rejects.toThrow()

    const invoice = await t.run(async (ctx) => ctx.db.get(invoiceId))
    expect(invoice?.status).toBe('paid')
  })
})

describe('pay periods and exportPayroll', () => {
  it('rejects overlapping open pay periods', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_billing_periods'
    const adminId = 'user_admin_periods'
    await seedTenant(t, { clerkOrgId, adminId })
    const admin = asAdmin(t, adminId, clerkOrgId)

    await admin.mutation(api.billing.createPayPeriod, {
      clerkOrgId,
      startDate: '2026-07-01T00:00:00.000Z',
      endDate: '2026-07-15T23:59:59.999Z',
    })

    await expect(
      admin.mutation(api.billing.createPayPeriod, {
        clerkOrgId,
        startDate: '2026-07-10T00:00:00.000Z',
        endDate: '2026-07-25T23:59:59.999Z',
      }),
    ).rejects.toThrow()

    const disjoint = await admin.mutation(api.billing.createPayPeriod, {
      clerkOrgId,
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-08-15T23:59:59.999Z',
    })
    expect(disjoint).toBeDefined()
  })

  it('falls back to CSV export without ADP and blocks re-export', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_billing_payroll'
    const adminId = 'user_admin_payroll'
    const caregiverId = 'user_cg_payroll'
    const { tenantId } = await seedTenant(t, { clerkOrgId, adminId })

    const { shiftId } = await t.run(async (ctx) => {
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: caregiverId,
        role: 'org:caregiver',
        displayName: 'Caregiver One',
        email: 'caregiver@example.com',
      })

      const clientId = await ctx.db.insert('clients', {
        tenantId,
        displayName: 'Jane Doe',
        serviceType: 'SLS',
        authorizationHours: 100,
        riskFlags: [],
      })

      const shiftId = await ctx.db.insert('shifts', {
        tenantId,
        clientId,
        caregiverId,
        scheduledStart: '2026-07-10T08:00:00.000Z',
        scheduledEnd: '2026-07-10T16:00:00.000Z',
        status: 'approved',
        serviceType: 'SLS',
        rate: 25,
      })

      return { shiftId }
    })

    await t.run(async (ctx) => {
      await ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_in',
        at: '2026-07-10T08:00:00.000Z',
        source: 'atriax',
        adpSyncStatus: 'synced',
        createdAt: '2026-07-10T08:00:00.000Z',
      })
      await ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_out',
        at: '2026-07-10T16:00:00.000Z',
        source: 'atriax',
        adpSyncStatus: 'synced',
        createdAt: '2026-07-10T16:00:00.000Z',
      })
    })

    const admin = asAdmin(t, adminId, clerkOrgId)
    const payPeriodId = await admin.mutation(api.billing.createPayPeriod, {
      clerkOrgId,
      startDate: '2026-07-01T00:00:00.000Z',
      endDate: '2026-07-31T23:59:59.999Z',
    })

    const result = await admin.action(api.billing.exportPayroll, {
      clerkOrgId,
      payPeriodId,
    })
    expect(result.status).toBe('exported')
    expect(result.path).toBe('csv')
    expect(result.caregiverCount).toBe(1)

    const period = await t.run(async (ctx) => ctx.db.get(payPeriodId))
    expect(period?.status).toBe('exported')
    expect(period?.exportedAt).toBeDefined()
    expect(period?.exportedBy).toBe(adminId)

    const auditEvents = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    const csvAudit = auditEvents.find(
      (event) => event.action === 'payroll_exported_csv',
    )
    expect(csvAudit).toBeDefined()
    const csv = csvAudit?.metadata?.csv as string
    expect(csv).toContain('caregiver_id,caregiver_name,hours')
    expect(csv).toContain(`${caregiverId},Caregiver One,8.00`)

    await expect(
      admin.action(api.billing.exportPayroll, { clerkOrgId, payPeriodId }),
    ).rejects.toThrow()
  })

  it('includes punches on the final day of a date-only pay period', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_billing_payroll_boundary'
    const adminId = 'user_admin_payroll_boundary'
    const caregiverId = 'user_cg_payroll_boundary'
    const { tenantId } = await seedTenant(t, { clerkOrgId, adminId })

    const { shiftId } = await t.run(async (ctx) => {
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: caregiverId,
        role: 'org:caregiver',
        displayName: 'Caregiver Two',
        email: 'caregiver2@example.com',
      })

      const clientId = await ctx.db.insert('clients', {
        tenantId,
        displayName: 'Jane Doe',
        serviceType: 'SLS',
        authorizationHours: 100,
        riskFlags: [],
      })

      const shiftId = await ctx.db.insert('shifts', {
        tenantId,
        clientId,
        caregiverId,
        scheduledStart: '2026-07-15T08:00:00.000Z',
        scheduledEnd: '2026-07-15T12:00:00.000Z',
        status: 'approved',
        serviceType: 'SLS',
        rate: 25,
      })

      return { shiftId }
    })

    await t.run(async (ctx) => {
      await ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_in',
        at: '2026-07-15T08:00:00.000Z',
        source: 'atriax',
        adpSyncStatus: 'synced',
        createdAt: '2026-07-15T08:00:00.000Z',
      })
      await ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_out',
        at: '2026-07-15T12:00:00.000Z',
        source: 'atriax',
        adpSyncStatus: 'synced',
        createdAt: '2026-07-15T12:00:00.000Z',
      })
    })

    // The UI sends date-only bounds (YYYY-MM-DD) from USDateInput.
    const admin = asAdmin(t, adminId, clerkOrgId)
    const payPeriodId = await admin.mutation(api.billing.createPayPeriod, {
      clerkOrgId,
      startDate: '2026-07-01',
      endDate: '2026-07-15',
    })

    const result = await admin.action(api.billing.exportPayroll, {
      clerkOrgId,
      payPeriodId,
    })
    expect(result.status).toBe('exported')
    expect(result.caregiverCount).toBe(1)

    const auditEvents = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    const csv = auditEvents.find(
      (event) => event.action === 'payroll_exported_csv',
    )?.metadata?.csv as string
    expect(csv).toContain(`${caregiverId},Caregiver Two,4.00`)
  })
})

describe('paymentCalendarData', () => {
  it('returns one consolidated calendar per client with all caregivers', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_payment_calendar'
    const adminId = 'user_admin_cal'
    const { tenantId } = await seedTenant(t, { clerkOrgId, adminId })
    await t.run(async (ctx) => {
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: 'user_cg_cal',
        role: 'org:caregiver',
        displayName: 'Erick Santiago',
        email: 'erick@example.com',
      })
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: 'user_cg_cal_2',
        role: 'org:caregiver',
        displayName: 'Maria Lopez',
        email: 'maria@example.com',
      })
    })
    const { clientId } = await seedClientWithLine(t, {
      tenantId,
      caregiverId: 'user_cg_cal',
      clientName: 'Juanito Gonzalez',
      createdAt: '2026-07-10T18:00:00.000Z',
    })
    // Second caregiver, same client, same day — consolidated into one calendar.
    await t.run(async (ctx) => {
      await ctx.db.insert('shifts', {
        tenantId,
        clientId,
        caregiverId: 'user_cg_cal_2',
        scheduledStart: '2026-07-10T16:00:00.000Z',
        scheduledEnd: '2026-07-10T20:00:00.000Z',
        status: 'billing_ready',
        serviceType: 'SLS',
        rate: 25,
      })
    })

    const data = await asAdmin(t, adminId, clerkOrgId).query(
      api.billing.paymentCalendarData,
      {
        clerkOrgId,
        clientId,
        month: '2026-07',
      },
    )
    expect(data.clientName).toBe('Juanito Gonzalez')
    expect(data.caregiverNames).toEqual(['Erick Santiago', 'Maria Lopez'])
    expect(data.days).toHaveLength(2)
    expect(data.days[0].date).toBe('2026-07-10')
    expect(data.days[0].hours).toBe(8)
    expect(data.days[0].caregiverName).toBe('Erick Santiago')
    expect(data.days[0].caregiverInitials).toBe('ES')
    expect(data.days[1].hours).toBe(4)
    expect(data.days[1].caregiverName).toBe('Maria Lopez')
    expect(data.days[1].caregiverInitials).toBe('ML')
  })
})

describe('updateInvoicePeriod', () => {
  it('edits draft invoice dates, rejects paid invoices and bad ranges', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_invoice_dates'
    const adminId = 'user_admin_inv'
    const { tenantId } = await seedTenant(t, { clerkOrgId, adminId })
    const { lineId } = await seedClientWithLine(t, {
      tenantId,
      caregiverId: 'user_cg_inv',
      clientName: 'Client',
      createdAt: '2026-07-10T18:00:00.000Z',
    })

    const invoiceId = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.billing.createInvoice,
      { clerkOrgId, name: 'July', lineIds: [lineId] },
    )

    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.billing.updateInvoicePeriod,
      { clerkOrgId, invoiceId, periodStart: '2026-07-01', periodEnd: '2026-07-31' },
    )
    const invoice = await t.run(async (ctx) => ctx.db.get(invoiceId))
    expect(invoice?.periodStart).toBe('2026-07-01')
    expect(invoice?.periodEnd).toBe('2026-07-31')

    await expect(
      asAdmin(t, adminId, clerkOrgId).mutation(api.billing.updateInvoicePeriod, {
        clerkOrgId,
        invoiceId,
        periodStart: '2026-07-31',
        periodEnd: '2026-07-01',
      }),
    ).rejects.toThrow(/valid period/)
  })
})

describe('createInvoice per-client guard', () => {
  it('rejects mixing lines from different clients into one invoice', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_invoice_guard'
    const adminId = 'user_admin_guard'
    const { tenantId } = await seedTenant(t, { clerkOrgId, adminId })

    const doe = await seedClientWithLine(t, {
      tenantId,
      caregiverId: 'user_cg_guard_1',
      clientName: 'Jane Doe',
      createdAt: '2026-07-10T12:00:00.000Z',
    })
    const smith = await seedClientWithLine(t, {
      tenantId,
      caregiverId: 'user_cg_guard_2',
      clientName: 'Bob Smith',
      createdAt: '2026-07-11T12:00:00.000Z',
    })

    const admin = asAdmin(t, adminId, clerkOrgId)
    await expect(
      admin.mutation(api.billing.createInvoice, {
        clerkOrgId,
        name: 'Mixed clients',
        lineIds: [doe.lineId, smith.lineId],
      }),
    ).rejects.toThrow(/one invoice per client/i)

    // Lines remain uninvoiced after the rejected attempt.
    const doeLine = await t.run(async (ctx) => ctx.db.get(doe.lineId))
    expect(doeLine?.exportBatchId).toBeUndefined()

    // Single-client invoicing still works and stamps the invoice clientId.
    const invoiceId = await admin.mutation(api.billing.createInvoice, {
      clerkOrgId,
      name: 'Doe only',
      lineIds: [doe.lineId],
    })
    const invoice = await t.run(async (ctx) => ctx.db.get(invoiceId))
    expect(invoice?.clientId).toBe(doe.clientId)
  })
})

describe('checkBillingBlocked', () => {
  async function seedShiftForBlockCheck(
    t: ReturnType<typeof createTestConvex>,
    options: {
      tenantId: Id<'tenants'>
      authorizationHours: number
      withNote: boolean
      noteEndTime?: string
    },
  ) {
    return t.run(async (ctx) => {
      const clientId = await ctx.db.insert('clients', {
        tenantId: options.tenantId,
        displayName: 'Block Client',
        serviceType: 'SLS',
        authorizationHours: options.authorizationHours,
        riskFlags: [],
      })
      const shiftId = await ctx.db.insert('shifts', {
        tenantId: options.tenantId,
        clientId,
        caregiverId: 'user_cg_block',
        scheduledStart: '2026-07-10T08:00:00.000Z',
        scheduledEnd: '2026-07-10T12:00:00.000Z',
        status: 'submitted',
        serviceType: 'SLS',
        rate: 25,
      })
      if (options.withNote) {
        await ctx.db.insert('progressNotes', {
          tenantId: options.tenantId,
          shiftId,
          startTime: '08:00',
          endTime: options.noteEndTime ?? '12:00',
          servicesProvided: 'ADL support',
          clientResponse: 'Cooperative',
          narrative: 'Shift completed as planned.',
        })
      }
      return { clientId, shiftId }
    })
  }

  it('blocks when the progress note is missing', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t, {
      clerkOrgId: 'org_block_note',
      adminId: 'user_admin_block_note',
    })
    const { shiftId } = await seedShiftForBlockCheck(t, {
      tenantId,
      authorizationHours: 100,
      withNote: false,
    })

    const result = await t.run(async (ctx) => {
      const shift = (await ctx.db.get(shiftId))!
      return checkBillingBlocked(ctx, tenantId, shift, 4)
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('Missing progress note.')
  })

  it('blocks when the progress note is incomplete', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t, {
      clerkOrgId: 'org_block_incomplete',
      adminId: 'user_admin_block_incomplete',
    })
    const { shiftId } = await seedShiftForBlockCheck(t, {
      tenantId,
      authorizationHours: 100,
      withNote: true,
      noteEndTime: '07:00', // end before start -> invalid documentation
    })

    const result = await t.run(async (ctx) => {
      const shift = (await ctx.db.get(shiftId))!
      return checkBillingBlocked(ctx, tenantId, shift, 4)
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('Progress note is incomplete.')
  })

  it('blocks when worked hours exceed the client approved hours', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t, {
      clerkOrgId: 'org_block_hours',
      adminId: 'user_admin_block_hours',
    })
    // Sark approved 24h; 20h already delivered this month + 8h new = 28h.
    const { shiftId, clientId } = await seedShiftForBlockCheck(t, {
      tenantId,
      authorizationHours: 24,
      withNote: true,
    })
    await t.run(async (ctx) => {
      await ctx.db.insert('shifts', {
        tenantId,
        clientId,
        caregiverId: 'user_cg_block',
        scheduledStart: '2026-07-03T08:00:00.000Z',
        scheduledEnd: '2026-07-03T16:00:00.000Z',
        clockInAt: '2026-07-03T08:00:00.000Z',
        clockOutAt: '2026-07-03T18:00:00.000Z',
        status: 'billing_ready',
        serviceType: 'SLS',
        rate: 25,
      })
      await ctx.db.insert('shifts', {
        tenantId,
        clientId,
        caregiverId: 'user_cg_block',
        scheduledStart: '2026-07-04T08:00:00.000Z',
        scheduledEnd: '2026-07-04T18:00:00.000Z',
        status: 'approved',
        serviceType: 'SLS',
        rate: 25,
      })
    })

    const result = await t.run(async (ctx) => {
      const shift = (await ctx.db.get(shiftId))!
      return checkBillingBlocked(ctx, tenantId, shift, 8)
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('approved hours')
    expect(result.reason).toContain('28h')
    expect(result.reason).toContain('24h')
  })

  it('does not block when hours fit the authorization and the note is complete', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t, {
      clerkOrgId: 'org_block_clean',
      adminId: 'user_admin_block_clean',
    })
    const { shiftId } = await seedShiftForBlockCheck(t, {
      tenantId,
      authorizationHours: 100,
      withNote: true,
    })

    const result = await t.run(async (ctx) => {
      const shift = (await ctx.db.get(shiftId))!
      return checkBillingBlocked(ctx, tenantId, shift, 8)
    })
    expect(result.blocked).toBe(false)
    expect(result.reason).toBeUndefined()
  })
})
