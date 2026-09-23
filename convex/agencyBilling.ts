import { action, query } from './_generated/server'
import { v } from 'convex/values'
import { ConvexError } from 'convex/values'
import { internal } from './_generated/api'
import { requireTenantRole, requireTenantRoleAction } from './authHelpers'

// Agency-facing SaaS billing: lets an agency admin see their own Atria
// subscription and invoices and update their payment method. Everything is
// scoped to the caller's tenant — platform-owner data stays in the platform
// portal.

export const getMySubscription = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, ['org:admin'])
    const subscription = await ctx.db
      .query('tenantSubscriptions')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .unique()
    if (!subscription) return null
    const plan = await ctx.db
      .query('pricingPlans')
      .withIndex('by_key', (q) => q.eq('key', subscription.planKey))
      .unique()
    return { subscription, plan }
  },
})

export const listMyInvoices = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, ['org:admin'])
    const invoices = await ctx.db
      .query('platformInvoices')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
    return invoices
      .filter((invoice) => invoice.status !== 'draft')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((invoice) => ({
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        dueDate: invoice.dueDate,
        total: invoice.total,
        status: invoice.status,
        paidAt: invoice.paidAt ?? null,
        stripeHostedInvoiceUrl: invoice.stripeHostedInvoiceUrl ?? null,
      }))
  },
})

// Hosted Stripe page where the agency attaches or replaces its payment
// method. Creates the Stripe customer on first use (mirrors the ensure-
// customer flow in createAndSendStripeInvoice).
export const createMyPaymentSetupSession = action({
  args: { clerkOrgId: v.string(), origin: v.optional(v.string()) },
  handler: async (ctx, { clerkOrgId, origin }): Promise<{ url: string }> => {
    const { member } = await requireTenantRoleAction(ctx, clerkOrgId, [
      'org:admin',
    ])
    const tenantId = member.tenantId

    const billing = await ctx.runQuery(
      internal.platformStripe.getTenantBillingInternal,
      { tenantId },
    )

    if (!billing.stripeCustomerId) {
      const email = billing.billingEmails[0]
      if (!email) {
        throw new ConvexError(
          'No billing email is set for your agency yet. Please contact Atria support so we can finish setting up your subscription.',
        )
      }
      const customer: { id: string } = await ctx.runAction(
        internal._utils.stripe.createStripeCustomer,
        { name: billing.tenantName, email },
      )
      await ctx.runMutation(internal.platformStripe.saveStripeCustomerId, {
        tenantId,
        stripeCustomerId: customer.id,
      })
    }

    return ctx.runAction(
      internal.platformStripe.createPaymentSetupSessionInternal,
      { tenantId, returnOrigin: origin },
    )
  },
})
