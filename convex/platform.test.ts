import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

const ADMIN = { subject: 'admin_1' }
const NON_ADMIN = { subject: 'user_1' }

async function seedAdmin(t: ReturnType<typeof createTestConvex>) {
  await t.run(async (ctx) => {
    await ctx.db.insert('platformAdmins', {
      clerkUserId: ADMIN.subject,
      createdAt: new Date().toISOString(),
    })
  })
}

async function seedTenant(t: ReturnType<typeof createTestConvex>) {
  return t.run(async (ctx) =>
    ctx.db.insert('tenants', {
      clerkOrgId: 'org_test',
      name: 'Test Agency',
      slug: 'test-agency',
      createdAt: new Date().toISOString(),
    }),
  )
}

async function seedTenantWithStarterSubscription(
  t: ReturnType<typeof createTestConvex>,
  seats = 5,
) {
  const asAdmin = t.withIdentity(ADMIN)
  await asAdmin.mutation(api.platform.seedPricingPlans, {})
  const tenantId = await seedTenant(t)

  await t.run(async (ctx) => {
    for (let i = 0; i < seats; i += 1) {
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: `member_${i}`,
        role: 'org:caregiver',
        displayName: `Member ${i}`,
        email: `member${i}@example.com`,
      })
    }
  })

  await asAdmin.mutation(api.platform.setTenantSubscription, {
    tenantId,
    planKey: 'starter',
    status: 'active',
    billingEmails: ['billing@example.com'],
    currentPeriodStart: '2026-07-01',
    currentPeriodEnd: '2026-07-31',
  })

  return tenantId
}

function createInvoiceArgs(tenantId: Id<'tenants'>) {
  return {
    tenantId,
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    dueDate: '2026-08-15',
    mode: 'auto' as const,
  }
}

describe('platform admin guard', () => {
  it.each([
    ['listTenantsWithUsage', {}],
    ['getPlatformStats', {}],
    ['seedPricingPlans', {}],
  ] as const)('rejects non-admin on %s', async (fn, args) => {
    const t = createTestConvex()
    const asUser = t.withIdentity(NON_ADMIN)

    if (fn === 'seedPricingPlans') {
      await expect(
        asUser.mutation(api.platform[fn], args),
      ).rejects.toThrow(/platform admin access required/i)
    } else {
      await expect(asUser.query(api.platform[fn], args)).rejects.toThrow(
        /platform admin access required/i,
      )
    }
  })

  it('rejects non-admin on createPlatformInvoice', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t)
    const asUser = t.withIdentity(NON_ADMIN)

    await expect(
      asUser.mutation(api.platform.createPlatformInvoice, {
        ...createInvoiceArgs(tenantId),
        mode: 'manual',
        lineItems: [
          { description: 'X', quantity: 1, unitPrice: 10, amount: 10 },
        ],
      }),
    ).rejects.toThrow(/platform admin access required/i)
  })
})

describe('seedPricingPlans', () => {
  it('is idempotent — running twice still yields 3 plans', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)

    const first = await asAdmin.mutation(api.platform.seedPricingPlans, {})
    const second = await asAdmin.mutation(api.platform.seedPricingPlans, {})

    expect(first).toHaveLength(3)
    expect(second).toHaveLength(3)
    expect(second.map((p) => p.key).sort()).toEqual([
      'enterprise',
      'professional',
      'starter',
    ])
  })
})

describe('setTenantSubscription / getTenantSubscription', () => {
  it('round-trips create and update', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    await asAdmin.mutation(api.platform.seedPricingPlans, {})
    const tenantId = await seedTenant(t)

    await asAdmin.mutation(api.platform.setTenantSubscription, {
      tenantId,
      planKey: 'starter',
      status: 'trialing',
      billingEmails: ['a@example.com'],
      currentPeriodStart: '2026-07-01',
      currentPeriodEnd: '2026-07-31',
      trialEndsAt: '2026-07-31',
    })

    const first = await asAdmin.query(api.platform.getTenantSubscription, {
      tenantId,
    })
    expect(first.subscription).toMatchObject({
      planKey: 'starter',
      status: 'trialing',
      trialEndsAt: '2026-07-31',
    })
    expect(first.plan).toMatchObject({ key: 'starter', basePrice: 199 })

    await asAdmin.mutation(api.platform.setTenantSubscription, {
      tenantId,
      planKey: 'professional',
      status: 'active',
      billingEmails: ['b@example.com'],
      currentPeriodStart: '2026-08-01',
      currentPeriodEnd: '2026-08-31',
    })

    const second = await asAdmin.query(api.platform.getTenantSubscription, {
      tenantId,
    })
    expect(second.subscription).toMatchObject({
      planKey: 'professional',
      status: 'active',
      billingEmails: ['b@example.com'],
    })
  })

  it('rejects an unknown planKey', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenant(t)

    await expect(
      asAdmin.mutation(api.platform.setTenantSubscription, {
        tenantId,
        planKey: 'nope',
        status: 'active',
        billingEmails: [],
        currentPeriodStart: '2026-07-01',
        currentPeriodEnd: '2026-07-31',
      }),
    ).rejects.toThrow(/does not exist/i)
  })
})

describe('createPlatformInvoice', () => {
  it('manual mode recomputes amounts and marks source manual', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenant(t)

    const invoiceId = await asAdmin.mutation(
      api.platform.createPlatformInvoice,
      {
        tenantId,
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
        dueDate: '2026-08-15',
        mode: 'manual',
        // amount values below are intentionally wrong — must be recomputed
        lineItems: [
          { description: 'Setup fee', quantity: 1, unitPrice: 50, amount: 0 },
          { description: 'Extra', quantity: 3, unitPrice: 10.5, amount: 0 },
        ],
      },
    )

    const invoice = await asAdmin.query(api.platform.getPlatformInvoice, {
      invoiceId,
    })
    expect(invoice.status).toBe('draft')
    expect(invoice.tenantName).toBe('Test Agency')
    expect(invoice.lineItems[0]).toMatchObject({ amount: 50, source: 'manual' })
    expect(invoice.lineItems[1]).toMatchObject({
      amount: 31.5,
      source: 'manual',
    })
    expect(invoice.subtotal).toBe(81.5)
    expect(invoice.total).toBe(81.5)
  })

  it('auto mode computes line items from seats and plan', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenantWithStarterSubscription(t, 12)

    const invoiceId = await asAdmin.mutation(
      api.platform.createPlatformInvoice,
      createInvoiceArgs(tenantId),
    )

    const invoice = await asAdmin.query(api.platform.getPlatformInvoice, {
      invoiceId,
    })
    expect(invoice.lineItems).toHaveLength(2)
    expect(invoice.total).toBe(239)
    expect(invoice.createdBy).toBe(ADMIN.subject)
  })

  it('sequences invoice numbers PLAT-<year>-0001, -0002', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenantWithStarterSubscription(t)
    const year = new Date().getFullYear()

    const firstId = await asAdmin.mutation(
      api.platform.createPlatformInvoice,
      createInvoiceArgs(tenantId),
    )
    const secondId = await asAdmin.mutation(
      api.platform.createPlatformInvoice,
      {
        ...createInvoiceArgs(tenantId),
        periodStart: '2026-08-01',
        periodEnd: '2026-08-31',
      },
    )

    const first = await asAdmin.query(api.platform.getPlatformInvoice, {
      invoiceId: firstId,
    })
    const second = await asAdmin.query(api.platform.getPlatformInvoice, {
      invoiceId: secondId,
    })
    expect(first.invoiceNumber).toBe(`PLAT-${year}-0001`)
    expect(second.invoiceNumber).toBe(`PLAT-${year}-0002`)
  })

  it('rejects a duplicate non-void invoice for the same period, allows after void', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenantWithStarterSubscription(t)

    const invoiceId = await asAdmin.mutation(
      api.platform.createPlatformInvoice,
      createInvoiceArgs(tenantId),
    )

    await expect(
      asAdmin.mutation(
        api.platform.createPlatformInvoice,
        createInvoiceArgs(tenantId),
      ),
    ).rejects.toThrow(/already exists/i)

    await asAdmin.mutation(api.platform.voidInvoice, { invoiceId })

    const secondId = await asAdmin.mutation(
      api.platform.createPlatformInvoice,
      createInvoiceArgs(tenantId),
    )
    expect(secondId).toBeDefined()
  })
})

describe('invoice lifecycle', () => {
  async function createDraft(
    t: ReturnType<typeof createTestConvex>,
    tenantId: Id<'tenants'>,
  ) {
    const asAdmin = t.withIdentity(ADMIN)
    return asAdmin.mutation(
      api.platform.createPlatformInvoice,
      createInvoiceArgs(tenantId),
    )
  }

  it('moves draft → sent → paid', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenantWithStarterSubscription(t)
    const invoiceId = await createDraft(t, tenantId)

    await asAdmin.mutation(api.platform.sendPlatformInvoice, { invoiceId })
    let invoice = await asAdmin.query(api.platform.getPlatformInvoice, {
      invoiceId,
    })
    expect(invoice.status).toBe('sent')
    expect(invoice.sentTo).toEqual(['billing@example.com'])
    expect(invoice.sentAt).toBeDefined()

    await asAdmin.mutation(api.platform.markInvoicePaid, { invoiceId })
    invoice = await asAdmin.query(api.platform.getPlatformInvoice, {
      invoiceId,
    })
    expect(invoice.status).toBe('paid')
    expect(invoice.paidAt).toBeDefined()
  })

  it('voids from draft', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenantWithStarterSubscription(t)
    const invoiceId = await createDraft(t, tenantId)

    await asAdmin.mutation(api.platform.voidInvoice, { invoiceId })
    const invoice = await asAdmin.query(api.platform.getPlatformInvoice, {
      invoiceId,
    })
    expect(invoice.status).toBe('void')
  })

  it('rejects void from paid', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenantWithStarterSubscription(t)
    const invoiceId = await createDraft(t, tenantId)

    await asAdmin.mutation(api.platform.sendPlatformInvoice, { invoiceId })
    await asAdmin.mutation(api.platform.markInvoicePaid, { invoiceId })

    await expect(
      asAdmin.mutation(api.platform.voidInvoice, { invoiceId }),
    ).rejects.toThrow(/cannot void/i)
  })

  it('rejects markInvoicePaid from draft', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenantWithStarterSubscription(t)
    const invoiceId = await createDraft(t, tenantId)

    await expect(
      asAdmin.mutation(api.platform.markInvoicePaid, { invoiceId }),
    ).rejects.toThrow(/cannot mark/i)
  })

  it('rejects sending a paid invoice', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenantWithStarterSubscription(t)
    const invoiceId = await createDraft(t, tenantId)

    await asAdmin.mutation(api.platform.sendPlatformInvoice, { invoiceId })
    await asAdmin.mutation(api.platform.markInvoicePaid, { invoiceId })

    await expect(
      asAdmin.mutation(api.platform.sendPlatformInvoice, { invoiceId }),
    ).rejects.toThrow(/cannot send/i)
  })
})

describe('updatePlatformInvoice', () => {
  it('updates a draft and recomputes totals, preserving source', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenantWithStarterSubscription(t)
    const invoiceId = await asAdmin.mutation(
      api.platform.createPlatformInvoice,
      createInvoiceArgs(tenantId),
    )

    await asAdmin.mutation(api.platform.updatePlatformInvoice, {
      invoiceId,
      lineItems: [
        {
          description: 'Custom line',
          quantity: 2,
          unitPrice: 100,
          amount: 0,
          source: 'manual',
        },
      ],
      dueDate: '2026-09-01',
      notes: 'Adjusted',
    })

    const invoice = await asAdmin.query(api.platform.getPlatformInvoice, {
      invoiceId,
    })
    expect(invoice.lineItems).toHaveLength(1)
    expect(invoice.lineItems[0]).toMatchObject({
      amount: 200,
      source: 'manual',
    })
    expect(invoice.total).toBe(200)
    expect(invoice.dueDate).toBe('2026-09-01')
    expect(invoice.notes).toBe('Adjusted')
  })

  it('rejects updates after the invoice is sent', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenantWithStarterSubscription(t)
    const invoiceId = await asAdmin.mutation(
      api.platform.createPlatformInvoice,
      createInvoiceArgs(tenantId),
    )

    await asAdmin.mutation(api.platform.sendPlatformInvoice, { invoiceId })

    await expect(
      asAdmin.mutation(api.platform.updatePlatformInvoice, {
        invoiceId,
        lineItems: [
          {
            description: 'Nope',
            quantity: 1,
            unitPrice: 1,
            amount: 1,
            source: 'manual',
          },
        ],
      }),
    ).rejects.toThrow(/draft/i)
  })
})

describe('listTenantsWithUsage / getPlatformStats', () => {
  it('returns usage and stats for admin', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenantWithStarterSubscription(t, 7)

    const rows = await asAdmin.query(api.platform.listTenantsWithUsage, {})
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      _id: tenantId,
      name: 'Test Agency',
      memberCount: 7,
      seatCount: 7,
      mrr: 199,
    })
    expect(rows[0].subscription).toMatchObject({ planKey: 'starter' })

    const stats = await asAdmin.query(api.platform.getPlatformStats, {})
    expect(stats).toMatchObject({
      totalAgencies: 1,
      activeCount: 1,
      trialingCount: 0,
      mrr: 199,
      newThisMonth: 1,
    })
  })
})

describe('updateTenantInfo', () => {
  it('updates provided fields only and records an audit event', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenant(t)

    await asAdmin.mutation(api.platform.updateTenantInfo, {
      tenantId,
      name: 'Renamed Agency',
      ein: '12-3456789',
    })

    const tenant = await t.run((ctx) => ctx.db.get(tenantId))
    expect(tenant).toMatchObject({
      name: 'Renamed Agency',
      slug: 'test-agency',
      ein: '12-3456789',
    })

    const audit = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(audit.some((e) => e.action === 'tenant_updated')).toBe(true)
  })

  it('rejects non-admin', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t)
    const asUser = t.withIdentity(NON_ADMIN)

    await expect(
      asUser.mutation(api.platform.updateTenantInfo, {
        tenantId,
        name: 'Nope',
      }),
    ).rejects.toThrow(/platform admin access required/i)
  })

  it('throws when the tenant does not exist', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const fakeTenantId = await seedTenant(t)

    await asAdmin.mutation(api.platform.updateTenantInfo, {
      tenantId: fakeTenantId,
      name: 'Still fine',
    })
    const otherTenantId = await t.run(async (ctx) => {
      const id = await ctx.db.insert('tenants', {
        clerkOrgId: 'org_temp',
        name: 'Temp',
        slug: 'temp',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.delete(id)
      return id
    })

    await expect(
      asAdmin.mutation(api.platform.updateTenantInfo, {
        tenantId: otherTenantId,
        name: 'Nope',
      }),
    ).rejects.toThrow(/tenant not found/i)
  })
})

describe('setTenantCustomRate', () => {
  it('sets and clears the custom monthly rate', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenant(t)

    await asAdmin.mutation(api.platform.setTenantCustomRate, {
      tenantId,
      customRate: 350,
    })
    let tenant = await t.run((ctx) => ctx.db.get(tenantId))
    expect(tenant?.customMonthlyRate).toBe(350)

    await asAdmin.mutation(api.platform.setTenantCustomRate, {
      tenantId,
      customRate: null,
    })
    tenant = await t.run((ctx) => ctx.db.get(tenantId))
    expect(tenant?.customMonthlyRate).toBeUndefined()

    const audit = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(
      audit.filter((e) => e.action === 'tenant_custom_rate_updated'),
    ).toHaveLength(2)
  })

  it('rejects non-admin', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t)
    const asUser = t.withIdentity(NON_ADMIN)

    await expect(
      asUser.mutation(api.platform.setTenantCustomRate, {
        tenantId,
        customRate: 350,
      }),
    ).rejects.toThrow(/platform admin access required/i)
  })
})

describe('setTenantLimits', () => {
  it('sets and clears tenant limits', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenant(t)

    await asAdmin.mutation(api.platform.setTenantLimits, {
      tenantId,
      limits: { maxSeats: 25, maxCandidates: 100, maxShiftsPerMonth: 400 },
    })
    let tenant = await t.run((ctx) => ctx.db.get(tenantId))
    expect(tenant?.limits).toEqual({
      maxSeats: 25,
      maxCandidates: 100,
      maxShiftsPerMonth: 400,
    })

    await asAdmin.mutation(api.platform.setTenantLimits, {
      tenantId,
      limits: { maxSeats: 30 },
    })
    tenant = await t.run((ctx) => ctx.db.get(tenantId))
    expect(tenant?.limits).toEqual({ maxSeats: 30 })

    await asAdmin.mutation(api.platform.setTenantLimits, {
      tenantId,
      limits: null,
    })
    tenant = await t.run((ctx) => ctx.db.get(tenantId))
    expect(tenant?.limits).toBeUndefined()
  })

  it('rejects non-admin', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t)
    const asUser = t.withIdentity(NON_ADMIN)

    await expect(
      asUser.mutation(api.platform.setTenantLimits, {
        tenantId,
        limits: { maxSeats: 10 },
      }),
    ).rejects.toThrow(/platform admin access required/i)
  })
})

describe('listTenantMembers / updateTenantMemberRole', () => {
  it('lists members and updates a member role', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenantWithStarterSubscription(t, 3)

    const members = await asAdmin.query(api.platform.listTenantMembers, {
      tenantId,
    })
    expect(members).toHaveLength(3)
    expect(members[0]).toMatchObject({
      clerkUserId: 'member_0',
      role: 'org:caregiver',
    })

    await asAdmin.mutation(api.platform.updateTenantMemberRole, {
      tenantId,
      clerkUserId: 'member_0',
      role: 'org:coordinator',
    })

    const updated = await asAdmin.query(api.platform.listTenantMembers, {
      tenantId,
    })
    expect(updated.find((m) => m.clerkUserId === 'member_0')?.role).toBe(
      'org:coordinator',
    )

    await expect(
      asAdmin.mutation(api.platform.updateTenantMemberRole, {
        tenantId,
        clerkUserId: 'missing_user',
        role: 'org:hr',
      }),
    ).rejects.toThrow(/member not found/i)
  })
})
