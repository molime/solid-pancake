import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

type TestConvex = ReturnType<typeof createTestConvex>

const CLERK_ORG_ID = 'org_clients_test'
const ADMIN_ID = 'user_admin_clients'
const HR_ID = 'user_hr_clients'
const COORDINATOR_ID = 'user_coordinator_clients'
const CAREGIVER_ID = 'user_caregiver_clients'

async function seedTenant(t: TestConvex) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: CLERK_ORG_ID,
      name: 'Clients Agency',
      slug: 'clients-agency',
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: ADMIN_ID,
      role: 'org:admin',
      displayName: 'Admin',
      email: 'admin@example.com',
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: HR_ID,
      role: 'org:hr',
      displayName: 'HR',
      email: 'hr@example.com',
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: COORDINATOR_ID,
      role: 'org:coordinator',
      displayName: 'Coordinator',
      email: 'coordinator@example.com',
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: CAREGIVER_ID,
      role: 'org:caregiver',
      displayName: 'Caregiver',
      email: 'caregiver@example.com',
    })
    const clientId = await ctx.db.insert('clients', {
      tenantId,
      displayName: 'Alex Rivera',
      serviceType: 'SLS',
      authorizationHours: 40,
      riskFlags: [],
    })
    return { tenantId, clientId }
  })
}

function asAdmin(t: TestConvex) {
  return t.withIdentity({
    subject: ADMIN_ID,
    org_id: CLERK_ORG_ID,
    org_role: 'org:admin',
  })
}

function asHr(t: TestConvex) {
  return t.withIdentity({
    subject: HR_ID,
    org_id: CLERK_ORG_ID,
    org_role: 'org:hr',
  })
}

function asCoordinator(t: TestConvex) {
  return t.withIdentity({
    subject: COORDINATOR_ID,
    org_id: CLERK_ORG_ID,
    org_role: 'org:coordinator',
  })
}

function asCaregiver(t: TestConvex) {
  return t.withIdentity({
    subject: CAREGIVER_ID,
    org_id: CLERK_ORG_ID,
    org_role: 'org:caregiver',
  })
}

async function insertShift(
  t: TestConvex,
  tenantId: Id<'tenants'>,
  clientId: Id<'clients'>,
  overrides: Record<string, unknown>,
) {
  return t.run(async (ctx) =>
    ctx.db.insert('shifts', {
      tenantId,
      clientId,
      caregiverId: CAREGIVER_ID,
      scheduledStart: '2026-08-10T09:00:00Z',
      scheduledEnd: '2026-08-10T13:00:00Z',
      status: 'approved',
      serviceType: 'SLS',
      rate: 28.5,
      ...overrides,
    }),
  )
}

describe('clients.create with profile fields', () => {
  it('stores the optional master-record fields when provided', async () => {
    const t = createTestConvex()
    await seedTenant(t)

    const clientId = await asAdmin(t).mutation(api.clients.create, {
      clerkOrgId: CLERK_ORG_ID,
      displayName: 'Jordan Lee',
      serviceType: 'ILS',
      authorizationHours: 20,
      riskFlags: ['fall-risk'],
      uci: 'UCI-12345',
      dob: '1980-05-14',
      regionalCenter: 'Alta California Regional Center',
      serviceCoordinatorName: 'Sam Chen',
      serviceCoordinatorEmail: 'sam@altaregional.org',
      vendorNumber: 'V12345',
      serviceCode: '520',
    })

    const client = await t.run(async (ctx) => ctx.db.get(clientId))
    expect(client).toMatchObject({
      displayName: 'Jordan Lee',
      uci: 'UCI-12345',
      dob: '1980-05-14',
      regionalCenter: 'Alta California Regional Center',
      serviceCoordinatorName: 'Sam Chen',
      serviceCoordinatorEmail: 'sam@altaregional.org',
      vendorNumber: 'V12345',
      serviceCode: '520',
    })
  })

  it('keeps existing behavior when profile fields are omitted', async () => {
    const t = createTestConvex()
    await seedTenant(t)

    const clientId = await asAdmin(t).mutation(api.clients.create, {
      clerkOrgId: CLERK_ORG_ID,
      displayName: 'No Profile',
      serviceType: 'SLS',
      authorizationHours: 30,
      riskFlags: [],
    })

    const client = await t.run(async (ctx) => ctx.db.get(clientId))
    expect(client?.uci).toBeUndefined()
    expect(client?.emergencyContacts).toBeUndefined()
  })
})

describe('clients.updateProfile', () => {
  it('patches profile fields for a coordinator and audits the change', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)

    await asCoordinator(t).mutation(api.clients.updateProfile, {
      clerkOrgId: CLERK_ORG_ID,
      clientId,
      uci: 'UCI-999',
      conservatorName: 'Pat Rivera',
      conservatorPhone: '555-0100',
      emergencyContacts: [
        { name: 'Pat Rivera', phone: '555-0100', relationship: 'Mother' },
      ],
      serviceCode: '896',
    })

    const client = await t.run(async (ctx) => ctx.db.get(clientId))
    expect(client).toMatchObject({
      uci: 'UCI-999',
      conservatorName: 'Pat Rivera',
      conservatorPhone: '555-0100',
      serviceCode: '896',
    })
    expect(client?.emergencyContacts).toHaveLength(1)

    const audits = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(audits.some((a) => a.action === 'client_profile_updated')).toBe(true)
  })

  it('does not touch legacy fields or unset fields', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)

    await asAdmin(t).mutation(api.clients.updateProfile, {
      clerkOrgId: CLERK_ORG_ID,
      clientId,
      vendorNumber: 'V777',
    })

    const client = await t.run(async (ctx) => ctx.db.get(clientId))
    expect(client?.displayName).toBe('Alex Rivera')
    expect(client?.authorizationHours).toBe(40)
    expect(client?.vendorNumber).toBe('V777')
    expect(client?.uci).toBeUndefined()
  })

  it('rejects invalid dob and nameless emergency contacts', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)

    await expect(
      asAdmin(t).mutation(api.clients.updateProfile, {
        clerkOrgId: CLERK_ORG_ID,
        clientId,
        dob: '05/14/1980',
      }),
    ).rejects.toThrow('ISO date')

    await expect(
      asAdmin(t).mutation(api.clients.updateProfile, {
        clerkOrgId: CLERK_ORG_ID,
        clientId,
        emergencyContacts: [{ name: ' ', phone: '555', relationship: '' }],
      }),
    ).rejects.toThrow('name')
  })

  it('rejects caregivers', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)

    await expect(
      asCaregiver(t).mutation(api.clients.updateProfile, {
        clerkOrgId: CLERK_ORG_ID,
        clientId,
        uci: 'UCI-1',
      }),
    ).rejects.toThrow('org:admin')
  })
})

describe('clients.getMonthlyUsage', () => {
  it('sums approved and billing_ready shifts in the month only', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)

    // Approved, scheduled window 4h → delivered.
    await insertShift(t, tenantId, clientId, { status: 'approved' })
    // Billing ready with punches: 10:00–12:30 → 2.5h (punches win).
    await insertShift(t, tenantId, clientId, {
      status: 'billing_ready',
      clockInAt: '2026-08-11T10:00:00Z',
      clockOutAt: '2026-08-11T12:30:00Z',
    })
    // Submitted → not delivered yet.
    await insertShift(t, tenantId, clientId, { status: 'submitted' })
    // Approved but outside the month.
    await insertShift(t, tenantId, clientId, {
      status: 'approved',
      scheduledStart: '2026-09-01T09:00:00Z',
      scheduledEnd: '2026-09-01T13:00:00Z',
    })
    // Approved in-month but for another client.
    const otherClientId = await t.run(async (ctx) =>
      ctx.db.insert('clients', {
        tenantId,
        displayName: 'Other Client',
        serviceType: 'SLS',
        authorizationHours: 10,
        riskFlags: [],
      }),
    )
    await insertShift(t, tenantId, otherClientId, { status: 'approved' })

    const usage = await asHr(t).query(api.clients.getMonthlyUsage, {
      clerkOrgId: CLERK_ORG_ID,
      clientId,
      month: '2026-08',
    })

    expect(usage.month).toBe('2026-08')
    expect(usage.deliveredHours).toBe(6.5)
    expect(usage.authorizedHours).toBe(40)
  })

  it('rejects a malformed month', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)

    await expect(
      asAdmin(t).query(api.clients.getMonthlyUsage, {
        clerkOrgId: CLERK_ORG_ID,
        clientId,
        month: 'August 2026',
      }),
    ).rejects.toThrow('YYYY-MM')
  })

  it('rejects caregivers', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)

    await expect(
      asCaregiver(t).query(api.clients.getMonthlyUsage, {
        clerkOrgId: CLERK_ORG_ID,
        clientId,
      }),
    ).rejects.toThrow('org:admin')
  })
})
