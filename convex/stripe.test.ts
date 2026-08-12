import { describe, it, expect, vi, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'
import { convexTest } from 'convex-test'
import schema from './schema'
import { internal } from './_generated/api'
import { toStripeInvoiceItems } from './platformBilling'
import { stripeRequest } from './_utils/stripe'
import { verifyStripeSignature } from './http'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

describe('toStripeInvoiceItems', () => {
  it('converts USD unit prices to integer cents', () => {
    const items = toStripeInvoiceItems([
      { description: 'Base price', quantity: 1, unitPrice: 19.99 },
      { description: 'Seats', quantity: 3, unitPrice: 100 },
    ])
    expect(items[0]).toEqual({
      description: 'Base price',
      quantity: 1,
      unitAmountCents: 1999,
      currency: 'usd',
    })
    expect(items[1].unitAmountCents).toBe(10000)
  })

  it('passes quantity through and always uses usd', () => {
    const items = toStripeInvoiceItems([
      { description: 'x', quantity: 7, unitPrice: 0.5 },
    ])
    expect(items[0].quantity).toBe(7)
    expect(items[0].currency).toBe('usd')
    expect(items[0].unitAmountCents).toBe(50)
  })
})

describe('createStripeInvoice', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends unit_amount_decimal + quantity, never amount + quantity', async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(
      async () =>
        new Response(JSON.stringify({ id: 'in_1' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const original = process.env.STRIPE_SECRET_KEY
    process.env.STRIPE_SECRET_KEY = 'sk_test_key'

    try {
      const t = createTestConvex()
      await t.action(internal._utils.stripe.createStripeInvoice, {
        customerId: 'cus_1',
        dueDate: '2026-08-15',
        lineItems: [
          {
            description: 'Seats',
            quantity: 3,
            unitAmountCents: 1999,
            currency: 'usd',
          },
        ],
      })
    } finally {
      if (original === undefined) {
        delete process.env.STRIPE_SECRET_KEY
      } else {
        process.env.STRIPE_SECRET_KEY = original
      }
    }

    // First call creates the invoice; the second creates the invoiceitem.
    const itemCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).endsWith('/invoiceitems'),
    )
    expect(itemCall).toBeDefined()
    const params = new URLSearchParams(
      (itemCall as unknown as [string, { body: string }])[1].body,
    )
    // Stripe errors when `amount` is combined with `quantity`.
    expect(params.has('amount')).toBe(false)
    expect(params.get('unit_amount_decimal')).toBe('1999')
    expect(params.get('quantity')).toBe('3')
    expect(params.get('currency')).toBe('usd')
  })
})

describe('stripeRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends a form-encoded body with Bearer auth', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: 'cus_123' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await stripeRequest(
      '/customers',
      'POST',
      { name: 'Acme Care', email: 'billing@acme.test' },
      'sk_test_key',
    )

    expect(result.id).toBe('cus_123')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string>; body: string },
    ]
    expect(url).toBe('https://api.stripe.com/v1/customers')
    expect(init.headers.Authorization).toBe('Bearer sk_test_key')
    expect(init.headers['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    )
    // Body must be form-encoded, NOT JSON.
    const params = new URLSearchParams(init.body)
    expect(params.get('name')).toBe('Acme Care')
    expect(params.get('email')).toBe('billing@acme.test')
  })

  it('omits undefined params and sends no body without params', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: 'in_1' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await stripeRequest('/invoices/in_1', 'GET', undefined, 'sk_test_key')
    const [, getInit] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body?: string },
    ]
    expect(getInit.body).toBeUndefined()

    await stripeRequest(
      '/invoices',
      'POST',
      { customer: 'cus_1', due_date: undefined },
      'sk_test_key',
    )
    const [, postInit] = fetchMock.mock.calls[1] as unknown as [
      string,
      { body: string },
    ]
    const params = new URLSearchParams(postInit.body)
    expect(params.get('customer')).toBe('cus_1')
    expect(params.has('due_date')).toBe(false)
  })

  it("throws with Stripe's error message on non-OK responses", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: { message: 'No such customer' } }),
            { status: 404 },
          ),
      ),
    )
    await expect(
      stripeRequest('/customers', 'POST', { name: 'x' }, 'sk_test_key'),
    ).rejects.toThrow('No such customer')
  })

  it('throws when STRIPE_SECRET_KEY is missing', async () => {
    const original = process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_SECRET_KEY
    try {
      await expect(stripeRequest('/customers', 'GET')).rejects.toThrow(
        'STRIPE_SECRET_KEY',
      )
    } finally {
      if (original !== undefined) {
        process.env.STRIPE_SECRET_KEY = original
      }
    }
  })
})

describe('verifyStripeSignature', () => {
  const secret = 'whsec_test_secret'
  const rawBody = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' })

  function sign(body: string, timestamp: number) {
    const v1 = createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex')
    return `t=${timestamp},v1=${v1}`
  }

  it('accepts a known-good t,v1 signature', async () => {
    const t = Math.floor(Date.now() / 1000)
    expect(await verifyStripeSignature(rawBody, sign(rawBody, t), secret)).toBe(
      true,
    )
  })

  it('rejects a tampered body', async () => {
    const t = Math.floor(Date.now() / 1000)
    const header = sign(rawBody, t)
    expect(await verifyStripeSignature(`${rawBody} `, header, secret)).toBe(
      false,
    )
  })

  it('rejects a wrong secret and malformed headers', async () => {
    const t = Math.floor(Date.now() / 1000)
    expect(
      await verifyStripeSignature(rawBody, sign(rawBody, t), 'whsec_other'),
    ).toBe(false)
    expect(await verifyStripeSignature(rawBody, 'garbage', secret)).toBe(false)
    expect(await verifyStripeSignature(rawBody, 't=123', secret)).toBe(false)
  })

  it('accepts any matching v1 when multiple are present (secret rotation)', async () => {
    const t = Math.floor(Date.now() / 1000)
    const good = createHmac('sha256', secret)
      .update(`${t}.${rawBody}`)
      .digest('hex')
    // Stripe sends several v1 entries while a webhook secret is being
    // rotated; any one match must verify regardless of position.
    expect(
      await verifyStripeSignature(
        rawBody,
        `t=${t},v1=${'0'.repeat(64)},v1=${good}`,
        secret,
      ),
    ).toBe(true)
    expect(
      await verifyStripeSignature(
        rawBody,
        `t=${t},v1=${good},v1=${'0'.repeat(64)}`,
        secret,
      ),
    ).toBe(true)
    // No match among several v1 values still rejects.
    expect(
      await verifyStripeSignature(
        rawBody,
        `t=${t},v1=${'0'.repeat(64)},v1=${'1'.repeat(64)}`,
        secret,
      ),
    ).toBe(false)
  })

  it('rejects correctly-signed events outside the timestamp tolerance', async () => {
    const now = Math.floor(Date.now() / 1000)
    // Valid signature, but timestamp is 10 minutes old (replay attack).
    expect(
      await verifyStripeSignature(rawBody, sign(rawBody, now - 600), secret),
    ).toBe(false)
    // 4 minutes old is inside the 300s tolerance.
    expect(
      await verifyStripeSignature(rawBody, sign(rawBody, now - 240), secret),
    ).toBe(true)
    // Non-numeric timestamps never verify.
    expect(
      await verifyStripeSignature(
        rawBody,
        `t=notanumber,v1=${'0'.repeat(64)}`,
        secret,
      ),
    ).toBe(false)
  })
})

describe('stripeWebhookEvents idempotency', () => {
  it('records an event once and short-circuits retries', async () => {
    const t = createTestConvex()
    const first = await t.mutation(
      internal.platformStripe.recordStripeWebhookEvent,
      { stripeEventId: 'evt_1', type: 'invoice.paid' },
    )
    expect(first).toBe(true)
    const second = await t.mutation(
      internal.platformStripe.recordStripeWebhookEvent,
      { stripeEventId: 'evt_1', type: 'invoice.paid' },
    )
    expect(second).toBe(false)
  })
})

describe('applyStripeInvoicePaid', () => {
  async function insertSentInvoice(t: ReturnType<typeof createTestConvex>) {
    return await t.run(async (ctx) => {
      const now = new Date().toISOString()
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId: 'org_1',
        name: 'Acme Care',
        slug: 'acme-care',
        createdAt: now,
      })
      return await ctx.db.insert('platformInvoices', {
        tenantId,
        invoiceNumber: 'PLAT-2026-0001',
        periodStart: '2026-07-01',
        periodEnd: '2026-08-01',
        dueDate: '2026-08-15',
        lineItems: [
          {
            description: 'Base price',
            quantity: 1,
            unitPrice: 100,
            amount: 100,
            source: 'auto',
          },
        ],
        subtotal: 100,
        total: 100,
        status: 'sent',
        stripeInvoiceId: 'in_123',
        createdBy: 'admin_1',
        createdAt: now,
        updatedAt: now,
      })
    })
  }

  it('maps invoice.paid to status paid with paidAt', async () => {
    const t = createTestConvex()
    const invoiceId = await insertSentInvoice(t)

    await t.mutation(internal.platformStripe.applyStripeInvoicePaid, {
      stripeInvoiceId: 'in_123',
    })

    const invoice = await t.run(async (ctx) => ctx.db.get(invoiceId))
    expect(invoice?.status).toBe('paid')
    expect(invoice?.paidAt).toBeTruthy()
  })

  it('is idempotent for already-paid invoices', async () => {
    const t = createTestConvex()
    const invoiceId = await insertSentInvoice(t)

    await t.mutation(internal.platformStripe.applyStripeInvoicePaid, {
      stripeInvoiceId: 'in_123',
    })
    const first = await t.run(async (ctx) => ctx.db.get(invoiceId))
    const secondResult = await t.mutation(
      internal.platformStripe.applyStripeInvoicePaid,
      { stripeInvoiceId: 'in_123' },
    )
    const second = await t.run(async (ctx) => ctx.db.get(invoiceId))

    expect(secondResult).toBeNull()
    expect(second?.paidAt).toBe(first?.paidAt)
  })

  it('no-ops for unknown Stripe invoice ids', async () => {
    const t = createTestConvex()
    const result = await t.mutation(
      internal.platformStripe.applyStripeInvoicePaid,
      { stripeInvoiceId: 'in_unknown' },
    )
    expect(result).toBeNull()
  })
})
