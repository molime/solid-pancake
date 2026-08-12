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

/**
 * Create a draft Stripe invoice and attach line items.
 * dueDate is an ISO date string; Stripe wants a unix timestamp (seconds).
 */
export const createStripeInvoice = internalAction({
  args: {
    customerId: v.string(),
    dueDate: v.string(),
    lineItems: v.array(invoiceItemValidator),
  },
  handler: async (_ctx, args) => {
    const dueDateSeconds = Math.floor(new Date(args.dueDate).getTime() / 1000)
    const invoice = await stripeRequest('/invoices', 'POST', {
      customer: args.customerId,
      collection_method: 'send_invoice',
      due_date: dueDateSeconds,
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
