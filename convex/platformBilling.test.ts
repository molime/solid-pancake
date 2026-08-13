import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { computeLimitAlerts } from './platformBilling'

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
    // Extra pricingPlans fields (model, perItemRates, tiers, alertThreshold)
    // merged into the selected plan.
    planExtras?: Record<string, unknown>
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
        ...(plan.key === (options.planKey ?? 'starter')
          ? (options.planExtras ?? {})
          : {}),
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
  period?: { start: string; end: string },
) {
  return t.query(internal.platformBilling.calculateInvoiceLineItems, {
    tenantId,
    ...(period ? { periodStart: period.start, periodEnd: period.end } : {}),
  })
}

const PERIOD = { start: '2026-07-01', end: '2026-08-01' }

/** Seeds billable-usage rows (candidates/shifts/applications) for a tenant. */
async function seedUsage(
  t: ReturnType<typeof createTestConvex>,
  tenantId: Id<'tenants'>,
  usage: {
    candidates?: string[] // createdAt values
    shifts?: string[] // scheduledStart values
    applications?: string[] // submittedAt values
  },
) {
  return t.run(async (ctx) => {
    for (const createdAt of usage.candidates ?? []) {
      await ctx.db.insert('candidates', {
        tenantId,
        email: `cand-${createdAt}@example.com`,
        displayName: 'Candidate',
        status: 'new',
        createdAt,
      })
    }
    if ((usage.shifts ?? []).length > 0) {
      const clientId = await ctx.db.insert('clients', {
        tenantId,
        displayName: 'Client',
        serviceType: 'SLS',
        authorizationHours: 10,
        riskFlags: [],
      })
      for (const scheduledStart of usage.shifts ?? []) {
        await ctx.db.insert('shifts', {
          tenantId,
          clientId,
          caregiverId: 'caregiver_1',
          scheduledStart,
          scheduledEnd: scheduledStart,
          status: 'scheduled',
          serviceType: 'SLS',
          rate: 20,
        })
      }
    }
    for (const submittedAt of usage.applications ?? []) {
      const candidateId = await ctx.db.insert('candidates', {
        tenantId,
        email: `app-${submittedAt}@example.com`,
        displayName: 'Applicant',
        status: 'new',
        createdAt: '2026-06-15',
      })
      await ctx.db.insert('applications', {
        tenantId,
        candidateId,
        status: 'submitted',
        submittedAt,
      })
    }
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

  it('never emits a $0 overage line for pure flat per-agency plans (perSeatPrice 0)', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenantWithSubscription(t, {
      planKey: 'starter',
      seats: 12,
      // Shape created by the agency-creation form for flat pricing:
      // basePrice = the flat fee, no included seats, no per-seat price.
      planExtras: { basePrice: 1500, includedSeats: 0, perSeatPrice: 0 },
    })

    const result = await calculate(t, tenantId)

    expect(result.lineItems).toHaveLength(1)
    expect(result.lineItems[0]).toMatchObject({
      quantity: 1,
      unitPrice: 1500,
      amount: 1500,
      source: 'auto',
    })
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

describe('computeInvoiceLineItems — per_item model', () => {
  it('bills candidates created in the period × perCandidate rate only', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenantWithSubscription(t, {
      planKey: 'starter',
      planExtras: { model: 'per_item', perItemRates: { perCandidate: 50 } },
    })
    await seedUsage(t, tenantId, {
      candidates: ['2026-07-05', '2026-07-10', '2026-07-20', '2026-06-28'],
      shifts: ['2026-07-05T09:00:00.000Z'],
    })

    const result = await calculate(t, tenantId, PERIOD)

    expect(result.lineItems).toHaveLength(1)
    expect(result.lineItems[0]).toMatchObject({
      quantity: 3,
      unitPrice: 50,
      amount: 150,
      source: 'auto',
    })
    expect(result.lineItems[0].description).toMatch(/candidate/i)
  })

  it('bills shifts and applications alone when only their rates are set', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenantWithSubscription(t, {
      planKey: 'starter',
      planExtras: {
        model: 'per_item',
        perItemRates: { perShift: 2, perApplication: 25 },
      },
    })
    await seedUsage(t, tenantId, {
      candidates: ['2026-07-05'],
      shifts: ['2026-07-05T09:00:00.000Z', '2026-07-06T09:00:00.000Z'],
      applications: ['2026-07-08T12:00:00.000Z'],
    })

    const result = await calculate(t, tenantId, PERIOD)

    expect(result.lineItems).toHaveLength(2)
    expect(result.lineItems[0]).toMatchObject({
      quantity: 2,
      unitPrice: 2,
      amount: 4,
    })
    expect(result.lineItems[1]).toMatchObject({
      quantity: 1,
      unitPrice: 25,
      amount: 25,
    })
  })

  it('combines all three rates into separate line items', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenantWithSubscription(t, {
      planKey: 'starter',
      planExtras: {
        model: 'per_item',
        perItemRates: { perCandidate: 50, perShift: 2, perApplication: 25 },
      },
    })
    await seedUsage(t, tenantId, {
      candidates: ['2026-07-05', '2026-07-10'],
      shifts: [
        '2026-07-05T09:00:00.000Z',
        '2026-07-06T09:00:00.000Z',
        '2026-07-07T09:00:00.000Z',
        '2026-08-02T09:00:00.000Z',
      ],
      applications: ['2026-07-08T12:00:00.000Z'],
    })

    const result = await calculate(t, tenantId, PERIOD)
    const total = result.lineItems.reduce((sum, item) => sum + item.amount, 0)

    expect(result.lineItems).toHaveLength(3)
    // 2 candidates × 50 + 3 in-period shifts × 2 + 1 application × 25
    expect(total).toBe(131)
  })

  it('emits no line items when there is no usage in the period', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenantWithSubscription(t, {
      planKey: 'starter',
      planExtras: {
        model: 'per_item',
        perItemRates: { perCandidate: 50, perShift: 2, perApplication: 25 },
      },
    })
    await seedUsage(t, tenantId, {
      candidates: ['2026-06-28'],
      shifts: ['2026-06-28T09:00:00.000Z'],
    })

    const result = await calculate(t, tenantId, PERIOD)

    expect(result.lineItems).toHaveLength(0)
  })
})

describe('computeInvoiceLineItems — tiered model', () => {
  const TIERS = [
    { upTo: 10, monthlyPrice: 199 },
    { upTo: 25, monthlyPrice: 499 },
    { upTo: 50, monthlyPrice: 999 },
  ]

  it('selects the tier whose upTo equals the seat count exactly', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenantWithSubscription(t, {
      planKey: 'starter',
      seats: 10,
      planExtras: { model: 'tiered', tiers: TIERS },
    })

    const result = await calculate(t, tenantId)

    expect(result.lineItems).toHaveLength(1)
    expect(result.lineItems[0]).toMatchObject({
      quantity: 1,
      unitPrice: 199,
      amount: 199,
      source: 'auto',
    })
  })

  it('selects the first tier that covers the seat count', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenantWithSubscription(t, {
      planKey: 'starter',
      seats: 26,
      planExtras: { model: 'tiered', tiers: TIERS },
    })

    const result = await calculate(t, tenantId)

    expect(result.lineItems).toHaveLength(1)
    expect(result.lineItems[0]).toMatchObject({ unitPrice: 999, amount: 999 })
  })

  it('falls back to the last tier when seats exceed every tier', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenantWithSubscription(t, {
      planKey: 'starter',
      seats: 60,
      planExtras: { model: 'tiered', tiers: TIERS },
    })

    const result = await calculate(t, tenantId)

    expect(result.lineItems).toHaveLength(1)
    expect(result.lineItems[0]).toMatchObject({ unitPrice: 999, amount: 999 })
    expect(result.lineItems[0].description).toMatch(/60 total active seats/)
  })

  it('never adds a per-seat overage line on top of the tier', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenantWithSubscription(t, {
      planKey: 'starter',
      seats: 40,
      planExtras: { model: 'tiered', tiers: TIERS },
    })

    const result = await calculate(t, tenantId)

    expect(result.lineItems).toHaveLength(1)
  })
})

describe('computeLimitAlerts', () => {
  const limits = { maxSeats: 10, maxCandidates: 100, maxShiftsPerMonth: 400 }

  it('returns nothing below every limit', () => {
    expect(
      computeLimitAlerts({
        limits,
        usage: { seats: 9, candidates: 99, shiftsThisMonth: 399 },
      }),
    ).toEqual([])
  })

  it('breaches when usage reaches the limit exactly', () => {
    expect(
      computeLimitAlerts({
        limits,
        usage: { seats: 10, candidates: 100, shiftsThisMonth: 400 },
      }),
    ).toEqual([
      { kind: 'seats', limit: 10, usage: 10 },
      { kind: 'candidates', limit: 100, usage: 100 },
      { kind: 'shifts', limit: 400, usage: 400 },
    ])
  })

  it('breaches above the limit and reports only the breached kinds', () => {
    expect(
      computeLimitAlerts({
        limits,
        usage: { seats: 12, candidates: 50, shiftsThisMonth: 500 },
      }),
    ).toEqual([
      { kind: 'seats', limit: 10, usage: 12 },
      { kind: 'shifts', limit: 400, usage: 500 },
    ])
  })

  it('treats the plan alertThreshold as a seat limit', () => {
    expect(
      computeLimitAlerts({
        alertThreshold: 5,
        usage: { seats: 5, candidates: 0, shiftsThisMonth: 0 },
      }),
    ).toEqual([{ kind: 'seats', limit: 5, usage: 5 }])
    expect(
      computeLimitAlerts({
        alertThreshold: 5,
        usage: { seats: 4, candidates: 0, shiftsThisMonth: 0 },
      }),
    ).toEqual([])
  })

  it('treats the plan alertThreshold as an additional seat limit alongside maxSeats', () => {
    // Both configured: the lower breached limit must still alert even when
    // tenant maxSeats is set (regression: ?? used to drop alertThreshold).
    expect(
      computeLimitAlerts({
        limits: { maxSeats: 100 },
        alertThreshold: 50,
        usage: { seats: 60, candidates: 0, shiftsThisMonth: 0 },
      }),
    ).toEqual([{ kind: 'seats', limit: 50, usage: 60 }])
    // Below the threshold but above nothing else: no alert.
    expect(
      computeLimitAlerts({
        limits: { maxSeats: 100 },
        alertThreshold: 50,
        usage: { seats: 49, candidates: 0, shiftsThisMonth: 0 },
      }),
    ).toEqual([])
    // Both breached: report the smaller (first-hit) limit.
    expect(
      computeLimitAlerts({
        limits: { maxSeats: 40 },
        alertThreshold: 50,
        usage: { seats: 60, candidates: 0, shiftsThisMonth: 0 },
      }),
    ).toEqual([{ kind: 'seats', limit: 40, usage: 60 }])
  })

  it('returns nothing when no limits are configured', () => {
    expect(
      computeLimitAlerts({
        usage: { seats: 999, candidates: 999, shiftsThisMonth: 999 },
      }),
    ).toEqual([])
  })
})
