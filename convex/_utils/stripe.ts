import { v } from 'convex/values'
import { internalAction } from '../_generated/server'

const STRIPE_API_URL = 'https://api.stripe.com/v1'

function requireSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable')
  }
  return key
}

type StripeParams = Record<string, string | number | boolean | undefined>

/**
 * Raw fetch wrapper for the Stripe REST API. Stripe expects
 * application/x-www-form-urlencoded bodies (NOT JSON) and amounts in cents.
 * Throws with Stripe's error message on non-OK responses.
 */
export async function stripeRequest(
  path: string,
  method: 'GET' | 'POST',
  params?: StripeParams,
  secretKey?: string,
) {
  const key = secretKey ?? requireSecretKey()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
  }
  let body: string | undefined
  if (params) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    const search = new URLSearchParams()
    for (const [paramKey, paramValue] of Object.entries(params)) {
      if (paramValue !== undefined) {
        search.set(paramKey, String(paramValue))
      }
    }
    body = search.toString()
  }

  const response = await fetch(`${STRIPE_API_URL}${path}`, {
    method,
    headers,
    body,
  })
  const payload = (await response.json().catch(() => ({}))) as {
    id?: string
    error?: { message?: string }
    [key: string]: unknown
  }

  if (!response.ok) {
    const message = payload.error?.message ?? JSON.stringify(payload)
    throw new Error(`Stripe request failed (${response.status}): ${message}`)
  }

  return payload
}

const invoiceItemValidator = v.object({
  description: v.string(),
  quantity: v.number(),
  unitAmountCents: v.number(), // integer cents per unit
  currency: v.string(),
})

/** Create a Stripe customer for an agency. Returns { id } (cus_xxx). */
export const createStripeCustomer = internalAction({
  args: {
    name: v.string(),
    email: v.string(),
  },
  handler: async (_ctx, args) => {
    const payload = await stripeRequest('/customers', 'POST', {
      name: args.name,
      email: args.email,
    })
    return { id: payload.id as string }
  },
})

export const paymentMethodAllowedValidator = v.union(
  v.literal('card'),
  v.literal('us_bank_account'),
  v.literal('card_and_ach'),
)

export type PaymentMethodAllowed =
  | 'card'
  | 'us_bank_account'
  | 'card_and_ach'

/** Maps the tenant's allowed-method setting to Stripe payment_method_types. */
export function paymentMethodTypesFor(
  allowed: PaymentMethodAllowed,
): Array<'card' | 'us_bank_account'> {
  if (allowed === 'card_and_ach') return ['card', 'us_bank_account']
  return [allowed]
}

/**
 * Create a draft Stripe invoice and attach line items.
 * dueDate is an ISO date string; Stripe wants a unix timestamp (seconds).
 * With collectionMethod 'charge_automatically' the invoice auto-charges the
 * given default payment method on finalize (due_date is send_invoice-only).
 */
export const createStripeInvoice = internalAction({
  args: {
    customerId: v.string(),
    dueDate: v.string(),
    lineItems: v.array(invoiceItemValidator),
    collectionMethod: v.optional(
      v.union(v.literal('send_invoice'), v.literal('charge_automatically')),
    ),
    defaultPaymentMethod: v.optional(v.string()),
    // Restricts the payment methods offered on the hosted invoice page
    // (e.g. ACH-only agencies). Absent = Stripe account defaults.
    paymentMethodAllowed: v.optional(paymentMethodAllowedValidator),
  },
  handler: async (_ctx, args) => {
    const collectionMethod = args.collectionMethod ?? 'send_invoice'
    // Stripe rejects a due_date in the past (400) — past-due invoices mirror
    // as "due now" (one hour ahead) instead of failing to mirror at all.
    const requestedSeconds = Math.floor(new Date(args.dueDate).getTime() / 1000)
    const nowSeconds = Math.floor(Date.now() / 1000)
    const dueDateSeconds = Math.max(requestedSeconds, nowSeconds + 3600)
    const paymentMethodTypes = args.paymentMethodAllowed
      ? paymentMethodTypesFor(args.paymentMethodAllowed)
      : []
    const invoice = await stripeRequest('/invoices', 'POST', {
      customer: args.customerId,
      collection_method: collectionMethod,
      due_date:
        collectionMethod === 'send_invoice' ? dueDateSeconds : undefined,
      default_payment_method: args.defaultPaymentMethod,
      'payment_settings[payment_method_types][0]': paymentMethodTypes[0],
      'payment_settings[payment_method_types][1]': paymentMethodTypes[1],
    })
    const invoiceId = invoice.id as string

    for (const item of args.lineItems) {
      // Stripe rejects `amount` combined with `quantity` ("You may only
      // specify one of these parameters: amount, quantity"), and current API
      // versions removed `unit_amount` in favor of `unit_amount_decimal`
      // (string, in cents). quantity × unit_amount_decimal = line total.
      await stripeRequest('/invoiceitems', 'POST', {
        invoice: invoiceId,
        customer: args.customerId,
        unit_amount_decimal: Math.round(item.unitAmountCents),
        currency: item.currency,
        quantity: item.quantity,
        description: item.description,
      })
    }

    return { id: invoiceId }
  },
})

/** Finalize a draft invoice. Returns status + hosted_invoice_url. */
export const finalizeStripeInvoice = internalAction({
  args: { invoiceId: v.string() },
  handler: async (_ctx, args) => {
    const payload = await stripeRequest(
      `/invoices/${args.invoiceId}/finalize`,
      'POST',
      {},
    )
    return {
      id: payload.id as string,
      status: payload.status as string,
      hostedInvoiceUrl: (payload.hosted_invoice_url as string) ?? null,
    }
  },
})

/** Send a finalized invoice (Stripe emails the customer a payment link). */
export const sendStripeInvoice = internalAction({
  args: { invoiceId: v.string() },
  handler: async (_ctx, args) => {
    const payload = await stripeRequest(
      `/invoices/${args.invoiceId}/send`,
      'POST',
      {},
    )
    return {
      id: payload.id as string,
      status: payload.status as string,
      hostedInvoiceUrl: (payload.hosted_invoice_url as string) ?? null,
    }
  },
})

/** Retrieve an invoice's current Stripe status. */
export const getStripeInvoice = internalAction({
  args: { invoiceId: v.string() },
  handler: async (_ctx, args) => {
    const payload = await stripeRequest(`/invoices/${args.invoiceId}`, 'GET')
    return {
      id: payload.id as string,
      status: payload.status as string,
      hostedInvoiceUrl: (payload.hosted_invoice_url as string) ?? null,
      paid: payload.paid === true,
    }
  },
})

/** Void an open invoice. */
export const voidStripeInvoice = internalAction({
  args: { invoiceId: v.string() },
  handler: async (_ctx, args) => {
    const payload = await stripeRequest(
      `/invoices/${args.invoiceId}/void`,
      'POST',
      {},
    )
    return { id: payload.id as string, status: payload.status as string }
  },
})

/** Mark an invoice paid out-of-band (manual payment received). */
export const payStripeInvoice = internalAction({
  args: { invoiceId: v.string() },
  handler: async (_ctx, args) => {
    const payload = await stripeRequest(
      `/invoices/${args.invoiceId}/pay`,
      'POST',
      { paid_out_of_band: true },
    )
    return { id: payload.id as string, status: payload.status as string }
  },
})

/**
 * Create a standalone Stripe payment link for a flat amount (manual
 * collection path). Returns the hosted payment link URL.
 */
export const createPaymentLink = internalAction({
  args: {
    description: v.string(),
    amountCents: v.number(),
  },
  handler: async (_ctx, args) => {
    const payload = await stripeRequest('/payment_links', 'POST', {
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': Math.round(args.amountCents),
      'line_items[0][price_data][product_data][name]': args.description,
      'line_items[0][quantity]': 1,
      'payment_method_types[0]': 'card',
      'payment_method_types[1]': 'us_bank_account',
    })
    return { id: payload.id as string, url: payload.url as string }
  },
})

/**
 * Create a hosted Checkout Session in setup mode (one-time payment method
 * collection). payment_method_types is restricted to exactly the allowed
 * method so the owner cannot swap card ↔ ACH. Returns the hosted page URL.
 */
export const createCheckoutSession = internalAction({
  args: {
    customerId: v.string(),
    paymentMethodAllowed: paymentMethodAllowedValidator,
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const types = paymentMethodTypesFor(args.paymentMethodAllowed)
    const payload = await stripeRequest('/checkout/sessions', 'POST', {
      mode: 'setup',
      customer: args.customerId,
      'payment_method_types[0]': types[0],
      'payment_method_types[1]': types[1],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
    })
    return { id: payload.id as string, url: payload.url as string }
  },
})

/**
 * Retrieve a Checkout Session with its SetupIntent expanded, to read the
 * payment method the customer just attached.
 */
export const retrieveCheckoutSession = internalAction({
  args: { sessionId: v.string() },
  handler: async (_ctx, args) => {
    const payload = await stripeRequest(
      `/checkout/sessions/${args.sessionId}?expand[]=setup_intent`,
      'GET',
    )
    const setupIntent = payload.setup_intent as
      | { payment_method?: unknown }
      | undefined
    return {
      id: payload.id as string,
      customerId: (payload.customer as string) ?? null,
      paymentMethodId:
        typeof setupIntent?.payment_method === 'string'
          ? setupIntent.payment_method
          : null,
    }
  },
})

/** Set a customer's default payment method for invoice charges. */
export const setCustomerDefaultPaymentMethod = internalAction({
  args: {
    customerId: v.string(),
    paymentMethodId: v.string(),
  },
  handler: async (_ctx, args) => {
    const payload = await stripeRequest(`/customers/${args.customerId}`, 'POST', {
      'invoice_settings[default_payment_method]': args.paymentMethodId,
    })
    return { id: payload.id as string }
  },
})

/**
 * Resolve the payment method (pm_xxx) a customer used to pay an invoice.
 * Stripe API versions differ on where this lives, so probe in order:
 * expanded payment_intent (older APIs), the invoice payments collection
 * (newer APIs), then the invoice's charges (oldest). Null when the invoice
 * has no recorded payment method yet.
 */
export const retrieveInvoicePaymentMethod = internalAction({
  args: { invoiceId: v.string() },
  handler: async (_ctx, args): Promise<{ paymentMethodId: string | null }> => {
    const invoice = await stripeRequest(
      `/invoices/${args.invoiceId}?expand[]=payment_intent`,
      'GET',
    )
    const paymentIntent = invoice.payment_intent as
      | { payment_method?: unknown }
      | string
      | undefined
    if (paymentIntent && typeof paymentIntent === 'object') {
      if (typeof paymentIntent.payment_method === 'string') {
        return { paymentMethodId: paymentIntent.payment_method }
      }
    }
    if (typeof paymentIntent === 'string') {
      const intent = await stripeRequest(
        `/payment_intents/${paymentIntent}`,
        'GET',
      )
      if (typeof intent.payment_method === 'string') {
        return { paymentMethodId: intent.payment_method as string }
      }
    }

    const payments = await stripeRequest(
      `/invoices/${args.invoiceId}/payments?limit=1`,
      'GET',
    ).catch(() => null)
    const firstPayment = (
      payments?.data as Array<{
        payment?: { payment_intent?: unknown }
      }> | undefined
    )?.[0]
    const intentId = firstPayment?.payment?.payment_intent
    if (typeof intentId === 'string') {
      const intent = await stripeRequest(`/payment_intents/${intentId}`, 'GET')
      if (typeof intent.payment_method === 'string') {
        return { paymentMethodId: intent.payment_method as string }
      }
    }

    const charges = await stripeRequest(
      `/charges?invoice=${args.invoiceId}&limit=1`,
      'GET',
    ).catch(() => null)
    const firstCharge = (
      charges?.data as Array<{ payment_method?: unknown }> | undefined
    )?.[0]
    if (typeof firstCharge?.payment_method === 'string') {
      return { paymentMethodId: firstCharge.payment_method }
    }
    return { paymentMethodId: null }
  },
})
