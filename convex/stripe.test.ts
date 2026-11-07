import { describe, it, expect, vi, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api, internal } from './_generated/api'
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

  it('sends collection_method + default_payment_method for auto-charge', async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => new Response(JSON.stringify({ id: 'in_1' }), { status: 200 }))
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
        collectionMethod: 'charge_automatically',
        defaultPaymentMethod: 'pm_123',
      })
    } finally {
      if (original === undefined) {
        delete process.env.STRIPE_SECRET_KEY
      } else {
        process.env.STRIPE_SECRET_KEY = original
      }
    }

    const invoiceCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).endsWith('/invoices'),
    )
    expect(invoiceCall).toBeDefined()
    const params = new URLSearchParams(
      (invoiceCall as unknown as [string, { body: string }])[1].body,
    )
    expect(params.get('collection_method')).toBe('charge_automatically')
    expect(params.get('default_payment_method')).toBe('pm_123')
    // due_date is only valid for send_invoice invoices.
    expect(params.has('due_date')).toBe(false)
  })

  it('defaults to send_invoice with due_date when no method is given', async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => new Response(JSON.stringify({ id: 'in_1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const original = process.env.STRIPE_SECRET_KEY
    process.env.STRIPE_SECRET_KEY = 'sk_test_key'

    try {
      const t = createTestConvex()
      await t.action(internal._utils.stripe.createStripeInvoice, {
        customerId: 'cus_1',
        dueDate: '2026-08-15',
        lineItems: [],
      })
    } finally {
      if (original === undefined) {
        delete process.env.STRIPE_SECRET_KEY
      } else {
        process.env.STRIPE_SECRET_KEY = original
      }
    }

    const invoiceCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).endsWith('/invoices'),
    )
    const params = new URLSearchParams(
      (invoiceCall as unknown as [string, { body: string }])[1].body,
    )
    expect(params.get('collection_method')).toBe('send_invoice')
    expect(params.get('due_date')).toBeTruthy()
    expect(params.has('default_payment_method')).toBe(false)
  })

  it('sets both payment method types on the invoice for card_and_ach', async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => new Response(JSON.stringify({ id: 'in_1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const original = process.env.STRIPE_SECRET_KEY
    process.env.STRIPE_SECRET_KEY = 'sk_test_key'

    try {
      const t = createTestConvex()
      await t.action(internal._utils.stripe.createStripeInvoice, {
        customerId: 'cus_1',
        dueDate: '2026-08-15',
        lineItems: [],
        paymentMethodAllowed: 'card_and_ach',
      })
    } finally {
      if (original === undefined) {
        delete process.env.STRIPE_SECRET_KEY
      } else {
        process.env.STRIPE_SECRET_KEY = original
      }
    }

    const invoiceCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).endsWith('/invoices'),
    )
    const params = new URLSearchParams(
      (invoiceCall as unknown as [string, { body: string }])[1].body,
    )
    expect(params.get('payment_settings[payment_method_types][0]')).toBe(
      'card',
    )
    expect(params.get('payment_settings[payment_method_types][1]')).toBe(
      'us_bank_account',
    )
  })
})

describe('createCheckoutSession', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('restricts payment_method_types to exactly the allowed method', async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(
      async () =>
        new Response(
          JSON.stringify({ id: 'cs_1', url: 'https://checkout.stripe.com/x' }),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const original = process.env.STRIPE_SECRET_KEY
    process.env.STRIPE_SECRET_KEY = 'sk_test_key'

    try {
      const t = createTestConvex()
      const result = await t.action(internal._utils.stripe.createCheckoutSession, {
        customerId: 'cus_1',
        paymentMethodAllowed: 'us_bank_account',
        successUrl: 'https://app.test/?payment_setup=success',
        cancelUrl: 'https://app.test/?payment_setup=cancelled',
      })
      expect(result.url).toBe('https://checkout.stripe.com/x')
    } finally {
      if (original === undefined) {
        delete process.env.STRIPE_SECRET_KEY
      } else {
        process.env.STRIPE_SECRET_KEY = original
      }
    }

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ]
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions')
    const params = new URLSearchParams(init.body)
    expect(params.get('mode')).toBe('setup')
    expect(params.get('customer')).toBe('cus_1')
    expect(params.get('payment_method_types[0]')).toBe('us_bank_account')
    // Exactly one method — the owner cannot swap card ↔ ACH.
    expect(params.has('payment_method_types[1]')).toBe(false)
    expect(params.get('success_url')).toBe(
      'https://app.test/?payment_setup=success',
    )
  })

  it('offers both card and ACH when paymentMethodAllowed is card_and_ach', async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(
      async () =>
        new Response(
          JSON.stringify({ id: 'cs_1', url: 'https://checkout.stripe.com/x' }),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const original = process.env.STRIPE_SECRET_KEY
    process.env.STRIPE_SECRET_KEY = 'sk_test_key'

    try {
      const t = createTestConvex()
      await t.action(internal._utils.stripe.createCheckoutSession, {
        customerId: 'cus_1',
        paymentMethodAllowed: 'card_and_ach',
        successUrl: 'https://app.test/?payment_setup=success',
        cancelUrl: 'https://app.test/?payment_setup=cancelled',
      })
    } finally {
      if (original === undefined) {
        delete process.env.STRIPE_SECRET_KEY
      } else {
        process.env.STRIPE_SECRET_KEY = original
      }
    }

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ]
    const params = new URLSearchParams(init.body)
    expect(params.get('payment_method_types[0]')).toBe('card')
    expect(params.get('payment_method_types[1]')).toBe('us_bank_account')
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

describe('applyStripeInvoiceFailed (dunning)', () => {
  const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000

  async function seedPastDuable(t: ReturnType<typeof createTestConvex>) {
    return await t.run(async (ctx) => {
      const now = new Date().toISOString()
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId: 'org_dunning',
        name: 'Dunning Care',
        slug: 'dunning-care',
        createdAt: now,
      })
      const subscriptionId = await ctx.db.insert('tenantSubscriptions', {
        tenantId,
        planKey: 'starter',
        status: 'active',
        billingEmails: ['billing@dunning.test'],
        currentPeriodStart: '2026-07-01',
        currentPeriodEnd: '2026-08-01',
        createdAt: now,
        updatedAt: now,
      })
      const invoiceId = await ctx.db.insert('platformInvoices', {
        tenantId,
        invoiceNumber: 'PLAT-2026-0007',
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
        stripeInvoiceId: 'in_fail',
        createdBy: 'admin_1',
        createdAt: now,
        updatedAt: now,
      })
      return { tenantId, subscriptionId, invoiceId }
    })
  }

  it('maps invoice.payment_failed to overdue invoice + past_due subscription', async () => {
    const t = createTestConvex()
    const { subscriptionId, invoiceId } = await seedPastDuable(t)

    await t.mutation(internal.platformStripe.applyStripeInvoiceFailed, {
      stripeInvoiceId: 'in_fail',
    })

    const invoice = await t.run(async (ctx) => ctx.db.get(invoiceId))
    expect(invoice?.status).toBe('overdue')

    const subscription = await t.run(async (ctx) => ctx.db.get(subscriptionId))
    expect(subscription?.status).toBe('past_due')
    expect(subscription?.pastDueSince).toBeTypeOf('number')
    expect(subscription?.graceUntil).toBeTypeOf('number')
    // Grace window is exactly 5 days from the failure.
    expect(subscription!.graceUntil! - subscription!.pastDueSince!).toBe(
      FIVE_DAYS_MS,
    )

    const audits = await t.run(async (ctx) =>
      ctx.db.query('auditEvents').collect(),
    )
    expect(
      audits.some((event) => event.action === 'invoice_payment_failed'),
    ).toBe(true)
  })

  it('recomputes grace dates on repeat failures without stacking', async () => {
    const t = createTestConvex()
    const { subscriptionId } = await seedPastDuable(t)

    await t.mutation(internal.platformStripe.applyStripeInvoiceFailed, {
      stripeInvoiceId: 'in_fail',
    })
    const first = await t.run(async (ctx) => ctx.db.get(subscriptionId))

    await new Promise((resolve) => setTimeout(resolve, 5))
    await t.mutation(internal.platformStripe.applyStripeInvoiceFailed, {
      stripeInvoiceId: 'in_fail',
    })
    const second = await t.run(async (ctx) => ctx.db.get(subscriptionId))

    expect(second?.status).toBe('past_due')
    // Recomputed, never stacked: still exactly one 5-day window wide.
    expect(second!.graceUntil! - second!.pastDueSince!).toBe(FIVE_DAYS_MS)
    expect(second!.graceUntil!).toBeGreaterThanOrEqual(first!.graceUntil!)
  })

  it('no-ops for unknown Stripe invoice ids', async () => {
    const t = createTestConvex()
    const result = await t.mutation(
      internal.platformStripe.applyStripeInvoiceFailed,
      { stripeInvoiceId: 'in_unknown' },
    )
    expect(result).toBeNull()
  })

  it('invoice.paid after a failure restores active and clears dunning dates', async () => {
    const t = createTestConvex()
    const { subscriptionId, invoiceId } = await seedPastDuable(t)

    await t.mutation(internal.platformStripe.applyStripeInvoiceFailed, {
      stripeInvoiceId: 'in_fail',
    })
    await t.mutation(internal.platformStripe.applyStripeInvoicePaid, {
      stripeInvoiceId: 'in_fail',
    })

    const invoice = await t.run(async (ctx) => ctx.db.get(invoiceId))
    expect(invoice?.status).toBe('paid')

    const subscription = await t.run(async (ctx) => ctx.db.get(subscriptionId))
    expect(subscription?.status).toBe('active')
    expect(subscription?.pastDueSince).toBeUndefined()
    expect(subscription?.graceUntil).toBeUndefined()
  })

  it('no-ops on a redelivered failure for an already-paid invoice', async () => {
    const t = createTestConvex()
    const { subscriptionId, invoiceId } = await seedPastDuable(t)

    await t.mutation(internal.platformStripe.applyStripeInvoicePaid, {
      stripeInvoiceId: 'in_fail',
    })
    // Out-of-order delivery: payment_failed arrives after invoice.paid.
    const result = await t.mutation(
      internal.platformStripe.applyStripeInvoiceFailed,
      { stripeInvoiceId: 'in_fail' },
    )
    expect(result).toBeNull()

    const invoice = await t.run(async (ctx) => ctx.db.get(invoiceId))
    expect(invoice?.status).toBe('paid')

    const subscription = await t.run(async (ctx) => ctx.db.get(subscriptionId))
    expect(subscription?.status).toBe('active')
    expect(subscription?.pastDueSince).toBeUndefined()
    expect(subscription?.graceUntil).toBeUndefined()

    const audits = await t.run(async (ctx) =>
      ctx.db.query('auditEvents').collect(),
    )
    expect(
      audits.some((event) => event.action === 'invoice_payment_failed'),
    ).toBe(false)
  })
})

describe('checkOverdueSubscriptionInvoices (daily cron)', () => {
  const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000

  async function seedSentInvoice(
    t: ReturnType<typeof createTestConvex>,
    dueDate: string,
    status: 'sent' | 'paid' | 'void' = 'sent',
  ) {
    return await t.run(async (ctx) => {
      const now = new Date().toISOString()
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId: 'org_overdue',
        name: 'Overdue Care',
        slug: 'overdue-care',
        createdAt: now,
      })
      const subscriptionId = await ctx.db.insert('tenantSubscriptions', {
        tenantId,
        planKey: 'starter',
        status: 'active',
        billingEmails: ['billing@overdue.test'],
        currentPeriodStart: '2026-10-01',
        currentPeriodEnd: '2026-11-01',
        createdAt: now,
        updatedAt: now,
      })
      const invoiceId = await ctx.db.insert('platformInvoices', {
        tenantId,
        invoiceNumber: 'PLAT-2026-0099',
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        dueDate,
        lineItems: [
          {
            description: 'Base price',
            quantity: 1,
            unitPrice: 199,
            amount: 199,
            source: 'manual',
          },
        ],
        subtotal: 199,
        total: 199,
        status,
        createdBy: 'admin_1',
        createdAt: now,
        updatedAt: now,
      })
      return { tenantId, subscriptionId, invoiceId }
    })
  }

  it('flips past-due sent invoices to overdue and duns the subscription', async () => {
    const t = createTestConvex()
    const { subscriptionId, invoiceId } = await seedSentInvoice(
      t,
      '2020-01-01',
    )

    await t.mutation(internal.platformStripe.checkOverdueSubscriptionInvoices, {})

    const invoice = await t.run(async (ctx) => ctx.db.get(invoiceId))
    expect(invoice?.status).toBe('overdue')

    const subscription = await t.run(async (ctx) => ctx.db.get(subscriptionId))
    expect(subscription?.status).toBe('past_due')
    // Grace is anchored to the due date: due end-of-day + 5 days.
    expect(subscription?.pastDueSince).toBe(
      new Date('2020-01-01T00:00:00Z').getTime(),
    )
    expect(subscription?.graceUntil).toBe(
      new Date('2020-01-01T23:59:59Z').getTime() + FIVE_DAYS_MS,
    )

    const audits = await t.run(async (ctx) =>
      ctx.db.query('auditEvents').collect(),
    )
    expect(audits.some((event) => event.action === 'invoice_overdue')).toBe(
      true,
    )
  })

  it('leaves future-due and non-sent invoices untouched', async () => {
    const t = createTestConvex()
    const { subscriptionId, invoiceId } = await seedSentInvoice(
      t,
      '2999-01-01',
    )

    const result = await t.mutation(
      internal.platformStripe.checkOverdueSubscriptionInvoices,
      {},
    )
    expect(result.processed).toBe(0)

    const invoice = await t.run(async (ctx) => ctx.db.get(invoiceId))
    expect(invoice?.status).toBe('sent')
    const subscription = await t.run(async (ctx) => ctx.db.get(subscriptionId))
    expect(subscription?.status).toBe('active')
  })

  it('marks a past-due un-mirrored draft as overdue and duns its subscription', async () => {
    const t = createTestConvex()
    const { subscriptionId, invoiceId } = await seedSentInvoice(
      t,
      '2020-01-01',
      'draft',
    )

    await t.mutation(internal.platformStripe.checkOverdueSubscriptionInvoices, {})

    const invoice = await t.run(async (ctx) => ctx.db.get(invoiceId))
    expect(invoice?.status).toBe('overdue')

    const audits = await t.run(async (ctx) =>
      ctx.db.query('auditEvents').collect(),
    )
    expect(audits.some((event) => event.action === 'invoice_overdue')).toBe(
      true,
    )
    const subscription = await t.run(async (ctx) => ctx.db.get(subscriptionId))
    expect(subscription?.status).toBe('past_due')
    expect(subscription?.pastDueSince).toBe(
      new Date('2020-01-01T00:00:00Z').getTime(),
    )
    expect(subscription?.graceUntil).toBe(
      new Date('2020-01-01T23:59:59Z').getTime() + FIVE_DAYS_MS,
    )
  })

  it('skips $0 drafts (no overdue, no past_due)', async () => {
    const t = createTestConvex()
    const { invoiceId } = await seedSentInvoice(t, '2020-01-01', 'draft')
    // Zero total: only the total>0 filter can exclude it.
    await t.run(async (ctx) => {
      await ctx.db.patch(invoiceId, { total: 0, subtotal: 0 })
    })

    const result = await t.mutation(
      internal.platformStripe.checkOverdueSubscriptionInvoices,
      {},
    )
    expect(result.processed).toBe(0)

    const invoice = await t.run(async (ctx) => ctx.db.get(invoiceId))
    expect(invoice?.status).toBe('draft')
  })
})

describe('suspendPastDueTenants (daily cron)', () => {
  async function seedPastDueSubscription(
    t: ReturnType<typeof createTestConvex>,
    graceUntil: number,
  ) {
    return await t.run(async (ctx) => {
      const now = new Date().toISOString()
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId: 'org_suspend',
        name: 'Suspend Care',
        slug: 'suspend-care',
        createdAt: now,
      })
      const subscriptionId = await ctx.db.insert('tenantSubscriptions', {
        tenantId,
        planKey: 'starter',
        status: 'past_due',
        billingEmails: ['billing@suspend.test'],
        currentPeriodStart: '2026-10-01',
        currentPeriodEnd: '2026-11-01',
        pastDueSince: Date.now() - 10 * 24 * 60 * 60 * 1000,
        graceUntil,
        createdAt: now,
        updatedAt: now,
      })
      return { tenantId, subscriptionId }
    })
  }

  it('suspends past_due tenants whose grace window expired', async () => {
    const t = createTestConvex()
    const { subscriptionId } = await seedPastDueSubscription(t, Date.now() - 1)

    const result = await t.mutation(
      internal.platformStripe.suspendPastDueTenants,
      {},
    )
    expect(result.suspended).toBe(1)

    const subscription = await t.run(async (ctx) => ctx.db.get(subscriptionId))
    expect(subscription?.status).toBe('suspended')

    const audits = await t.run(async (ctx) =>
      ctx.db.query('auditEvents').collect(),
    )
    expect(audits.some((event) => event.action === 'tenant_suspended')).toBe(
      true,
    )
  })

  it('leaves tenants inside the grace window alone', async () => {
    const t = createTestConvex()
    const { subscriptionId } = await seedPastDueSubscription(
      t,
      Date.now() + 24 * 60 * 60 * 1000,
    )

    const result = await t.mutation(
      internal.platformStripe.suspendPastDueTenants,
      {},
    )
    expect(result.suspended).toBe(0)

    const subscription = await t.run(async (ctx) => ctx.db.get(subscriptionId))
    expect(subscription?.status).toBe('past_due')
  })
})

describe('suspension recovery on payment', () => {
  it('applyStripeInvoicePaid lifts a suspension and clears dunning dates', async () => {
    const t = createTestConvex()
    const { subscriptionId, invoiceId } = await t.run(async (ctx) => {
      const now = new Date().toISOString()
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId: 'org_recovery',
        name: 'Recovery Care',
        slug: 'recovery-care',
        createdAt: now,
      })
      const subscriptionId = await ctx.db.insert('tenantSubscriptions', {
        tenantId,
        planKey: 'starter',
        status: 'suspended',
        billingEmails: ['billing@recovery.test'],
        currentPeriodStart: '2026-10-01',
        currentPeriodEnd: '2026-11-01',
        pastDueSince: Date.now() - 10 * 24 * 60 * 60 * 1000,
        graceUntil: Date.now() - 1000,
        createdAt: now,
        updatedAt: now,
      })
      const invoiceId = await ctx.db.insert('platformInvoices', {
        tenantId,
        invoiceNumber: 'PLAT-2026-0100',
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        dueDate: '2026-10-01',
        lineItems: [
          {
            description: 'Base price',
            quantity: 1,
            unitPrice: 199,
            amount: 199,
            source: 'manual',
          },
        ],
        subtotal: 199,
        total: 199,
        status: 'overdue',
        stripeInvoiceId: 'in_recovery',
        createdBy: 'admin_1',
        createdAt: now,
        updatedAt: now,
      })
      return { subscriptionId, invoiceId }
    })

    await t.mutation(internal.platformStripe.applyStripeInvoicePaid, {
      stripeInvoiceId: 'in_recovery',
    })

    const invoice = await t.run(async (ctx) => ctx.db.get(invoiceId))
    expect(invoice?.status).toBe('paid')

    const subscription = await t.run(async (ctx) => ctx.db.get(subscriptionId))
    expect(subscription?.status).toBe('active')
    expect(subscription?.pastDueSince).toBeUndefined()
    expect(subscription?.graceUntil).toBeUndefined()
  })
})

describe('saveStripeDefaultPaymentMethod', () => {
  it('persists the payment method on the subscription by customer id', async () => {
    const t = createTestConvex()
    const subscriptionId = await t.run(async (ctx) => {
      const now = new Date().toISOString()
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId: 'org_pm',
        name: 'PM Care',
        slug: 'pm-care',
        createdAt: now,
      })
      return await ctx.db.insert('tenantSubscriptions', {
        tenantId,
        planKey: 'starter',
        status: 'active',
        billingEmails: ['billing@pm.test'],
        currentPeriodStart: '2026-07-01',
        currentPeriodEnd: '2026-08-01',
        stripeCustomerId: 'cus_pm',
        createdAt: now,
        updatedAt: now,
      })
    })

    await t.mutation(internal.platformStripe.saveStripeDefaultPaymentMethod, {
      stripeCustomerId: 'cus_pm',
      paymentMethodId: 'pm_abc',
    })
    const subscription = await t.run(async (ctx) => ctx.db.get(subscriptionId))
    expect(subscription?.stripeDefaultPaymentMethod).toBe('pm_abc')

    // Webhook replay: re-attaching the same method is a no-op.
    const replay = await t.mutation(
      internal.platformStripe.saveStripeDefaultPaymentMethod,
      { stripeCustomerId: 'cus_pm', paymentMethodId: 'pm_abc' },
    )
    expect(replay).toBe(subscriptionId)
    const audits = await t.run(async (ctx) =>
      ctx.db.query('auditEvents').collect(),
    )
    expect(
      audits.filter((event) => event.action === 'payment_method_attached'),
    ).toHaveLength(1)
  })

  it('no-ops for unknown Stripe customer ids', async () => {
    const t = createTestConvex()
    const result = await t.mutation(
      internal.platformStripe.saveStripeDefaultPaymentMethod,
      { stripeCustomerId: 'cus_unknown', paymentMethodId: 'pm_abc' },
    )
    expect(result).toBeNull()
  })
})

describe('sendPaymentSetupEmail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.APP_URL
  })

  const PLATFORM_ADMIN = { subject: 'platform_admin_1' }

  async function seedTenantWithSubscription(
    t: ReturnType<typeof createTestConvex>,
    options: { billingEmails: string[]; stripeCustomerId?: string },
  ) {
    await t.run(async (ctx) => {
      await ctx.db.insert('platformAdmins', {
        clerkUserId: PLATFORM_ADMIN.subject,
        createdAt: new Date().toISOString(),
      })
    })
    return t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId: 'org_setup_email',
        name: 'Setup Email Agency',
        slug: 'setup-email-agency',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('tenantSubscriptions', {
        tenantId,
        planKey: 'starter',
        status: 'active',
        billingEmails: options.billingEmails,
        currentPeriodStart: '2026-09-01',
        currentPeriodEnd: '2026-09-30',
        ...(options.stripeCustomerId
          ? { stripeCustomerId: options.stripeCustomerId }
          : {}),
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      })
      return tenantId
    })
  }

  it('rejects when the tenant has no billing emails', async () => {
    const t = createTestConvex()
    process.env.STRIPE_SECRET_KEY = 'sk_test_key'
    process.env.APP_URL = 'http://localhost:5173'
    const tenantId = await seedTenantWithSubscription(t, { billingEmails: [] })

    await expect(
      t.withIdentity(PLATFORM_ADMIN).action(
        api.platformStripe.sendPaymentSetupEmail,
        { tenantId },
      ),
    ).rejects.toThrow(/no billing emails/i)
  })

  it('creates the customer on first use, emails the setup link, and audits', async () => {
    const t = createTestConvex()
    process.env.STRIPE_SECRET_KEY = 'sk_test_key'
    process.env.APP_URL = 'http://localhost:5173'
    const tenantId = await seedTenantWithSubscription(t, {
      billingEmails: ['owner@agency.example.com'],
    })

    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        calls.push(url)
        if (url.includes('/v1/customers')) {
          return new Response(JSON.stringify({ id: 'cus_test_123' }), {
            status: 200,
          })
        }
        if (url.includes('/v1/checkout/sessions')) {
          return new Response(
            JSON.stringify({ url: 'https://checkout.stripe.com/pay/cs_test' }),
            { status: 200 },
          )
        }
        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )

    const result = await t.withIdentity(PLATFORM_ADMIN).action(
      api.platformStripe.sendPaymentSetupEmail,
      { tenantId },
    )

    expect(result.sentTo).toEqual(['owner@agency.example.com'])
    expect(calls.some((u) => u.includes('/v1/customers'))).toBe(true)
    expect(calls.some((u) => u.includes('/v1/checkout/sessions'))).toBe(true)

    const subscription = await t.run(async (ctx) => {
      const tenant = await ctx.db.get(tenantId)
      return ctx.db
        .query('tenantSubscriptions')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenant!._id))
        .unique()
    })
    expect(subscription?.stripeCustomerId).toBe('cus_test_123')

    const audit = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .filter((q) => q.eq(q.field('action'), 'payment_setup_email_sent'))
        .first(),
    )
    expect(audit).not.toBeNull()
  })
})

/**
 * Let queued runAfter(0, ...) callbacks fire (real setTimeout) and drain the
 * scheduled functions they registered, across a few iterations so nested
 * schedules are picked up too.
 */
async function drainScheduled(t: ReturnType<typeof createTestConvex>) {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
    await t.finishInProgressScheduledFunctions()
  }
}

describe('checkout.session.completed charges un-mirrored drafts', () => {
  const WEBHOOK_SECRET = 'whsec_checkout_test'
  const PLATFORM_ADMIN = { subject: 'platform_admin_1' }

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.STRIPE_WEBHOOK_SECRET
    delete process.env.STRIPE_SECRET_KEY
  })

  function signEvent(body: string) {
    const timestamp = Math.floor(Date.now() / 1000)
    const v1 = createHmac('sha256', WEBHOOK_SECRET)
      .update(`${timestamp}.${body}`)
      .digest('hex')
    return `t=${timestamp},v1=${v1}`
  }

  async function postWebhook(
    t: ReturnType<typeof createTestConvex>,
    event: { id: string; type: string; object: Record<string, unknown> },
  ) {
    const body = JSON.stringify({
      id: event.id,
      type: event.type,
      data: { object: event.object },
    })
    return await t.fetch('/stripe-webhook', {
      method: 'POST',
      headers: {
        'Stripe-Signature': signEvent(body),
        'Content-Type': 'application/json',
      },
      body,
    })
  }

  /** Tenant with Stripe customer cus_ga; drafts: $249 un-mirrored, $0, and already-mirrored. */
  async function seedTenantWithDrafts(t: ReturnType<typeof createTestConvex>) {
    return await t.run(async (ctx) => {
      const now = new Date().toISOString()
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId: 'org_ga',
        name: 'Golden Ages',
        slug: 'golden-ages',
        createdAt: now,
      })
      await ctx.db.insert('tenantSubscriptions', {
        tenantId,
        planKey: 'growth',
        status: 'active',
        billingEmails: ['billing@ga.test'],
        currentPeriodStart: '2026-10-01',
        currentPeriodEnd: '2026-10-31',
        stripeCustomerId: 'cus_ga',
        createdAt: now,
        updatedAt: now,
      })
      const base = {
        tenantId,
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        dueDate: '2026-11-14',
        createdBy: PLATFORM_ADMIN.subject,
        createdAt: now,
        updatedAt: now,
      }
      const pending = await ctx.db.insert('platformInvoices', {
        ...base,
        invoiceNumber: 'PLAT-2026-0009',
        lineItems: [
          {
            description: 'October subscription',
            quantity: 1,
            unitPrice: 249,
            amount: 249,
            source: 'manual',
          },
        ],
        subtotal: 249,
        total: 249,
        status: 'draft',
      })
      const zero = await ctx.db.insert('platformInvoices', {
        ...base,
        invoiceNumber: 'PLAT-2026-0010',
        lineItems: [],
        subtotal: 0,
        total: 0,
        status: 'draft',
      })
      const mirrored = await ctx.db.insert('platformInvoices', {
        ...base,
        invoiceNumber: 'PLAT-2026-0005',
        lineItems: [
          {
            description: 'September subscription',
            quantity: 1,
            unitPrice: 100,
            amount: 100,
            source: 'manual',
          },
        ],
        subtotal: 100,
        total: 100,
        status: 'draft',
        stripeInvoiceId: 'in_existing',
      })
      return { pending, zero, mirrored }
    })
  }

  /** Fake Stripe: checkout session + customer update + one mirror (create/finalize). */
  function stubStripeApi(calls: string[]) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        calls.push(url)
        if (url.includes('/v1/checkout/sessions/')) {
          return new Response(
            JSON.stringify({
              id: 'cs_ga',
              customer: 'cus_ga',
              setup_intent: { payment_method: 'pm_card' },
            }),
            { status: 200 },
          )
        }
        if (url.includes('/v1/customers/')) {
          return new Response(JSON.stringify({ id: 'cus_ga' }), {
            status: 200,
          })
        }
        if (url.endsWith('/v1/invoices')) {
          return new Response(JSON.stringify({ id: 'in_mirrored_1' }), {
            status: 200,
          })
        }
        if (url.includes('/v1/invoiceitems')) {
          return new Response(JSON.stringify({ id: 'ii_1' }), { status: 200 })
        }
        if (url.includes('/finalize')) {
          return new Response(
            JSON.stringify({
              id: 'in_mirrored_1',
              status: 'open',
              hosted_invoice_url: 'https://pay.stripe.com/x',
            }),
            { status: 200 },
          )
        }
        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )
  }

  it('mirrors the $249 un-mirrored draft and skips $0 and already-mirrored ones', async () => {
    const t = createTestConvex()
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
    process.env.STRIPE_SECRET_KEY = 'sk_test_key'
    const { pending, zero, mirrored } = await seedTenantWithDrafts(t)
    const calls: string[] = []
    stubStripeApi(calls)

    const response = await postWebhook(t, {
      id: 'evt_checkout_ga',
      type: 'checkout.session.completed',
      object: { id: 'cs_ga', mode: 'setup' },
    })
    expect(response.status).toBe(200)

    // The scheduled chargeUnmirroredDraftsForCustomer runs after the webhook.
    await drainScheduled(t)

    // Default PM persisted from the setup session.
    const subscription = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', 'org_ga'))
        .unique()
      return ctx.db
        .query('tenantSubscriptions')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenant!._id))
        .unique()
    })
    expect(subscription?.stripeDefaultPaymentMethod).toBe('pm_card')

    // The $249 draft was mirrored (auto-charge on finalize — no /send call).
    const pendingInvoice = await t.run(async (ctx) => ctx.db.get(pending))
    expect(pendingInvoice?.stripeInvoiceId).toBe('in_mirrored_1')
    expect(pendingInvoice?.stripeHostedInvoiceUrl).toBe('https://pay.stripe.com/x')

    // Exactly one Stripe invoice was created.
    const invoiceCreates = calls.filter((url) => url.endsWith('/v1/invoices'))
    expect(invoiceCreates).toHaveLength(1)
    expect(calls.some((url) => url.includes('/finalize'))).toBe(true)
    expect(calls.some((url) => url.includes('/v1/invoices/in_mirrored_1/send'))).toBe(
      false,
    )

    // The $0 draft and the already-mirrored draft were left alone.
    const zeroInvoice = await t.run(async (ctx) => ctx.db.get(zero))
    expect(zeroInvoice?.stripeInvoiceId).toBeUndefined()
    const mirroredInvoice = await t.run(async (ctx) => ctx.db.get(mirrored))
    expect(mirroredInvoice?.stripeInvoiceId).toBe('in_existing')
  })

  it('no-ops for a checkout session belonging to an unknown customer', async () => {
    const t = createTestConvex()
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
    process.env.STRIPE_SECRET_KEY = 'sk_test_key'
    const { pending } = await seedTenantWithDrafts(t)
    const calls: string[] = []
    stubStripeApi(calls)

    // Session reports a customer no subscription carries.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        calls.push(url)
        if (url.includes('/v1/checkout/sessions/')) {
          return new Response(
            JSON.stringify({
              id: 'cs_unknown',
              customer: 'cus_unknown',
              setup_intent: { payment_method: 'pm_card' },
            }),
            { status: 200 },
          )
        }
        if (url.includes('/v1/customers/')) {
          return new Response(JSON.stringify({ id: 'cus_unknown' }), {
            status: 200,
          })
        }
        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )

    const response = await postWebhook(t, {
      id: 'evt_checkout_unknown',
      type: 'checkout.session.completed',
      object: { id: 'cs_unknown', mode: 'setup' },
    })
    expect(response.status).toBe(200)
    await drainScheduled(t)

    // Golden Ages' draft is untouched — only the session/customer calls ran.
    const pendingInvoice = await t.run(async (ctx) => ctx.db.get(pending))
    expect(pendingInvoice?.stripeInvoiceId).toBeUndefined()
    expect(calls.some((url) => url.endsWith('/v1/invoices'))).toBe(false)

    // The action itself is a no-op for unknown customers.
    const result = await t.action(
      internal.platformStripe.chargeUnmirroredDraftsForCustomer,
      { stripeCustomerId: 'cus_unknown' },
    )
    expect(result).toEqual({ charged: 0, skipped: 0, failed: 0 })
  })
})

describe('createAndSendStripeInvoice zero-total guard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.STRIPE_SECRET_KEY
  })

  async function seedDraft(
    t: ReturnType<typeof createTestConvex>,
    total: number,
  ) {
    return await t.run(async (ctx) => {
      const now = new Date().toISOString()
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId: 'org_zero',
        name: total === 0 ? 'Zero Care' : 'Paid Care',
        slug: total === 0 ? 'zero-care' : 'paid-care',
        createdAt: now,
      })
      await ctx.db.insert('tenantSubscriptions', {
        tenantId,
        planKey: 'internal_test',
        status: 'active',
        billingEmails: ['billing@zero.test'],
        currentPeriodStart: '2026-10-01',
        currentPeriodEnd: '2026-10-31',
        stripeCustomerId: 'cus_zero',
        stripeDefaultPaymentMethod: 'pm_card',
        createdAt: now,
        updatedAt: now,
      })
      return await ctx.db.insert('platformInvoices', {
        tenantId,
        invoiceNumber: 'PLAT-2026-0011',
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        dueDate: '2026-11-14',
        lineItems: [],
        subtotal: total,
        total,
        status: 'draft',
        createdBy: 'admin_1',
        createdAt: now,
        updatedAt: now,
      })
    })
  }

  it('settles a $0 invoice as paid without calling Stripe', async () => {
    const t = createTestConvex()
    const invoiceId = await seedDraft(t, 0)
    const fetchMock = vi.fn(async () => {
      throw new Error('fetch must not be called for a zero-total invoice')
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await t.action(
      internal.platformStripe.createAndSendStripeInvoice,
      { invoiceId },
    )
    expect(result).toEqual({ skipped: true, stripeInvoiceId: '' })
    expect(fetchMock).not.toHaveBeenCalled()

    const invoice = await t.run(async (ctx) => ctx.db.get(invoiceId))
    expect(invoice?.status).toBe('paid')
    expect(invoice?.paidAt).toBeTruthy()

    const audit = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .filter((q) => q.eq(q.field('action'), 'stripe_invoice_zero_auto_settled'))
        .first(),
    )
    expect(audit).not.toBeNull()
  })

  it('non-zero invoices still mirror to Stripe', async () => {
    const t = createTestConvex()
    process.env.STRIPE_SECRET_KEY = 'sk_test_key'
    const invoiceId = await seedDraft(t, 199)
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        calls.push(url)
        if (url.endsWith('/v1/invoices')) {
          return new Response(JSON.stringify({ id: 'in_nonzero' }), {
            status: 200,
          })
        }
        if (url.includes('/v1/invoiceitems')) {
          return new Response(JSON.stringify({ id: 'ii_1' }), { status: 200 })
        }
        if (url.includes('/finalize')) {
          return new Response(
            JSON.stringify({ id: 'in_nonzero', status: 'open' }),
            { status: 200 },
          )
        }
        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )

    const result = await t.action(
      internal.platformStripe.createAndSendStripeInvoice,
      { invoiceId },
    )
    expect(result).toEqual({ skipped: false, stripeInvoiceId: 'in_nonzero' })

    const invoice = await t.run(async (ctx) => ctx.db.get(invoiceId))
    expect(invoice?.stripeInvoiceId).toBe('in_nonzero')
    expect(invoice?.status).toBe('draft')
  })
})

describe('createStripeInvoice parameter hygiene (GA mirror 400)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('never sends payment_settings[save_default_payment_method] (invalid on Invoices)', async () => {
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
          { description: 'Base price', quantity: 1, unitAmountCents: 24900, currency: 'usd' },
        ],
      })
    } finally {
      if (original === undefined) {
        delete process.env.STRIPE_SECRET_KEY
      } else {
        process.env.STRIPE_SECRET_KEY = original
      }
    }

    const invoiceCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).endsWith('/invoices'),
    )
    expect(invoiceCall).toBeDefined()
    const params = new URLSearchParams(
      (invoiceCall as unknown as [string, { body: string }])[1].body,
    )
    expect(params.has('payment_settings[save_default_payment_method]')).toBe(
      false,
    )
  })
})
