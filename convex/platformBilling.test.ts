import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

const PLANS = [
  {
    key: 'starter',
    label: 'Starter',
    basePrice: 199,
    includedSeats: 10,
    perSeatPrice: 20,
    active: true,
  },
  {
    key: 'professional',
    label: 'Professional',
    basePrice: 499,
    includedSeats: 25,
    perSeatPrice: 18,
    active: true,
  },
  {
    key: 'enterprise',
    label: 'Enterprise',
    basePrice: 999,
    includedSeats: 50,
    perSeatPrice: 15,
    active: true,
  },
]

const BILLABLE_ROLES = [
  'org:caregiver',
  'org:coordinator',
  'org:admin',
  'org:hr',
] as const

async function seedTenantWithSubscription(
  t: ReturnType<typeof createTestConvex>,
  options: {
    planKey?: string
    seats?: number
    candidates?: number
    planActive?: boolean
    skipSubscription?: boolean
    customMonthlyRate?: number
  } = {},
) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: 'org_test',
      name: 'Test Agency',
      slug: 'test-agency',
      createdAt: new Date().toISOString(),
      ...(options.customMonthlyRate !== undefined
        ? { customMonthlyRate: options.customMonthlyRate }
        : {}),
    })

    for (const plan of PLANS) {
      await ctx.db.insert('pricingPlans', {
        ...plan,
        active:
          plan.key === (options.planKey ?? 'starter')
            ? (options.planActive ?? true)
            : plan.active,
      })
    }

    const seats = options.seats ?? 0
    for (let i = 0; i < seats; i += 1) {
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: `member_${i}`,
        role: BILLABLE_ROLES[i % BILLABLE_ROLES.length],
        displayName: `Member ${i}`,
        email: `member${i}@example.com`,
      })
    }

    const candidates = options.candidates ?? 0
    for (let i = 0; i < candidates; i += 1) {
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: `candidate_${i}`,
        role: 'org:candidate',
        displayName: `Candidate ${i}`,
        email: `candidate${i}@example.com`,
      })
    }

    if (!options.skipSubscription) {
      const now = new Date().toISOString()
      await ctx.db.insert('tenantSubscriptions', {
        tenantId,
        planKey: options.planKey ?? 'starter',
        status: 'active',
        billingEmails: ['billing@example.com'],
        currentPeriodStart: '2026-07-01',
        currentPeriodEnd: '2026-07-31',
        createdAt: now,
        updatedAt: now,
      })
    }

    return tenantId
  })
}

async function calculate(
  t: ReturnType<typeof createTestConvex>,
  tenantId: Id<'tenants'>,
) {
  return t.query(internal.platformBilling.calculateInvoiceLineItems, {
    tenantId,
  })
}

describe('computeInvoiceLineItems', () => {
  it('returns base-only line item when seats are within included seats', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenantWithSubscription(t, {
      planKey: 'starter',
      seats: 5,
    })

    const result = await calculate(t, tenantId)

    expect(result.seats).toBe(5)
    expect(result.lineItems).toHaveLength(1)
    expect(result.lineItems[0]).toMatchObject({
      quantity: 1,
      unitPrice: 199,
      amount: 199,
      source: 'auto',
    })
  })

  it('computes overage for starter (12 seats = 199 + 2×20 = 239)', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenantWithSubscription(t, {
      planKey: 'starter',
      seats: 12,
    })

    const result = await calculate(t, tenantId)
    const total = result.lineItems.reduce((sum, item) => sum + item.amount, 0)

    expect(result.lineItems).toHaveLength(2)
    expect(result.lineItems[1]).toMatchObject({
      quantity: 2,
      unitPrice: 20,
      amount: 40,
      source: 'auto',
    })
    expect(total).toBe(239)
  })

  it('computes overage for professional (28 seats = 499 + 3×18 = 553)', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenantWithSubscription(t, {
      planKey: 'professional',
      seats: 28,
    })

    const result = await calculate(t, tenantId)
    const total = result.lineItems.reduce((sum, item) => sum + item.amount, 0)

    expect(result.lineItems[1]).toMatchObject({
      quantity: 3,
      unitPrice: 18,
      amount: 54,
    })
    expect(total).toBe(553)
  })

  it('computes overage for enterprise (55 seats = 999 + 5×15 = 1074)', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenantWithSubscription(t, {
      planKey: 'enterprise',
      seats: 55,
    })

    const result = await calculate(t, tenantId)
    const total = result.lineItems.reduce((sum, item) => sum + item.amount, 0)

    expect(result.lineItems[1]).toMatchObject({
      quantity: 5,
      unitPrice: 15,
      amount: 75,
    })
    expect(total).toBe(1074)
  })

  it('excludes org:candidate members from the seat count', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenantWithSubscription(t, {
      planKey: 'starter',
      seats: 8,
      candidates: 10,
    })

    const result = await calculate(t, tenantId)

    expect(result.seats).toBe(8)
    expect(result.lineItems).toHaveLength(1)
  })

  it('custom rate overrides plan base price', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenantWithSubscription(t, {
      planKey: 'starter',
      seats: 5,
      customMonthlyRate: 350,
    })

    const result = await calculate(t, tenantId)

    expect(result.lineItems).toHaveLength(1)
    expect(result.lineItems[0]).toMatchObject({
      quantity: 1,
      unitPrice: 350,
      amount: 350,
      source: 'auto',
    })
    expect(result.lineItems[0].description).toMatch(/custom rate/i)
  })

  it('custom rate with seat overage (12 seats = 350 + 2×20 = 390)', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenantWithSubscription(t, {
      planKey: 'starter',
      seats: 12,
      customMonthlyRate: 350,
    })

    const result = await calculate(t, tenantId)
    const total = result.lineItems.reduce((sum, item) => sum + item.amount, 0)

    expect(result.lineItems).toHaveLength(2)
    expect(result.lineItems[0]).toMatchObject({
      quantity: 1,
      unitPrice: 350,
      amount: 350,
    })
    expect(result.lineItems[1]).toMatchObject({
      quantity: 2,
      unitPrice: 20,
      amount: 40,
      source: 'auto',
    })
    expect(total).toBe(390)
  })

  it('throws when the tenant has no subscription', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenantWithSubscription(t, {
      skipSubscription: true,
    })

    await expect(calculate(t, tenantId)).rejects.toThrow(
      /no subscription/i,
    )
  })

  it('throws when the plan is inactive', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenantWithSubscription(t, {
      planKey: 'starter',
      seats: 5,
      planActive: false,
    })

    await expect(calculate(t, tenantId)).rejects.toThrow(
      /missing or inactive/i,
    )
  })

  it('throws when the plan does not exist', async () => {
    const t = createTestConvex()
    const tenantId = await t.run(async (ctx) => {
      const id = await ctx.db.insert('tenants', {
        clerkOrgId: 'org_test',
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })
      const now = new Date().toISOString()
      await ctx.db.insert('tenantSubscriptions', {
        tenantId: id,
        planKey: 'nonexistent',
        status: 'active',
        billingEmails: [],
        currentPeriodStart: '2026-07-01',
        currentPeriodEnd: '2026-07-31',
        createdAt: now,
        updatedAt: now,
      })
      return id
    })

    await expect(calculate(t, tenantId)).rejects.toThrow(
      /missing or inactive/i,
    )
  })
})
