import { v, ConvexError } from 'convex/values'
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server'
import type { ActionCtx } from './_generated/server'
import type { UserIdentity } from 'convex/server'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { toStripeInvoiceItems } from './platformBilling'
import { buildInvoiceEmailHtml, buildInvoicePdf } from './platform'
import { requireEnv } from './_utils/env'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Platform-admin guard for public actions. Mirrors requirePlatformAdmin in
 * platform.ts, but actions have no ctx.db, so the platformAdmins lookup goes
 * through an internal query.
 */
async function requirePlatformAdminAction(
  ctx: ActionCtx,
): Promise<UserIdentity> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError('Unauthorized: authentication required.')
  }
  const isAdmin: boolean = await ctx.runQuery(
    internal.platformStripe.isPlatformAdminInternal,
    { clerkUserId: identity.subject },
  )
  if (!isAdmin) {
    throw new ConvexError('Forbidden: platform admin access required.')
  }
  return identity
}

export const isPlatformAdminInternal = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('platformAdmins')
      .withIndex('by_clerk_user_id', (q) =>
        q.eq('clerkUserId', args.clerkUserId),
      )
      .unique()
    return !!existing
  },
})

export const getInvoiceInternal = internalQuery({
  args: { invoiceId: v.id('platformInvoices') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.invoiceId)
  },
})

export const getTenantBillingInternal = internalQuery({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId)
    const subscription = await ctx.db
      .query('tenantSubscriptions')
      .withIndex('by_tenant', (q) => q.eq('tenantId', args.tenantId))
      .unique()
    return {
      tenantName: tenant?.name ?? 'Agency',
      billingEmails: subscription?.billingEmails ?? [],
      stripeCustomerId: subscription?.stripeCustomerId ?? null,
      stripeDefaultPaymentMethod:
        subscription?.stripeDefaultPaymentMethod ?? null,
    }
  },
})

export const getInvoiceByStripeIdInternal = internalQuery({
  args: { stripeInvoiceId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('platformInvoices')
      .withIndex('by_stripe_invoice_id', (q) =>
        q.eq('stripeInvoiceId', args.stripeInvoiceId),
      )
      .unique()
  },
})

export const saveStripeCustomerId = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query('tenantSubscriptions')
      .withIndex('by_tenant', (q) => q.eq('tenantId', args.tenantId))
      .unique()
    if (!subscription) {
      throw new ConvexError('Tenant has no subscription.')
    }
    await ctx.db.patch(subscription._id, {
      stripeCustomerId: args.stripeCustomerId,
      updatedAt: new Date().toISOString(),
    })
  },
})

export const saveStripeInvoiceRefs = internalMutation({
  args: {
    invoiceId: v.id('platformInvoices'),
    stripeInvoiceId: v.string(),
    stripeHostedInvoiceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invoiceId, {
      stripeInvoiceId: args.stripeInvoiceId,
      ...(args.stripeHostedInvoiceUrl
        ? { stripeHostedInvoiceUrl: args.stripeHostedInvoiceUrl }
        : {}),
      updatedAt: new Date().toISOString(),
    })
  },
})

/** Insert a platform audit event from an action/webhook context. */
export const recordStripeAudit = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    actorId: v.string(),
    action: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('auditEvents', {
      tenantId: args.tenantId,
      actorId: args.actorId,
      actorRole: 'platform_admin',
      action: args.action,
      kind: 'platform',
      metadata: args.metadata,
      createdAt: new Date().toISOString(),
    })
  },
})

/**
 * Webhook idempotency check: true when the event was already recorded as
 * processed (Stripe retry — caller should skip it).
 */
export const isStripeWebhookEventProcessed = internalQuery({
  args: { stripeEventId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('stripeWebhookEvents')
      .withIndex('by_stripe_event_id', (q) =>
        q.eq('stripeEventId', args.stripeEventId),
      )
      .unique()
    return existing !== null
  },
})

/**
 * Webhook idempotency guard: records the event if unseen. Returns true when
 * the event was newly recorded (caller should process it), false when it was
 * already processed (Stripe retry — skip). Callers must invoke this only
 * AFTER the event was handled successfully, so a failed handling lets
 * Stripe's retry re-process the event.
 */
export const recordStripeWebhookEvent = internalMutation({
  args: {
    stripeEventId: v.string(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('stripeWebhookEvents')
      .withIndex('by_stripe_event_id', (q) =>
        q.eq('stripeEventId', args.stripeEventId),
      )
      .unique()
    if (existing) {
      return false
    }
    await ctx.db.insert('stripeWebhookEvents', {
      stripeEventId: args.stripeEventId,
      type: args.type,
      processedAt: new Date().toISOString(),
    })
    return true
  },
})

/** Webhook: invoice.paid — mark the matching platform invoice paid. */
export const applyStripeInvoicePaid = internalMutation({
  args: {
    stripeInvoiceId: v.string(),
    paymentMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db
      .query('platformInvoices')
      .withIndex('by_stripe_invoice_id', (q) =>
        q.eq('stripeInvoiceId', args.stripeInvoiceId),
      )
      .unique()
    if (!invoice || invoice.status === 'paid') {
      return null
    }
    const now = new Date().toISOString()
    await ctx.db.patch(invoice._id, {
      status: 'paid',
      paidAt: now,
      ...(args.paymentMethod ? { paymentMethod: args.paymentMethod } : {}),
      updatedAt: now,
    })
    // Recovery: a paid invoice exits the dunning state — restore the
    // subscription to active and clear the grace-period dates.
    const subscription = await ctx.db
      .query('tenantSubscriptions')
      .withIndex('by_tenant', (q) => q.eq('tenantId', invoice.tenantId))
      .unique()
    if (subscription?.status === 'past_due') {
      await ctx.db.patch(subscription._id, {
        status: 'active',
        pastDueSince: undefined,
        graceUntil: undefined,
        updatedAt: now,
      })
    }
    await ctx.db.insert('auditEvents', {
      tenantId: invoice.tenantId,
      actorId: 'stripe_webhook',
      actorRole: 'platform_admin',
      action: 'invoice_paid',
      kind: 'platform',
      metadata: {
        invoiceId: invoice._id as string,
        invoiceNumber: invoice.invoiceNumber,
        source: 'stripe_webhook',
      },
      createdAt: now,
    })
    return invoice._id
  },
})

/**
 * Webhook: invoice.payment_failed — enter the dunning state. The platform
 * invoice goes 'overdue'; the subscription goes 'past_due' with a 7-day
 * grace window. Repeated failures recompute the dates (never stack). A
 * failure notice email is scheduled for the tenant's billing contacts.
 */
export const applyStripeInvoiceFailed = internalMutation({
  args: { stripeInvoiceId: v.string() },
  handler: async (ctx, args) => {
    const invoice = await ctx.db
      .query('platformInvoices')
      .withIndex('by_stripe_invoice_id', (q) =>
        q.eq('stripeInvoiceId', args.stripeInvoiceId),
      )
      .unique()
    if (!invoice) {
      return null
    }
    // Out-of-order webhook guard: a redelivered invoice.payment_failed that
    // arrives after invoice.paid must not re-dun the already-paid invoice —
    // no overdue flip, no past_due regression, no spurious failure email.
    if (invoice.status === 'paid') {
      return null
    }
    const now = Date.now()
    const nowIso = new Date(now).toISOString()
    if (invoice.status !== 'void') {
      await ctx.db.patch(invoice._id, {
        status: 'overdue',
        updatedAt: nowIso,
      })
    }
    // past_due is entered from active/trialing; repeat failures while already
    // past_due recompute the grace window (never stack on top of it).
    const subscription = await ctx.db
      .query('tenantSubscriptions')
      .withIndex('by_tenant', (q) => q.eq('tenantId', invoice.tenantId))
      .unique()
    const alreadyPastDue = subscription?.status === 'past_due'
    if (
      subscription &&
      (subscription.status === 'active' ||
        subscription.status === 'trialing' ||
        subscription.status === 'past_due')
    ) {
      await ctx.db.patch(subscription._id, {
        status: 'past_due',
        pastDueSince: now,
        graceUntil: now + 7 * 24 * 60 * 60 * 1000,
        updatedAt: nowIso,
      })
    }
    await ctx.db.insert('auditEvents', {
      tenantId: invoice.tenantId,
      actorId: 'stripe_webhook',
      actorRole: 'platform_admin',
      action: 'invoice_payment_failed',
      kind: 'platform',
      metadata: {
        invoiceId: invoice._id as string,
        invoiceNumber: invoice.invoiceNumber,
        source: 'stripe_webhook',
      },
      createdAt: nowIso,
    })
    // Failure email only on the transition into past_due — Stripe retries
    // re-deliver invoice.payment_failed and the agency should not be emailed
    // once per retry.
    if (!alreadyPastDue) {
      try {
        await ctx.scheduler.runAfter(
          0,
          internal.platformStripe.sendPaymentFailedEmail,
          {
            tenantId: invoice.tenantId,
            invoiceNumber: invoice.invoiceNumber,
          },
        )
      } catch (err) {
        console.warn('Failed to schedule payment-failed email:', err)
      }
    }
    return invoice._id
  },
})

/**
 * Dunning email: notifies the tenant's billing contacts that a charge failed.
 * Carries only the agency name + invoice number — no PHI. No-ops when
 * EMAIL_ENABLED !== 'true' (resend.sendEmail handles the gate).
 */
export const sendPaymentFailedEmail = internalAction({
  args: {
    tenantId: v.id('tenants'),
    invoiceNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const billing = await ctx.runQuery(
      internal.platformStripe.getTenantBillingInternal,
      { tenantId: args.tenantId },
    )
    if (billing.billingEmails.length === 0) {
      console.warn(
        `No billing emails for tenant ${args.tenantId}; skipping payment-failed email.`,
      )
      return { skipped: true }
    }
    const subject = `Payment failed for invoice ${args.invoiceNumber}`
    const html =
      `<p>Hi ${escapeHtml(billing.tenantName)},</p>` +
      `<p>We could not collect payment for invoice <strong>${escapeHtml(args.invoiceNumber)}</strong>. ` +
      `We will retry automatically over the next few days. To avoid service interruption, ` +
      `please check that your payment method on file is up to date.</p>` +
      `<p>— ATRIA-X Platform Billing</p>`
    for (const to of billing.billingEmails) {
      try {
        await ctx.runAction(internal._utils.resend.sendEmail, {
          to,
          subject,
          html,
        })
      } catch (err) {
        console.warn(`Failed to send payment-failed email to ${to}:`, err)
      }
    }
    return { skipped: false }
  },
})

/**
 * Webhook: checkout.session.completed (setup mode) — persist the payment
 * method the owner just attached as the subscription's default. Looks the
 * subscription up by Stripe customer id; re-attaching the same method is a
 * no-op (webhook replay safe).
 */
export const saveStripeDefaultPaymentMethod = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    paymentMethodId: v.string(),
  },
  handler: async (ctx, args) => {
    const subscriptions = await ctx.db.query('tenantSubscriptions').collect()
    const subscription = subscriptions.find(
      (sub) => sub.stripeCustomerId === args.stripeCustomerId,
    )
    if (!subscription) {
      console.warn(
        `No subscription found for Stripe customer ${args.stripeCustomerId}.`,
      )
      return null
    }
    if (subscription.stripeDefaultPaymentMethod === args.paymentMethodId) {
      return subscription._id
    }
    const now = new Date().toISOString()
    await ctx.db.patch(subscription._id, {
      stripeDefaultPaymentMethod: args.paymentMethodId,
      updatedAt: now,
    })
    await ctx.db.insert('auditEvents', {
      tenantId: subscription.tenantId,
      actorId: 'stripe_webhook',
      actorRole: 'platform_admin',
      action: 'payment_method_attached',
      kind: 'platform',
      metadata: {
        stripeCustomerId: args.stripeCustomerId,
        paymentMethodId: args.paymentMethodId,
        source: 'stripe_webhook',
      },
      createdAt: now,
    })
    return subscription._id
  },
})

/** Webhook: invoice.finalized — store the hosted invoice URL. */
export const saveHostedInvoiceUrlByStripeId = internalMutation({
  args: {
    stripeInvoiceId: v.string(),
    stripeHostedInvoiceUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db
      .query('platformInvoices')
      .withIndex('by_stripe_invoice_id', (q) =>
        q.eq('stripeInvoiceId', args.stripeInvoiceId),
      )
      .unique()
    if (!invoice) {
      return null
    }
    await ctx.db.patch(invoice._id, {
      stripeHostedInvoiceUrl: args.stripeHostedInvoiceUrl,
      updatedAt: new Date().toISOString(),
    })
    return invoice._id
  },
})

type CreateAndSendResult = { skipped: boolean; stripeInvoiceId?: string }

/**
 * Core Stripe mirroring: ensure the tenant has a Stripe customer, then
 * create + finalize + send a Stripe invoice matching the platform invoice.
 * Scheduled (fire-and-forget) by createPlatformInvoice/sendPlatformInvoice
 * when chargeViaStripe is set, and awaited by the sendInvoiceWithStripe
 * action. No-ops when the invoice is already linked to Stripe.
 */
export const createAndSendStripeInvoice = internalAction({
  args: { invoiceId: v.id('platformInvoices') },
  handler: async (ctx, args): Promise<CreateAndSendResult> => {
    const invoice = await ctx.runQuery(
      internal.platformStripe.getInvoiceInternal,
      { invoiceId: args.invoiceId },
    )
    if (!invoice) {
      throw new Error('Invoice not found.')
    }
    if (invoice.stripeInvoiceId) {
      console.warn(
        `Invoice ${invoice.invoiceNumber} already linked to Stripe (${invoice.stripeInvoiceId}); skipping.`,
      )
      return { skipped: true, stripeInvoiceId: invoice.stripeInvoiceId }
    }

    const billing = await ctx.runQuery(
      internal.platformStripe.getTenantBillingInternal,
      { tenantId: invoice.tenantId },
    )

    try {
      let stripeCustomerId = billing.stripeCustomerId
      if (!stripeCustomerId) {
        const email = billing.billingEmails[0] ?? invoice.sentTo?.[0]
        if (!email) {
          throw new Error('No billing email available for Stripe customer.')
        }
        const customer: { id: string } = await ctx.runAction(
          internal._utils.stripe.createStripeCustomer,
          { name: billing.tenantName, email },
        )
        stripeCustomerId = customer.id
        await ctx.runMutation(internal.platformStripe.saveStripeCustomerId, {
          tenantId: invoice.tenantId,
          stripeCustomerId,
        })
      }

      // Tenants with a default payment method on file auto-charge on
      // finalize (zero manual collection); everyone else keeps the
      // send_invoice email flow.
      const autoCharge = billing.stripeDefaultPaymentMethod !== null
      const stripeInvoice: { id: string } = await ctx.runAction(
        internal._utils.stripe.createStripeInvoice,
        {
          customerId: stripeCustomerId,
          dueDate: invoice.dueDate,
          lineItems: toStripeInvoiceItems(invoice.lineItems),
          ...(autoCharge
            ? {
                collectionMethod: 'charge_automatically' as const,
                defaultPaymentMethod:
                  billing.stripeDefaultPaymentMethod ?? undefined,
              }
            : {}),
        },
      )
      const finalized: { hostedInvoiceUrl: string | null } =
        await ctx.runAction(internal._utils.stripe.finalizeStripeInvoice, {
          invoiceId: stripeInvoice.id,
        })
      // charge_automatically invoices are charged by Stripe on finalize;
      // /send only applies to the send_invoice flow.
      const sent: { hostedInvoiceUrl: string | null } = autoCharge
        ? { hostedInvoiceUrl: null }
        : await ctx.runAction(internal._utils.stripe.sendStripeInvoice, {
            invoiceId: stripeInvoice.id,
          })

      await ctx.runMutation(internal.platformStripe.saveStripeInvoiceRefs, {
        invoiceId: args.invoiceId,
        stripeInvoiceId: stripeInvoice.id,
        stripeHostedInvoiceUrl:
          sent.hostedInvoiceUrl ?? finalized.hostedInvoiceUrl ?? undefined,
      })

      return { skipped: false, stripeInvoiceId: stripeInvoice.id }
    } catch (err) {
      // This action is usually scheduled fire-and-forget, so surface failures
      // in the audit log instead of failing silently. The error is rethrown
      // so direct callers (sendInvoiceWithStripe) still see it.
      await ctx.runMutation(internal.platformStripe.recordStripeAudit, {
        tenantId: invoice.tenantId,
        actorId: 'system',
        action: 'stripe_invoice_failed',
        metadata: {
          invoiceId: args.invoiceId as string,
          invoiceNumber: invoice.invoiceNumber,
          error: err instanceof Error ? err.message : String(err),
        },
      })
      throw err
    }
  },
})

/**
 * Send the Resend invoice email after the Stripe mirror invoice exists, so
 * the email includes the hosted payment link. Scheduled by
 * createPlatformInvoice (sendImmediately) and sendPlatformInvoice after the
 * invoice is marked sent. Stripe failures degrade gracefully: the email still
 * goes out, without a payment link.
 */
export const sendInvoiceEmailWithStripe = internalAction({
  args: {
    invoiceId: v.id('platformInvoices'),
    recipients: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      await ctx.runAction(internal.platformStripe.createAndSendStripeInvoice, {
        invoiceId: args.invoiceId,
      })
    } catch (err) {
      console.warn(
        'Stripe invoice creation failed, sending email without payment link:',
        err,
      )
    }

    const invoice = await ctx.runQuery(
      internal.platformStripe.getInvoiceInternal,
      { invoiceId: args.invoiceId },
    )
    if (!invoice) {
      console.warn(`Invoice ${args.invoiceId} not found; skipping email.`)
      return
    }
    const billing = await ctx.runQuery(
      internal.platformStripe.getTenantBillingInternal,
      { tenantId: invoice.tenantId },
    )

    const subject = `Invoice ${invoice.invoiceNumber} from ATRIA-X`
    const html = buildInvoiceEmailHtml(billing.tenantName, invoice)
    const pdfBase64 = buildInvoicePdf(billing.tenantName, invoice)
    for (const to of args.recipients) {
      try {
        await ctx.runAction(internal._utils.resend.sendEmail, {
          to,
          subject,
          html,
          attachments: [
            {
              filename: `${invoice.invoiceNumber}.pdf`,
              content: pdfBase64,
              contentType: 'application/pdf',
            },
          ],
        })
      } catch (err) {
        console.warn(`Failed to send invoice email to ${to}:`, err)
      }
    }
  },
})

/**
 * Scheduled by markInvoicePaid when the invoice is Stripe-linked. Failures
 * are warn-logged and never roll back the platform-side state change.
 */
export const payStripeInvoiceInternal = internalAction({
  args: { invoiceId: v.id('platformInvoices') },
  handler: async (ctx, args): Promise<{ skipped: boolean }> => {
    const invoice = await ctx.runQuery(
      internal.platformStripe.getInvoiceInternal,
      { invoiceId: args.invoiceId },
    )
    if (!invoice?.stripeInvoiceId) {
      return { skipped: true }
    }
    try {
      await ctx.runAction(internal._utils.stripe.payStripeInvoice, {
        invoiceId: invoice.stripeInvoiceId,
      })
      return { skipped: false }
    } catch (err) {
      console.warn(
        `Failed to pay Stripe invoice ${invoice.stripeInvoiceId}:`,
        err,
      )
      return { skipped: true }
    }
  },
})

/**
 * Scheduled by voidInvoice when the invoice is Stripe-linked. Failures are
 * warn-logged and never roll back the platform-side state change.
 */
export const voidStripeInvoiceInternal = internalAction({
  args: { invoiceId: v.id('platformInvoices') },
  handler: async (ctx, args): Promise<{ skipped: boolean }> => {
    const invoice = await ctx.runQuery(
      internal.platformStripe.getInvoiceInternal,
      { invoiceId: args.invoiceId },
    )
    if (!invoice?.stripeInvoiceId) {
      return { skipped: true }
    }
    try {
      await ctx.runAction(internal._utils.stripe.voidStripeInvoice, {
        invoiceId: invoice.stripeInvoiceId,
      })
      return { skipped: false }
    } catch (err) {
      console.warn(
        `Failed to void Stripe invoice ${invoice.stripeInvoiceId}:`,
        err,
      )
      return { skipped: true }
    }
  },
})

/**
 * Shared internals for the one-time payment-setup link: builds a hosted
 * Stripe Checkout Session (mode=setup) for the tenant's Stripe customer,
 * restricted to exactly the tenant's allowed payment method. Stripe errors
 * (e.g. ACH not enabled on the account) propagate to the caller.
 */
export const createPaymentSetupSessionInternal = internalAction({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const tenant = await ctx.runQuery(internal.platform.getTenantInternal, {
      tenantId: args.tenantId,
    })
    if (!tenant) {
      throw new Error('Tenant not found.')
    }
    const billing = await ctx.runQuery(
      internal.platformStripe.getTenantBillingInternal,
      { tenantId: args.tenantId },
    )
    if (!billing.stripeCustomerId) {
      throw new Error('Tenant has no Stripe customer.')
    }
    const appUrl = requireEnv('APP_URL')
    const session: { url: string } = await ctx.runAction(
      internal._utils.stripe.createCheckoutSession,
      {
        customerId: billing.stripeCustomerId,
        paymentMethodAllowed: tenant.paymentMethodAllowed ?? 'card',
        successUrl: `${appUrl}/?payment_setup=success`,
        cancelUrl: `${appUrl}/?payment_setup=cancelled`,
      },
    )
    return { url: session.url }
  },
})

/** Create a one-time payment-setup link for a tenant (platform admin). */
export const createPaymentSetupSession = action({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await requirePlatformAdminAction(ctx)
    const result: { url: string } = await ctx.runAction(
      internal.platformStripe.createPaymentSetupSessionInternal,
      { tenantId: args.tenantId },
    )
    await ctx.runMutation(internal.platformStripe.recordStripeAudit, {
      tenantId: args.tenantId,
      actorId: identity.subject,
      action: 'payment_setup_link_created',
      metadata: {},
    })
    return result
  },
})

/** Create (or return existing) Stripe customer for a tenant. */
export const createStripeCustomerForTenant = action({
  args: { tenantId: v.id('tenants') },
  handler: async (
    ctx,
    args,
  ): Promise<{ stripeCustomerId: string; existing: boolean }> => {
    const identity = await requirePlatformAdminAction(ctx)

    const billing = await ctx.runQuery(
      internal.platformStripe.getTenantBillingInternal,
      { tenantId: args.tenantId },
    )
    if (billing.stripeCustomerId) {
      return { stripeCustomerId: billing.stripeCustomerId, existing: true }
    }
    const email = billing.billingEmails[0]
    if (!email) {
      throw new ConvexError(
        'Tenant has no billing emails; add one before setting up Stripe.',
      )
    }

    const customer: { id: string } = await ctx.runAction(
      internal._utils.stripe.createStripeCustomer,
      { name: billing.tenantName, email },
    )
    await ctx.runMutation(internal.platformStripe.saveStripeCustomerId, {
      tenantId: args.tenantId,
      stripeCustomerId: customer.id,
    })
    await ctx.runMutation(internal.platformStripe.recordStripeAudit, {
      tenantId: args.tenantId,
      actorId: identity.subject,
      action: 'stripe_customer_created',
      metadata: { stripeCustomerId: customer.id },
    })
    return { stripeCustomerId: customer.id, existing: false }
  },
})

/** Create + finalize + send a Stripe invoice for an existing platform invoice. */
export const sendInvoiceWithStripe = action({
  args: { invoiceId: v.id('platformInvoices') },
  handler: async (ctx, args): Promise<CreateAndSendResult> => {
    const identity = await requirePlatformAdminAction(ctx)

    const invoice = await ctx.runQuery(
      internal.platformStripe.getInvoiceInternal,
      { invoiceId: args.invoiceId },
    )
    if (!invoice) {
      throw new ConvexError('Invoice not found.')
    }
    if (invoice.stripeInvoiceId) {
      throw new ConvexError(
        `Invoice is already linked to Stripe (${invoice.stripeInvoiceId}).`,
      )
    }

    const result: CreateAndSendResult = await ctx.runAction(
      internal.platformStripe.createAndSendStripeInvoice,
      { invoiceId: args.invoiceId },
    )
    await ctx.runMutation(internal.platformStripe.recordStripeAudit, {
      tenantId: invoice.tenantId,
      actorId: identity.subject,
      action: 'stripe_invoice_sent',
      metadata: {
        invoiceId: args.invoiceId as string,
        invoiceNumber: invoice.invoiceNumber,
        stripeInvoiceId: result.stripeInvoiceId,
      },
    })
    return result
  },
})

/** Pull the current Stripe status and apply it to the platform invoice. */
export const syncStripeInvoiceStatus = action({
  args: { invoiceId: v.id('platformInvoices') },
  handler: async (
    ctx,
    args,
  ): Promise<{ stripeStatus: string; hostedInvoiceUrl: string | null }> => {
    await requirePlatformAdminAction(ctx)

    const invoice = await ctx.runQuery(
      internal.platformStripe.getInvoiceInternal,
      { invoiceId: args.invoiceId },
    )
    if (!invoice) {
      throw new ConvexError('Invoice not found.')
    }
    if (!invoice.stripeInvoiceId) {
      throw new ConvexError('Invoice is not linked to Stripe.')
    }

    const stripe: { status: string; paid: boolean; hostedInvoiceUrl: string | null } =
      await ctx.runAction(internal._utils.stripe.getStripeInvoice, {
        invoiceId: invoice.stripeInvoiceId,
      })

    if (stripe.paid || stripe.status === 'paid') {
      await ctx.runMutation(internal.platformStripe.applyStripeInvoicePaid, {
        stripeInvoiceId: invoice.stripeInvoiceId,
      })
    }
    if (
      stripe.hostedInvoiceUrl &&
      stripe.hostedInvoiceUrl !== invoice.stripeHostedInvoiceUrl
    ) {
      await ctx.runMutation(internal.platformStripe.saveStripeInvoiceRefs, {
        invoiceId: args.invoiceId,
        stripeInvoiceId: invoice.stripeInvoiceId,
        stripeHostedInvoiceUrl: stripe.hostedInvoiceUrl,
      })
    }

    return {
      stripeStatus: stripe.status,
      hostedInvoiceUrl: stripe.hostedInvoiceUrl,
    }
  },
})

/** Create a standalone Stripe payment link for the invoice total. */
export const createPaymentLinkForInvoice = action({
  args: { invoiceId: v.id('platformInvoices') },
  handler: async (ctx, args): Promise<{ url: string }> => {
    await requirePlatformAdminAction(ctx)

    const invoice = await ctx.runQuery(
      internal.platformStripe.getInvoiceInternal,
      { invoiceId: args.invoiceId },
    )
    if (!invoice) {
      throw new ConvexError('Invoice not found.')
    }

    const link: { url: string } = await ctx.runAction(
      internal._utils.stripe.createPaymentLink,
      {
        description: `Invoice ${invoice.invoiceNumber}`,
        amountCents: Math.round(invoice.total * 100),
      },
    )
    return { url: link.url }
  },
})

/** Void both the platform invoice and its linked Stripe invoice. */
export const voidStripeInvoiceForPlatform = action({
  args: { invoiceId: v.id('platformInvoices') },
  handler: async (ctx, args): Promise<Id<'platformInvoices'>> => {
    await requirePlatformAdminAction(ctx)
    // voidInvoice patches the platform invoice and schedules the Stripe void.
    await ctx.runMutation(api.platform.voidInvoice, {
      invoiceId: args.invoiceId,
    })
    return args.invoiceId
  },
})
