import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'

const http = httpRouter()

/** Parse a Stripe-Signature header ("t=<ts>,v1=<sig>,...") into parts. */
export function parseStripeSignatureHeader(header: string) {
  let timestamp: string | null = null
  const v1: string[] = []
  for (const part of header.split(',')) {
    const [key, value] = part.split('=')
    if (key === 't') timestamp = value
    // During webhook-secret rotation Stripe sends several v1 signatures;
    // keep them all so verification can accept any match.
    if (key === 'v1' && value) v1.push(value)
  }
  if (!timestamp || v1.length === 0) {
    return null
  }
  return { timestamp, v1 }
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false
  }
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Verify a Stripe webhook signature: HMAC-SHA256 of "<timestamp>.<rawBody>"
 * with the webhook signing secret, compared against the v1 signature.
 * The timestamp must be within `toleranceSeconds` of now (Stripe's default
 * recommendation is 300s) to reject replayed events.
 */
export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300,
) {
  const parsed = parseStripeSignatureHeader(signatureHeader)
  if (!parsed) {
    return false
  }
  const timestamp = Number(parsed.timestamp)
  if (!Number.isFinite(timestamp)) {
    return false
  }
  if (
    toleranceSeconds > 0 &&
    Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds
  ) {
    return false
  }
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${parsed.timestamp}.${rawBody}`),
  )
  const expected = toHex(signed)
  return parsed.v1.some((candidate) => timingSafeEqual(expected, candidate))
}

type StripeEvent = {
  id?: string
  type?: string
  data?: { object?: Record<string, unknown> }
}

http.route({
  path: '/stripe-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) {
      return new Response('Webhook secret not configured', { status: 400 })
    }

    const signatureHeader = request.headers.get('Stripe-Signature')
    const rawBody = await request.text()
    if (
      !signatureHeader ||
      !(await verifyStripeSignature(rawBody, signatureHeader, secret))
    ) {
      return new Response('Invalid signature', { status: 400 })
    }

    let event: StripeEvent
    try {
      event = JSON.parse(rawBody) as StripeEvent
    } catch {
      return new Response('Invalid JSON', { status: 400 })
    }
    if (!event.id || !event.type) {
      return new Response('Malformed event', { status: 400 })
    }

    // Idempotency: Stripe retries webhooks; skip events already recorded.
    // The event is recorded only AFTER successful handling below, so a
    // failure here returns 500 and Stripe's retry re-processes it.
    const alreadyProcessed = await ctx.runQuery(
      internal.platformStripe.isStripeWebhookEventProcessed,
      { stripeEventId: event.id },
    )
    if (alreadyProcessed) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const object = event.data?.object ?? {}
    const stripeInvoiceId =
      typeof object.id === 'string' ? object.id : undefined

    if (event.type === 'invoice.paid') {
      if (stripeInvoiceId) {
        // Best-effort: the Stripe Invoice object does not include
        // payment_method_details (that lives on Charge/PaymentIntent), so
        // this is normally undefined and platformInvoices.paymentMethod
        // stays unset. Kept for forward compatibility with payloads that
        // do carry it.
        const paymentMethod =
          typeof (object.payment_method_details as { type?: unknown })
            ?.type === 'string'
            ? ((object.payment_method_details as { type: string }).type as string)
            : undefined
        await ctx.runMutation(internal.platformStripe.applyStripeInvoicePaid, {
          stripeInvoiceId,
          paymentMethod,
        })
      }
    } else if (event.type === 'invoice.payment_failed') {
      if (stripeInvoiceId) {
        // Dunning: platform invoice → overdue, subscription → past_due with
        // a 7-day grace window, plus a failure notice email to the agency.
        await ctx.runMutation(
          internal.platformStripe.applyStripeInvoiceFailed,
          { stripeInvoiceId },
        )
      }
    } else if (event.type === 'checkout.session.completed') {
      // One-time payment-setup link completed: persist the attached payment
      // method as the customer's default so monthly invoices auto-charge.
      const sessionId =
        typeof object.id === 'string' ? object.id : undefined
      if (object.mode === 'setup' && sessionId) {
        const session: {
          customerId: string | null
          paymentMethodId: string | null
        } = await ctx.runAction(
          internal._utils.stripe.retrieveCheckoutSession,
          { sessionId },
        )
        if (session.customerId && session.paymentMethodId) {
          await ctx.runAction(
            internal._utils.stripe.setCustomerDefaultPaymentMethod,
            {
              customerId: session.customerId,
              paymentMethodId: session.paymentMethodId,
            },
          )
          await ctx.runMutation(
            internal.platformStripe.saveStripeDefaultPaymentMethod,
            {
              stripeCustomerId: session.customerId,
              paymentMethodId: session.paymentMethodId,
            },
          )
        }
      }
    } else if (event.type === 'invoice.finalized') {
      const hostedUrl =
        typeof object.hosted_invoice_url === 'string'
          ? object.hosted_invoice_url
          : undefined
      if (stripeInvoiceId && hostedUrl) {
        await ctx.runMutation(
          internal.platformStripe.saveHostedInvoiceUrlByStripeId,
          { stripeInvoiceId, stripeHostedInvoiceUrl: hostedUrl },
        )
      }
    }

    // Record the event only now that handling succeeded.
    await ctx.runMutation(internal.platformStripe.recordStripeWebhookEvent, {
      stripeEventId: event.id,
      type: event.type,
    })

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }),
})

export default http
