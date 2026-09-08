import { v } from 'convex/values'
import { ConvexError } from 'convex/values'
import { internalQuery } from './_generated/server'
import type { QueryCtx, MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

type BillingCtx = QueryCtx | MutationCtx

export function round2(n: number) {
  return Math.round(n * 100) / 100
}

/**
 * Convert platform invoice line items to Stripe invoiceitem params.
 * Stripe amounts are integer cents (USD * 100), currency is always 'usd'.
 * Stripe rejects `amount` + `quantity` together, so we send the per-unit
 * price (unitAmountCents) and let Stripe compute quantity × unit.
 */
export function toStripeInvoiceItems(
  lineItems: { description: string; quantity: number; unitPrice: number }[],
) {
  return lineItems.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitAmountCents: Math.round(item.unitPrice * 100),
    currency: 'usd',
  }))
}

// Roles that occupy a billable seat. org:candidate is intentionally EXCLUDED —
// candidates have not been hired and do not consume agency capacity.
const SEAT_ROLES = [
  'org:caregiver',
  'org:coordinator',
  'org:admin',
  'org:hr',
] as const

export async function countActiveSeats(
  ctx: BillingCtx,
  tenantId: Id<'tenants'>,
) {
  let seats = 0
  for (const role of SEAT_ROLES) {
    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_role', (q) =>
        q.eq('tenantId', tenantId).eq('role', role),
      )
      .collect()
    seats += members.length
  }
  return seats
}

function currentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
  return { start, end }
}

/**
 * Current usage snapshot for a tenant: active billable seats, total
 * candidates, and shifts scheduled in the current calendar month. Used for
 * soft-limit alerts.
 */
export async function getTenantUsage(ctx: BillingCtx, tenantId: Id<'tenants'>) {
  const { start, end } = currentMonthRange()
  const seats = await countActiveSeats(ctx, tenantId)
  const candidates = await ctx.db
    .query('candidates')
    .withIndex('by_tenant_email', (q) => q.eq('tenantId', tenantId))
    .collect()
  const shifts = await ctx.db
    .query('shifts')
    .withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId))
    .collect()
  return {
    seats,
    candidates: candidates.length,
    shiftsThisMonth: shifts.filter(
      (s) => s.scheduledStart >= start && s.scheduledStart < end,
    ).length,
  }
}

export interface LimitAlert {
  kind: 'seats' | 'candidates' | 'shifts'
  limit: number
  usage: number
}

/**
 * Pure soft-limit check: compares current usage against the tenant's
 * configured limits plus the plan's optional seat alertThreshold. Reaching a
 * limit (usage >= limit) is a breach — warnings only, never blocks. A plan
 * alertThreshold acts as an additional seat limit.
 */
export function computeLimitAlerts(args: {
  limits?: {
    maxSeats?: number
    maxCandidates?: number
    maxShiftsPerMonth?: number
  } | null
  alertThreshold?: number
  usage: { seats: number; candidates: number; shiftsThisMonth: number }
}): LimitAlert[] {
  const alerts: LimitAlert[] = []
  const { limits, alertThreshold, usage } = args
  const seatLimits = [limits?.maxSeats, alertThreshold].filter(
    (n): n is number => n !== undefined,
  )
  const breachedSeatLimits = seatLimits.filter((l) => usage.seats >= l)
  if (breachedSeatLimits.length > 0) {
    alerts.push({
      kind: 'seats',
      limit: Math.min(...breachedSeatLimits),
      usage: usage.seats,
    })
  }
  if (
    limits?.maxCandidates !== undefined &&
    usage.candidates >= limits.maxCandidates
  ) {
    alerts.push({
      kind: 'candidates',
      limit: limits.maxCandidates,
      usage: usage.candidates,
    })
  }
  if (
    limits?.maxShiftsPerMonth !== undefined &&
    usage.shiftsThisMonth >= limits.maxShiftsPerMonth
  ) {
    alerts.push({
      kind: 'shifts',
      limit: limits.maxShiftsPerMonth,
      usage: usage.shiftsThisMonth,
    })
  }
  return alerts
}

/**
 * DB-backed wrapper: resolves the tenant's limits + plan alertThreshold and
 * the current usage, then runs the pure computeLimitAlerts check.
 */
export async function computeTenantLimitAlerts(
  ctx: BillingCtx,
  tenantId: Id<'tenants'>,
) {
  const tenant = await ctx.db.get(tenantId)
  if (!tenant) return []
  const subscription = await ctx.db
    .query('tenantSubscriptions')
    .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
    .unique()
  const plan = subscription
    ? await ctx.db
        .query('pricingPlans')
        .withIndex('by_key', (q) => q.eq('key', subscription.planKey))
        .unique()
    : null
  const usage = await getTenantUsage(ctx, tenantId)
  return computeLimitAlerts({
    limits: tenant.limits,
    alertThreshold: plan?.alertThreshold,
    usage,
  })
}

/**
 * Core auto-calculation for platform invoices. Branches on the plan's pricing
 * model (absent model = 'flat', the legacy behavior):
 *
 * - flat: base plan price plus a per-seat overage for active seats beyond the
 *   plan's included seats.
 * - per_item: period usage counts (candidates created, shifts scheduled,
 *   applications submitted) × the plan's per-item rates. Only rates that are
 *   set AND have usage > 0 produce lines.
 * - tiered: one line item priced by the first tier whose upTo >= active seat
 *   count (last tier is the catch-all). No per-seat overage on top.
 *
 * NOTE: an SMS usage line item is intentionally NOT implemented — the repo has
 * no SMS usage tracking to meter against, so there is nothing to bill.
 */
export async function computeInvoiceLineItems(
  ctx: BillingCtx,
  tenantId: Id<'tenants'>,
  period?: { start: string; end: string },
) {
  const subscription = await ctx.db
    .query('tenantSubscriptions')
    .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
    .unique()
  if (!subscription) {
    throw new ConvexError('Tenant has no subscription.')
  }

  const plan = await ctx.db
    .query('pricingPlans')
    .withIndex('by_key', (q) => q.eq('key', subscription.planKey))
    .unique()
  if (!plan || !plan.active) {
    throw new ConvexError('Subscription plan is missing or inactive.')
  }

  const tenant = await ctx.db.get(tenantId)
  const seats = await countActiveSeats(ctx, tenantId)

  const lineItems: {
    description: string
    quantity: number
    unitPrice: number
    amount: number
    source: 'auto' | 'manual'
  }[] = []

  if (plan.model === 'per_item') {
    const { start, end } = period ?? currentMonthRange()
    const rates = plan.perItemRates ?? {}

    if (rates.perCandidate !== undefined) {
      const candidates = await ctx.db
        .query('candidates')
        .withIndex('by_tenant_email', (q) => q.eq('tenantId', tenantId))
        .collect()
      const count = candidates.filter(
        (c) => c.createdAt >= start && c.createdAt < end,
      ).length
      if (count > 0) {
        lineItems.push({
          description: `${count} candidate(s) created × $${rates.perCandidate}/candidate (${plan.label} plan)`,
          quantity: count,
          unitPrice: rates.perCandidate,
          amount: round2(count * rates.perCandidate),
          source: 'auto',
        })
      }
    }

    if (rates.perShift !== undefined) {
      const shifts = await ctx.db
        .query('shifts')
        .withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId))
        .collect()
      const count = shifts.filter(
        (s) => s.scheduledStart >= start && s.scheduledStart < end,
      ).length
      if (count > 0) {
        lineItems.push({
          description: `${count} shift(s) scheduled × $${rates.perShift}/shift (${plan.label} plan)`,
          quantity: count,
          unitPrice: rates.perShift,
          amount: round2(count * rates.perShift),
          source: 'auto',
        })
      }
    }

    if (rates.perApplication !== undefined) {
      const applications = await ctx.db
        .query('applications')
        .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
        .collect()
      const count = applications.filter(
        (a) =>
          a.submittedAt !== undefined &&
          a.submittedAt >= start &&
          a.submittedAt < end,
      ).length
      if (count > 0) {
        lineItems.push({
          description: `${count} application(s) submitted × $${rates.perApplication}/application (${plan.label} plan)`,
          quantity: count,
          unitPrice: rates.perApplication,
          amount: round2(count * rates.perApplication),
          source: 'auto',
        })
      }
    }

    return { lineItems, seats, plan, subscription }
  }

  if (plan.model === 'tiered' && plan.tiers && plan.tiers.length > 0) {
    const tier =
      plan.tiers.find((t) => t.upTo >= seats) ?? plan.tiers[plan.tiers.length - 1]
    lineItems.push({
      description: `${plan.label} plan — tier up to ${tier.upTo} seats (${seats} total active seats)`,
      quantity: 1,
      unitPrice: tier.monthlyPrice,
      amount: round2(tier.monthlyPrice),
      source: 'auto',
    })
    return { lineItems, seats, plan, subscription }
  }

  // Flat model (default): a custom monthly rate on the tenant overrides the
  // plan's base price. Per-seat overage still uses the plan's
  // includedSeats/perSeatPrice. Plans with perSeatPrice 0 (e.g. per-agency
  // pure flat plans created at agency creation) never emit an overage line —
  // a $0/seat line item is never meaningful.
  const basePrice = tenant?.customMonthlyRate ?? plan.basePrice

  lineItems.push({
    description:
      tenant?.customMonthlyRate !== undefined
        ? `Base price (${plan.label} plan, custom rate, includes ${plan.includedSeats} seats)`
        : `Base price (${plan.label} plan, includes ${plan.includedSeats} seats)`,
    quantity: 1,
    unitPrice: basePrice,
    amount: round2(basePrice),
    source: 'auto',
  })

  if (seats > plan.includedSeats && plan.perSeatPrice > 0) {
    const overage = seats - plan.includedSeats
    lineItems.push({
      description: `${overage} additional seat(s) × $${plan.perSeatPrice}/seat (${plan.includedSeats} included in ${plan.label}; ${seats} total active seats)`,
      quantity: overage,
      unitPrice: plan.perSeatPrice,
      amount: round2(overage * plan.perSeatPrice),
      source: 'auto',
    })
  }

  return { lineItems, seats, plan, subscription }
}

/**
 * Invoice number format: PLAT-<currentYear>-<NNNN> (4-digit padded sequence).
 * Sequence starts at (existing invoice count + 1) and loop-increments while a
 * doc with that invoiceNumber already exists (collision-safe).
 */
export async function generateInvoiceNumber(ctx: BillingCtx) {
  const year = new Date().getFullYear()
  const existing = await ctx.db.query('platformInvoices').collect()
  const taken = new Set(existing.map((inv) => inv.invoiceNumber))

  let seq = existing.length + 1
  let invoiceNumber = `PLAT-${year}-${String(seq).padStart(4, '0')}`
  while (taken.has(invoiceNumber)) {
    seq += 1
    invoiceNumber = `PLAT-${year}-${String(seq).padStart(4, '0')}`
  }
  return invoiceNumber
}

/** Thin internal wrapper over computeInvoiceLineItems (used by tests/jobs). */
export const calculateInvoiceLineItems = internalQuery({
  args: {
    tenantId: v.id('tenants'),
    periodStart: v.optional(v.string()),
    periodEnd: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const period =
      args.periodStart && args.periodEnd
        ? { start: args.periodStart, end: args.periodEnd }
        : undefined
    return computeInvoiceLineItems(ctx, args.tenantId, period)
  },
})
