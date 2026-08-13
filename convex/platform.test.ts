import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api, internal } from './_generated/api'
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

describe('setTenantProduct', () => {
  it('activates and deactivates a product for a tenant', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenant(t)

    await asAdmin.mutation(api.platform.setTenantProduct, {
      tenantId,
      productKey: 'full_platform',
      active: true,
    })
    let rows = await t.run(async (ctx) =>
      ctx.db
        .query('agencyProducts')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      productKey: 'full_platform',
      active: true,
    })

    await asAdmin.mutation(api.platform.setTenantProduct, {
      tenantId,
      productKey: 'full_platform',
      active: false,
    })
    rows = await t.run(async (ctx) =>
      ctx.db
        .query('agencyProducts')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].active).toBe(false)
  })

  it('rejects non-admin', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t)
    const asUser = t.withIdentity(NON_ADMIN)

    await expect(
      asUser.mutation(api.platform.setTenantProduct, {
        tenantId,
        productKey: 'full_platform',
        active: true,
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

describe('listTenantMembers', () => {
  it('lists members for a tenant', async () => {
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
  })
})

describe('disabled platform user management', () => {
  it('createUserForTenant throws for platform admins', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenant(t)

    await expect(
      asAdmin.action(api.platform.createUserForTenant, {
        tenantId,
        email: 'new@example.com',
        displayName: 'New User',
        role: 'org:caregiver',
      }),
    ).rejects.toThrow(/platform user management is disabled/i)
  })

  it('removeUserFromTenant throws for platform admins', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenant(t)

    await expect(
      asAdmin.action(api.platform.removeUserFromTenant, {
        tenantId,
        clerkUserId: 'member_0',
      }),
    ).rejects.toThrow(/platform user management is disabled/i)
  })

  it('updateTenantMemberRole throws for platform admins', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenantWithStarterSubscription(t, 1)

    await expect(
      asAdmin.mutation(api.platform.updateTenantMemberRole, {
        tenantId,
        clerkUserId: 'member_0',
        role: 'org:coordinator',
      }),
    ).rejects.toThrow(/platform user management is disabled/i)
  })

  it('still rejects non-admins before the disabled guard', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t)
    const asUser = t.withIdentity(NON_ADMIN)

    await expect(
      asUser.mutation(api.platform.updateTenantMemberRole, {
        tenantId,
        clerkUserId: 'member_0',
        role: 'org:hr',
      }),
    ).rejects.toThrow(/platform admin access required/i)
  })
})

describe('upsertPricingPlan — pricing model fields', () => {
  it('persists model, perItemRates, tiers, and alertThreshold', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)

    await asAdmin.mutation(api.platform.upsertPricingPlan, {
      key: 'usage',
      label: 'Usage Based',
      basePrice: 0,
      includedSeats: 0,
      perSeatPrice: 0,
      active: true,
      model: 'per_item',
      perItemRates: { perCandidate: 50, perShift: 2, perApplication: 25 },
      alertThreshold: 40,
    })

    let plans = await asAdmin.query(api.platform.getPricingPlans, {})
    let plan = plans.find((p) => p.key === 'usage')
    expect(plan).toMatchObject({
      model: 'per_item',
      perItemRates: { perCandidate: 50, perShift: 2, perApplication: 25 },
      alertThreshold: 40,
    })

    await asAdmin.mutation(api.platform.upsertPricingPlan, {
      key: 'tiered-pro',
      label: 'Tiered Pro',
      basePrice: 499,
      includedSeats: 25,
      perSeatPrice: 18,
      active: true,
      model: 'tiered',
      tiers: [
        { upTo: 10, monthlyPrice: 199 },
        { upTo: 25, monthlyPrice: 499 },
      ],
    })

    plans = await asAdmin.query(api.platform.getPricingPlans, {})
    plan = plans.find((p) => p.key === 'tiered-pro')
    expect(plan).toMatchObject({
      model: 'tiered',
      tiers: [
        { upTo: 10, monthlyPrice: 199 },
        { upTo: 25, monthlyPrice: 499 },
      ],
    })
  })

  it('keeps existing model fields when an update omits them', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)

    await asAdmin.mutation(api.platform.upsertPricingPlan, {
      key: 'usage',
      label: 'Usage Based',
      basePrice: 0,
      includedSeats: 0,
      perSeatPrice: 0,
      active: true,
      model: 'per_item',
      perItemRates: { perShift: 2 },
    })
    await asAdmin.mutation(api.platform.upsertPricingPlan, {
      key: 'usage',
      label: 'Usage Based v2',
      basePrice: 0,
      includedSeats: 0,
      perSeatPrice: 0,
      active: true,
    })

    const plans = await asAdmin.query(api.platform.getPricingPlans, {})
    const plan = plans.find((p) => p.key === 'usage')
    expect(plan).toMatchObject({
      label: 'Usage Based v2',
      model: 'per_item',
      perItemRates: { perShift: 2 },
    })
  })

  it('rejects non-admins', async () => {
    const t = createTestConvex()
    const asUser = t.withIdentity(NON_ADMIN)

    await expect(
      asUser.mutation(api.platform.upsertPricingPlan, {
        key: 'usage',
        label: 'Usage Based',
        basePrice: 0,
        includedSeats: 0,
        perSeatPrice: 0,
        active: true,
      }),
    ).rejects.toThrow(/platform admin access required/i)
  })
})

describe('offboardTenant / listChurnedTenants', () => {
  it('sets churn fields, cancels the subscription, and audits', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenantWithStarterSubscription(t)

    await asAdmin.mutation(api.platform.offboardTenant, {
      tenantId,
      reason: 'Switched to a competitor',
    })

    const tenant = await t.run((ctx) => ctx.db.get(tenantId))
    expect(tenant?.churnedAt).toBeDefined()
    expect(tenant?.churnReason).toBe('Switched to a competitor')

    const { subscription } = await asAdmin.query(
      api.platform.getTenantSubscription,
      { tenantId },
    )
    expect(subscription?.status).toBe('canceled')

    const audit = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    const churnEvent = audit.find((e) => e.action === 'tenant_churned')
    expect(churnEvent).toBeDefined()
    expect(churnEvent?.metadata).toMatchObject({
      reason: 'Switched to a competitor',
    })

    const churned = await asAdmin.query(api.platform.listChurnedTenants, {})
    expect(churned).toHaveLength(1)
    expect(churned[0]).toMatchObject({
      tenantId,
      name: 'Test Agency',
      slug: 'test-agency',
      churnReason: 'Switched to a competitor',
    })

    const stats = await asAdmin.query(api.platform.getPlatformStats, {})
    expect(stats.churnedCount).toBe(1)
  })

  it('works without a reason and without a subscription', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenant(t)

    await asAdmin.mutation(api.platform.offboardTenant, { tenantId })

    const churned = await asAdmin.query(api.platform.listChurnedTenants, {})
    expect(churned).toHaveLength(1)
    expect(churned[0].churnReason).toBeNull()
    expect(churned[0].churnedAt).toBeDefined()
  })

  it('rejects non-admins', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t)
    const asUser = t.withIdentity(NON_ADMIN)

    await expect(
      asUser.mutation(api.platform.offboardTenant, { tenantId }),
    ).rejects.toThrow(/platform admin access required/i)
  })
})

describe('tenant health — technical signals + limit alerts only', () => {
  async function seedBreachingTenant(t: ReturnType<typeof createTestConvex>) {
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenantWithStarterSubscription(t, 3)
    await asAdmin.mutation(api.platform.setTenantLimits, {
      tenantId,
      limits: { maxSeats: 2 },
    })
    return { asAdmin, tenantId }
  }

  it('getTenantHealth returns limit alerts and no HR-case counts', async () => {
    const t = createTestConvex()
    const { asAdmin, tenantId } = await seedBreachingTenant(t)

    const rows = await asAdmin.query(api.platform.getTenantHealth, {})
    expect(rows).toHaveLength(1)
    expect(rows[0].tenantId).toBe(tenantId)
    expect(rows[0]).not.toHaveProperty('complianceAlerts')
    expect(rows[0].limitAlerts).toEqual([
      { kind: 'seats', limit: 2, usage: 3 },
    ])
    expect(rows[0].status).toBe('warning')
  })

  it('getTenantHealthDetail drops openCases and includes limit alerts', async () => {
    const t = createTestConvex()
    const { asAdmin, tenantId } = await seedBreachingTenant(t)

    const detail = await asAdmin.query(api.platform.getTenantHealthDetail, {
      tenantId,
    })
    expect(detail).not.toHaveProperty('openCases')
    expect(detail).toHaveProperty('integrationErrors')
    expect(detail).toHaveProperty('syncErrors')
    expect(detail.limitAlerts).toEqual([{ kind: 'seats', limit: 2, usage: 3 }])
  })

  it('reports no alerts when usage is below the limits', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenantWithStarterSubscription(t, 3)
    await asAdmin.mutation(api.platform.setTenantLimits, {
      tenantId,
      limits: { maxSeats: 10 },
    })

    const rows = await asAdmin.query(api.platform.getTenantHealth, {})
    expect(rows[0].limitAlerts).toEqual([])
    expect(rows[0].status).toBe('healthy')
  })
})

describe('checkLimitAlerts', () => {
  it('notifies agency admins once per tenant + kind + billing period', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenantWithStarterSubscription(t, 1)
    await t.run(async (ctx) => {
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: 'agency_admin',
        role: 'org:admin',
        displayName: 'Agency Admin',
        email: 'admin@example.com',
      })
    })
    await asAdmin.mutation(api.platform.setTenantLimits, {
      tenantId,
      limits: { maxSeats: 2 },
    })

    const first = await t.mutation(internal.platform.checkLimitAlerts, {})
    expect(first).toEqual({ notified: 1 })

    let notifications = await t.run(async (ctx) =>
      ctx.db
        .query('notifications')
        .withIndex('by_tenant_user', (q) =>
          q.eq('tenantId', tenantId).eq('clerkUserId', 'agency_admin'),
        )
        .collect(),
    )
    expect(notifications).toHaveLength(1)
    expect(notifications[0]).toMatchObject({
      type: 'limit_warning',
      read: false,
    })
    expect(notifications[0].metadata).toMatchObject({
      kind: 'seats',
      limit: 2,
      usage: 2,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
    })

    // Second run in the same billing period is deduped.
    const second = await t.mutation(internal.platform.checkLimitAlerts, {})
    expect(second).toEqual({ notified: 0 })
    notifications = await t.run(async (ctx) =>
      ctx.db
        .query('notifications')
        .withIndex('by_tenant_user', (q) =>
          q.eq('tenantId', tenantId).eq('clerkUserId', 'agency_admin'),
        )
        .collect(),
    )
    expect(notifications).toHaveLength(1)
  })

  it('skips churned tenants', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenantWithStarterSubscription(t, 3)
    await asAdmin.mutation(api.platform.setTenantLimits, {
      tenantId,
      limits: { maxSeats: 2 },
    })
    await asAdmin.mutation(api.platform.offboardTenant, { tenantId })

    const result = await t.mutation(internal.platform.checkLimitAlerts, {})
    expect(result).toEqual({ notified: 0 })
  })
})

describe('upsertPricingPlan — tier normalization', () => {
  it('sorts tiers ascending by upTo before storing', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)

    await asAdmin.mutation(api.platform.upsertPricingPlan, {
      key: 'tiered-pro',
      label: 'Tiered Pro',
      basePrice: 499,
      includedSeats: 25,
      perSeatPrice: 18,
      active: true,
      model: 'tiered',
      tiers: [
        { upTo: 25, monthlyPrice: 499 },
        { upTo: 10, monthlyPrice: 199 },
      ],
    })

    const plans = await asAdmin.query(api.platform.getPricingPlans, {})
    const plan = plans.find((p) => p.key === 'tiered-pro')
    expect(plan?.tiers).toEqual([
      { upTo: 10, monthlyPrice: 199 },
      { upTo: 25, monthlyPrice: 499 },
    ])
  })

  it('rejects non-positive tier bounds', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)

    await expect(
      asAdmin.mutation(api.platform.upsertPricingPlan, {
        key: 'tiered-bad',
        label: 'Tiered Bad',
        basePrice: 0,
        includedSeats: 0,
        perSeatPrice: 0,
        active: true,
        model: 'tiered',
        tiers: [{ upTo: 0, monthlyPrice: 100 }],
      }),
    ).rejects.toThrow(/tier bounds/i)
  })
})

describe('offboardTenant — idempotency', () => {
  it('keeps churnedAt and does not duplicate the audit event on repeat calls', async () => {
    const t = createTestConvex()
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    const tenantId = await seedTenantWithStarterSubscription(t)

    await asAdmin.mutation(api.platform.offboardTenant, {
      tenantId,
      reason: 'Switched to a competitor',
    })
    const first = await t.run((ctx) => ctx.db.get(tenantId))

    await new Promise((resolve) => setTimeout(resolve, 5))
    await asAdmin.mutation(api.platform.offboardTenant, {
      tenantId,
      reason: 'Different reason',
    })
    const second = await t.run((ctx) => ctx.db.get(tenantId))

    expect(second?.churnedAt).toBe(first?.churnedAt)
    expect(second?.churnReason).toBe('Switched to a competitor')

    const churnEvents = await t.run(async (ctx) =>
      (
        await ctx.db.query('auditEvents').collect()
      ).filter((e) => e.action === 'tenant_churned'),
    )
    expect(churnEvents).toHaveLength(1)
  })
})

describe('monthly recurring billing (period advancement)', () => {
  /** Last calendar month — a period that has always ended. */
  function endedMonthRange() {
    const now = new Date()
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    )
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    return { start: start.toISOString(), end: end.toISOString() }
  }

  /** The period createMonthlyPlatformInvoice should roll forward to. */
  function expectedNextPeriod(periodEndIso: string) {
    const nextStart = new Date(periodEndIso)
    const nextEnd = new Date(
      Date.UTC(
        nextStart.getUTCFullYear(),
        nextStart.getUTCMonth() + 1,
        nextStart.getUTCDate(),
      ),
    )
    return {
      start: nextStart.toISOString(),
      end: nextEnd.toISOString(),
    }
  }

  async function seedBillableSubscription(
    t: ReturnType<typeof createTestConvex>,
    period: { start: string; end: string },
  ) {
    await seedAdmin(t)
    const asAdmin = t.withIdentity(ADMIN)
    await asAdmin.mutation(api.platform.seedPricingPlans, {})
    const tenantId = await seedTenant(t)
    await t.run(async (ctx) => {
      await ctx.db.insert('tenantSubscriptions', {
        tenantId,
        planKey: 'starter',
        status: 'active',
        billingEmails: ['billing@example.com'],
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        renewsAt: period.end,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    })
    return tenantId
  }

  async function getSubscription(
    t: ReturnType<typeof createTestConvex>,
    tenantId: Id<'tenants'>,
  ) {
    return t.run(async (ctx) =>
      ctx.db
        .query('tenantSubscriptions')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .unique(),
    )
  }

  it('creates the invoice for the ended period and advances the subscription', async () => {
    const t = createTestConvex()
    const period = endedMonthRange()
    const tenantId = await seedBillableSubscription(t, period)

    // The ended period is due: it shows up in the cron feed.
    const due = await t.query(internal.platform.listBillableSubscriptions, {})
    expect(due.map((s) => s.tenantId)).toContain(tenantId)

    const invoice = await t.mutation(
      internal.platform.createMonthlyPlatformInvoice,
      {
        tenantId,
        periodStart: period.start,
        periodEnd: period.end,
        dueDate: period.end.slice(0, 10),
      },
    )
    expect(invoice).not.toBeNull()

    const doc = await t.run((ctx) => ctx.db.get(invoice!.invoiceId))
    expect(doc?.periodStart).toBe(period.start)
    expect(doc?.periodEnd).toBe(period.end)
    expect(doc?.status).toBe('draft')

    const next = expectedNextPeriod(period.end)
    const subscription = await getSubscription(t, tenantId)
    expect(subscription?.currentPeriodStart).toBe(next.start)
    expect(subscription?.currentPeriodEnd).toBe(next.end)
    expect(subscription?.renewsAt).toBe(next.end)
  })

  it('same-day re-run skips the subscription (period advanced, duplicate guard)', async () => {
    const t = createTestConvex()
    const period = endedMonthRange()
    const tenantId = await seedBillableSubscription(t, period)

    const first = await t.mutation(
      internal.platform.createMonthlyPlatformInvoice,
      {
        tenantId,
        periodStart: period.start,
        periodEnd: period.end,
        dueDate: period.end.slice(0, 10),
      },
    )
    expect(first).not.toBeNull()

    // The subscription was rolled to the still-running next period, so the
    // cron feed no longer includes it.
    const due = await t.query(internal.platform.listBillableSubscriptions, {})
    expect(due.map((s) => s.tenantId)).not.toContain(tenantId)

    // A stale caller re-using the old period hits the duplicate-period guard.
    const duplicate = await t.mutation(
      internal.platform.createMonthlyPlatformInvoice,
      {
        tenantId,
        periodStart: period.start,
        periodEnd: period.end,
        dueDate: period.end.slice(0, 10),
      },
    )
    expect(duplicate).toBeNull()

    const invoices = await t.run(async (ctx) =>
      ctx.db.query('platformInvoices').collect(),
    )
    expect(invoices).toHaveLength(1)
  })

  it('bills the next period on the following month run', async () => {
    const t = createTestConvex()
    const period = endedMonthRange()
    const tenantId = await seedBillableSubscription(t, period)

    const first = await t.mutation(
      internal.platform.createMonthlyPlatformInvoice,
      {
        tenantId,
        periodStart: period.start,
        periodEnd: period.end,
        dueDate: period.end.slice(0, 10),
      },
    )

    // Month 2: the cron reads the (advanced) subscription period.
    const subscription = await getSubscription(t, tenantId)
    const second = await t.mutation(
      internal.platform.createMonthlyPlatformInvoice,
      {
        tenantId,
        periodStart: subscription!.currentPeriodStart,
        periodEnd: subscription!.currentPeriodEnd,
        dueDate: subscription!.currentPeriodEnd.slice(0, 10),
      },
    )
    expect(second).not.toBeNull()
    expect(second!.invoiceNumber).not.toBe(first!.invoiceNumber)

    const invoices = await t.run(async (ctx) =>
      ctx.db.query('platformInvoices').collect(),
    )
    expect(invoices).toHaveLength(2)

    // And the subscription advanced again, contiguously.
    const next = expectedNextPeriod(subscription!.currentPeriodEnd)
    const after = await getSubscription(t, tenantId)
    expect(after?.currentPeriodStart).toBe(subscription!.currentPeriodEnd)
    expect(after?.currentPeriodEnd).toBe(next.end)
  })

  it('does not clobber a manually changed period', async () => {
    const t = createTestConvex()
    const period = endedMonthRange()
    const tenantId = await seedBillableSubscription(t, period)

    // Admin manually moves the subscription to a different period before the
    // cron mutation for the old period lands.
    const asAdmin = t.withIdentity(ADMIN)
    await asAdmin.mutation(api.platform.setTenantSubscription, {
      tenantId,
      planKey: 'starter',
      status: 'active',
      billingEmails: ['billing@example.com'],
      currentPeriodStart: '2030-01-01',
      currentPeriodEnd: '2030-02-01',
    })

    const invoice = await t.mutation(
      internal.platform.createMonthlyPlatformInvoice,
      {
        tenantId,
        periodStart: period.start,
        periodEnd: period.end,
        dueDate: period.end.slice(0, 10),
      },
    )
    expect(invoice).not.toBeNull()

    const subscription = await getSubscription(t, tenantId)
    expect(subscription?.currentPeriodStart).toBe('2030-01-01')
    expect(subscription?.currentPeriodEnd).toBe('2030-02-01')
  })
})
