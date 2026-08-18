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

const CLERK_ORG_ID = 'org_evv_test'
const ADMIN_ID = 'user_admin_evv'
const COORDINATOR_ID = 'user_coordinator_evv'
const HR_ID = 'user_hr_evv'
const CAREGIVER_ID = 'user_caregiver_evv'
const LIVE_IN_CAREGIVER_ID = 'user_livein_evv'

async function seedTenant(t: TestConvex) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: CLERK_ORG_ID,
      name: 'EVV Agency',
      slug: 'evv-agency',
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
      clerkUserId: COORDINATOR_ID,
      role: 'org:coordinator',
      displayName: 'Coordinator',
      email: 'coordinator@example.com',
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
      clerkUserId: CAREGIVER_ID,
      role: 'org:caregiver',
      displayName: 'Caregiver One',
      email: 'caregiver@example.com',
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: LIVE_IN_CAREGIVER_ID,
      role: 'org:caregiver',
      displayName: 'Live-In Caregiver',
      email: 'livein@example.com',
    })

    const clientId = await ctx.db.insert('clients', {
      tenantId,
      displayName: 'Client One',
      serviceType: 'SLS',
      authorizationHours: 100,
      riskFlags: [],
      serviceAddress: {
        line1: '100 Main St',
        city: 'Sacramento',
        state: 'CA',
        postalCode: '95814',
      },
    })

    const liveInProfileId = await ctx.db.insert('employeeProfiles', {
      tenantId,
      clerkUserId: LIVE_IN_CAREGIVER_ID,
      displayName: 'Live-In Caregiver',
      email: 'livein@example.com',
      adpSyncStatus: 'synced',
      createdAt: new Date().toISOString(),
    })

    return { tenantId, clientId, liveInProfileId }
  })
}

function asAdmin(t: TestConvex) {
  return t.withIdentity({
    subject: ADMIN_ID,
    org_id: CLERK_ORG_ID,
    org_role: 'org:admin',
  })
}

function asCoordinator(t: TestConvex) {
  return t.withIdentity({
    subject: COORDINATOR_ID,
    org_id: CLERK_ORG_ID,
    org_role: 'org:coordinator',
  })
}

function asHr(t: TestConvex) {
  return t.withIdentity({
    subject: HR_ID,
    org_id: CLERK_ORG_ID,
    org_role: 'org:hr',
  })
}

function asCaregiver(t: TestConvex) {
  return t.withIdentity({
    subject: CAREGIVER_ID,
    org_id: CLERK_ORG_ID,
    org_role: 'org:caregiver',
  })
}

async function seedShift(
  t: TestConvex,
  tenantId: Id<'tenants'>,
  clientId: Id<'clients'>,
  overrides: Record<string, unknown> = {},
) {
  return t.run(async (ctx) =>
    ctx.db.insert('shifts', {
      tenantId,
      clientId,
      caregiverId: CAREGIVER_ID,
      scheduledStart: '2026-08-10T09:00:00.000Z',
      scheduledEnd: '2026-08-10T13:00:00.000Z',
      status: 'approved',
      serviceType: 'SLS',
      rate: 25,
      ...overrides,
    } as never),
  )
}

async function seedAttestation(
  t: TestConvex,
  tenantId: Id<'tenants'>,
  subjectId: string,
  overrides: Record<string, unknown> = {},
) {
  return t.run(async (ctx) => {
    const fileId = await ctx.db.insert('files', {
      tenantId,
      storageId: `storage_${subjectId}`,
      uploadedBy: ADMIN_ID,
      fileName: 'attestation.pdf',
      linkedType: 'complianceDoc',
      linkedId: subjectId,
      visibility: 'admins_coordinators',
      createdAt: new Date().toISOString(),
    })
    return ctx.db.insert('documentArchiveItems', {
      tenantId,
      fileId,
      subjectType: 'employee',
      subjectId,
      category: 'live_in_attestation',
      status: 'active',
      createdAt: new Date().toISOString(),
      ...overrides,
    } as never)
  })
}

describe('evv.getEvvVisits', () => {
  it('returns the six EVV elements for in-range pipeline shifts', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)

    await seedShift(t, tenantId, clientId, {
      clockInAt: '2026-08-10T09:05:00.000Z',
      clockOutAt: '2026-08-10T12:55:00.000Z',
      serviceLocationOverride: {
        label: 'Client home',
        latitude: 38.5,
        longitude: -121.4,
      },
    })
    // Out-of-range and non-visit statuses are excluded.
    await seedShift(t, tenantId, clientId, {
      scheduledStart: '2026-07-01T09:00:00.000Z',
      scheduledEnd: '2026-07-01T13:00:00.000Z',
    })
    await seedShift(t, tenantId, clientId, { status: 'scheduled' })
    await seedShift(t, tenantId, clientId, { status: 'needs_correction' })

    const result = await asAdmin(t).query(api.evv.getEvvVisits, {
      clerkOrgId: CLERK_ORG_ID,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    })

    expect(result.excludedLiveInCount).toBe(0)
    expect(result.visits).toHaveLength(1)
    const visit = result.visits[0]
    expect(visit.serviceType).toBe('SLS')
    expect(visit.recipientName).toBe('Client One')
    expect(visit.date).toBe('2026-08-10')
    expect(visit.beginAt).toBe('2026-08-10T09:05:00.000Z')
    expect(visit.endAt).toBe('2026-08-10T12:55:00.000Z')
    expect(visit.location).toBe('Client home')
    expect(visit.providerName).toBe('Caregiver One')
  })

  it('falls back to scheduled times and punch/client location', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)

    const punchShiftId = await seedShift(t, tenantId, clientId)
    await t.run(async (ctx) => {
      await ctx.db.insert('timePunches', {
        tenantId,
        shiftId: punchShiftId,
        caregiverId: CAREGIVER_ID,
        punchType: 'clock_in',
        at: '2026-08-10T09:00:00.000Z',
        source: 'atriax',
        location: {
          latitude: 38.58,
          longitude: -121.49,
          accuracyMeters: 12,
        },
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })
    })
    // No punch at all: client service address is used.
    await seedShift(t, tenantId, clientId, {
      scheduledStart: '2026-08-11T09:00:00.000Z',
      scheduledEnd: '2026-08-11T13:00:00.000Z',
    })

    const result = asCoordinator(t)
    const { visits } = await result.query(api.evv.getEvvVisits, {
      clerkOrgId: CLERK_ORG_ID,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    })

    expect(visits).toHaveLength(2)
    expect(visits[0].location).toBe('38.58,-121.49')
    // No clock times: scheduled window is the begin/end fallback.
    expect(visits[0].beginAt).toBe('2026-08-10T09:00:00.000Z')
    expect(visits[1].location).toBe('100 Main St, Sacramento, CA, 95814')
  })

  it('excludes live-in attested caregivers and counts their visits', async () => {
    const t = createTestConvex()
    const { tenantId, clientId, liveInProfileId } = await seedTenant(t)

    await seedAttestation(t, tenantId, liveInProfileId as string)
    // Exempt caregiver's visit.
    await seedShift(t, tenantId, clientId, { caregiverId: LIVE_IN_CAREGIVER_ID })
    // Regular caregiver's visit stays.
    await seedShift(t, tenantId, clientId, {
      scheduledStart: '2026-08-11T09:00:00.000Z',
      scheduledEnd: '2026-08-11T13:00:00.000Z',
    })

    const result = await asAdmin(t).query(api.evv.getEvvVisits, {
      clerkOrgId: CLERK_ORG_ID,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    })

    expect(result.excludedLiveInCount).toBe(1)
    expect(result.visits).toHaveLength(1)
    expect(result.visits[0].caregiverId).toBe(CAREGIVER_ID)
  })

  it('does not exempt caregivers whose attestation is expired', async () => {
    const t = createTestConvex()
    const { tenantId, clientId, liveInProfileId } = await seedTenant(t)

    await seedAttestation(t, tenantId, liveInProfileId as string, {
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    })
    await seedShift(t, tenantId, clientId, { caregiverId: LIVE_IN_CAREGIVER_ID })

    const result = await asAdmin(t).query(api.evv.getEvvVisits, {
      clerkOrgId: CLERK_ORG_ID,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    })

    expect(result.excludedLiveInCount).toBe(0)
    expect(result.visits).toHaveLength(1)
  })

  it('rejects caregivers', async () => {
    const t = createTestConvex()
    await seedTenant(t)
    await expect(
      asCaregiver(t).query(api.evv.getEvvVisits, {
        clerkOrgId: CLERK_ORG_ID,
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      }),
    ).rejects.toThrow()
  })
})

describe('evv.exportEvvCsv', () => {
  it('labels the export as an alternate-EVV aid and lists the six elements', async () => {
    const t = createTestConvex()
    const { tenantId, clientId, liveInProfileId } = await seedTenant(t)

    await seedAttestation(t, tenantId, liveInProfileId as string)
    await seedShift(t, tenantId, clientId, { caregiverId: LIVE_IN_CAREGIVER_ID })
    await seedShift(t, tenantId, clientId, {
      scheduledStart: '2026-08-11T09:00:00.000Z',
      scheduledEnd: '2026-08-11T13:00:00.000Z',
    })

    const csv = await asAdmin(t).query(api.evv.exportEvvCsv, {
      clerkOrgId: CLERK_ORG_ID,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    })

    expect(csv).toContain('Alternate-EVV Submission Aid')
    expect(csv).toContain('"Service Type","Recipient","Date","Begin Time","End Time","Location","Provider"')
    expect(csv).toContain('"Live-in caregiver exempt visits excluded","1"')
    expect(csv).toContain('"SLS","Client One","2026-08-11"')
    // The exempt caregiver's visit is not in the rows.
    expect(csv).not.toContain('2026-08-10T09:00:00.000Z')
  })
})

describe('evv live-in attestation recording', () => {
  it('records an attestation with audit event and lists it', async () => {
    const t = createTestConvex()
    const { tenantId, liveInProfileId } = await seedTenant(t)

    const itemId = await asAdmin(t).mutation(api.evv.recordLiveInAttestation, {
      clerkOrgId: CLERK_ORG_ID,
      employeeProfileId: liveInProfileId,
      storageId: 'storage_attestation_1',
      fileName: 'live-in-attestation.pdf',
      expiresAt: '2027-08-01T00:00:00.000Z',
    })
    expect(itemId).toBeDefined()

    const list = await asHr(t).query(api.evv.listLiveInAttestations, {
      clerkOrgId: CLERK_ORG_ID,
    })
    expect(list).toHaveLength(1)
    expect(list[0].employeeName).toBe('Live-In Caregiver')
    expect(list[0].expired).toBe(false)
    expect(list[0].expiresAt).toBe('2027-08-01T00:00:00.000Z')

    const auditEvents = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(
      auditEvents.some((e) => e.action === 'live_in_attestation_recorded'),
    ).toBe(true)
  })

  it('rejects coordinators from recording attestations', async () => {
    const t = createTestConvex()
    const { liveInProfileId } = await seedTenant(t)
    await expect(
      asCoordinator(t).mutation(api.evv.recordLiveInAttestation, {
        clerkOrgId: CLERK_ORG_ID,
        employeeProfileId: liveInProfileId,
        storageId: 'storage_x',
        fileName: 'x.pdf',
      }),
    ).rejects.toThrow()
  })

  it('lists employee options for the attestation picker', async () => {
    const t = createTestConvex()
    await seedTenant(t)
    const options = await asAdmin(t).query(api.evv.listEvvEmployeeOptions, {
      clerkOrgId: CLERK_ORG_ID,
    })
    expect(options).toHaveLength(1)
    expect(options[0].displayName).toBe('Live-In Caregiver')
  })
})
