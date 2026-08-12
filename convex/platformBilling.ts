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

/**
 * Core auto-calculation for platform invoices: base plan price plus a per-seat
 * overage for active seats beyond the plan's included seats.
 *
 * NOTE: an SMS usage line item is intentionally NOT implemented — the repo has
 * no SMS usage tracking to meter against, so there is nothing to bill.
 */
export async function computeInvoiceLineItems(
  ctx: BillingCtx,
  tenantId: Id<'tenants'>,
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

  // A custom monthly rate on the tenant overrides the plan's base price.
  // Per-seat overage still uses the plan's includedSeats/perSeatPrice.
  const basePrice = tenant?.customMonthlyRate ?? plan.basePrice

  const seats = await countActiveSeats(ctx, tenantId)

  const lineItems: {
    description: string
    quantity: number
    unitPrice: number
    amount: number
    source: 'auto' | 'manual'
  }[] = [
    {
      description:
        tenant?.customMonthlyRate !== undefined
          ? `Base price (${plan.label} plan, custom rate, includes ${plan.includedSeats} seats)`
          : `Base price (${plan.label} plan, includes ${plan.includedSeats} seats)`,
      quantity: 1,
      unitPrice: basePrice,
      amount: round2(basePrice),
      source: 'auto',
    },
  ]

  if (seats > plan.includedSeats) {
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
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    return computeInvoiceLineItems(ctx, args.tenantId)
  },
})
