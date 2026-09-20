import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

const ORG = 'org_agency_billing'
const ADMIN = { subject: 'user_agency_admin' }
const VIEWER = { subject: 'user_agency_caregiver' }

async function seedAgency(t: ReturnType<typeof createTestConvex>) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: ORG,
      name: 'Billing Agency',
      slug: 'billing-agency',
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: ADMIN.subject,
      role: 'org:admin',
      displayName: 'Admin',
      email: 'admin@example.com',
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: VIEWER.subject,
      role: 'org:caregiver',
      displayName: 'Viewer',
      email: 'viewer@example.com',
    })
    return tenantId
  })
}

async function seedSubscriptionAndInvoices(
  t: ReturnType<typeof createTestConvex>,
  tenantId: Id<'tenants'>,
) {
  await t.run(async (ctx) => {
    await ctx.db.insert('pricingPlans', {
      key: 'starter',
      label: 'Starter',
      basePrice: 199,
      includedSeats: 10,
      perSeatPrice: 20,
      active: true,
      includedProducts: ['hiring'],
    })
    await ctx.db.insert('tenantSubscriptions', {
      tenantId,
      planKey: 'starter',
      status: 'active',
      billingEmails: ['billing@example.com'],
      currentPeriodStart: '2026-09-01',
      currentPeriodEnd: '2026-09-30',
      renewsAt: '2026-10-01',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    })
    const base = {
      tenantId,
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      dueDate: '2026-10-05',
      lineItems: [
        { description: 'Starter plan', quantity: 1, unitPrice: 199, amount: 199, source: 'auto' as const },
      ],
      subtotal: 199,
      total: 199,
      createdBy: 'platform_admin',
    }
    await ctx.db.insert('platformInvoices', {
      ...base,
      invoiceNumber: 'INV-1001',
      status: 'sent',
      stripeHostedInvoiceUrl: 'https://pay.stripe.com/invoice/test',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    })
    await ctx.db.insert('platformInvoices', {
      ...base,
      invoiceNumber: 'INV-1000',
      status: 'draft',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    })
  })
}

describe('agencyBilling', () => {
  it('returns the subscription with its plan for a tenant admin', async () => {
    const t = createTestConvex()
    const tenantId = await seedAgency(t)
    await seedSubscriptionAndInvoices(t, tenantId)

    const result = await t.withIdentity(ADMIN).query(
      api.agencyBilling.getMySubscription,
      { clerkOrgId: ORG },
    )

    expect(result?.subscription.planKey).toBe('starter')
    expect(result?.plan?.label).toBe('Starter')
    expect(result?.plan?.basePrice).toBe(199)
  })

  it('lists only non-draft invoices for the caller tenant, newest first', async () => {
    const t = createTestConvex()
    const tenantId = await seedAgency(t)
    await seedSubscriptionAndInvoices(t, tenantId)

    const result = await t.withIdentity(ADMIN).query(
      api.agencyBilling.listMyInvoices,
      { clerkOrgId: ORG },
    )

    expect(result).toHaveLength(1)
    expect(result[0].invoiceNumber).toBe('INV-1001')
    expect(result[0].stripeHostedInvoiceUrl).toBe(
      'https://pay.stripe.com/invoice/test',
    )
  })

  it('returns null when the tenant has no subscription', async () => {
    const t = createTestConvex()
    await seedAgency(t)

    const result = await t.withIdentity(ADMIN).query(
      api.agencyBilling.getMySubscription,
      { clerkOrgId: ORG },
    )

    expect(result).toBeNull()
  })

  it('rejects non-admin members', async () => {
    const t = createTestConvex()
    const tenantId = await seedAgency(t)
    await seedSubscriptionAndInvoices(t, tenantId)

    await expect(
      t.withIdentity(VIEWER).query(api.agencyBilling.getMySubscription, {
        clerkOrgId: ORG,
      }),
    ).rejects.toThrow()
    await expect(
      t.withIdentity(VIEWER).query(api.agencyBilling.listMyInvoices, {
        clerkOrgId: ORG,
      }),
    ).rejects.toThrow()
  })
})
