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

const ADMIN_ID = 'user_admin_evidence'
const CAREGIVER_ID = 'user_caregiver_evidence'

function asAdmin(t: TestConvex, clerkOrgId: string) {
  return t.withIdentity({
    subject: ADMIN_ID,
    org_id: clerkOrgId,
    org_role: 'org:admin',
  })
}

async function seedTenant(t: TestConvex, clerkOrgId: string) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId,
      name: 'Evidence Agency',
      slug: 'evidence-agency',
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: ADMIN_ID,
      role: 'org:admin',
      displayName: 'Admin One',
      email: 'admin@example.com',
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: CAREGIVER_ID,
      role: 'org:caregiver',
      displayName: 'Caregiver One',
      email: 'caregiver@example.com',
    })
    return tenantId
  })
}

/** Seeds a full evidence chain: client → shift → punches → note → review → line. */
async function seedChain(
  t: TestConvex,
  tenantId: Id<'tenants'>,
  options: {
    withClockOut?: boolean
    withNote?: boolean
    withReview?: boolean
    invoiced?: boolean
    lineCreatedAt?: string
    clientName?: string
  } = {},
) {
  const {
    withClockOut = true,
    withNote = true,
    withReview = true,
    invoiced = true,
    lineCreatedAt,
    clientName = 'Client One',
  } = options

  return t.run(async (ctx) => {
    const now = new Date().toISOString()
    const clientId = await ctx.db.insert('clients', {
      tenantId,
      displayName: clientName,
      serviceType: 'SLS',
      authorizationHours: 40,
      riskFlags: [],
    })
    const shiftId = await ctx.db.insert('shifts', {
      tenantId,
      clientId,
      caregiverId: CAREGIVER_ID,
      scheduledStart: '2026-08-10T09:00:00.000Z',
      scheduledEnd: '2026-08-10T13:00:00.000Z',
      clockInAt: '2026-08-10T09:02:00.000Z',
      clockOutAt: withClockOut ? '2026-08-10T13:01:00.000Z' : undefined,
      status: 'billing_ready',
      serviceType: 'SLS',
      rate: 25,
    })
    await ctx.db.insert('timePunches', {
      tenantId,
      shiftId,
      caregiverId: CAREGIVER_ID,
      punchType: 'clock_in',
      at: '2026-08-10T09:02:00.000Z',
      source: 'atriax',
      location: {
        latitude: 37.1,
        longitude: -122.1,
        accuracyMeters: 12,
        withinGeofence: true,
        targetLabel: 'Client home',
      },
      adpSyncStatus: 'queued',
      createdAt: now,
    })
    if (withClockOut) {
      await ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId: CAREGIVER_ID,
        punchType: 'clock_out',
        at: '2026-08-10T13:01:00.000Z',
        source: 'atriax',
        location: {
          latitude: 37.1,
          longitude: -122.1,
          accuracyMeters: 15,
          withinGeofence: false,
        },
        adpSyncStatus: 'queued',
        createdAt: now,
      })
    }
    if (withNote) {
      await ctx.db.insert('progressNotes', {
        tenantId,
        shiftId,
        startTime: '2026-08-10T09:00:00.000Z',
        endTime: '2026-08-10T13:00:00.000Z',
        servicesProvided: 'Meal preparation, community outing',
        clientResponse: 'Engaged well',
        narrative: 'Worked on cooking objective; client prepared lunch.',
        submittedBy: CAREGIVER_ID,
        submittedAt: now,
      })
    }
    if (withReview) {
      await ctx.db.insert('reviewEvents', {
        tenantId,
        shiftId,
        reviewerId: ADMIN_ID,
        decision: 'approved',
        comment: 'Looks good',
        createdAt: now,
      })
    }

    let exportBatchId: Id<'exportBatches'> | undefined
    if (invoiced) {
      exportBatchId = await ctx.db.insert('exportBatches', {
        tenantId,
        name: 'August invoice',
        exportedAt: now,
        exportedBy: ADMIN_ID,
        invoiceNumber: 'INV-evidence-agency-one-202608',
        status: 'sent',
      })
    }

    const billingLineId = await ctx.db.insert('billingLines', {
      tenantId,
      shiftId,
      hours: 4,
      rate: 25,
      amount: 100,
      exportBatchId,
      createdAt: lineCreatedAt ?? now,
    })

    return { clientId, shiftId, billingLineId, exportBatchId }
  })
}

describe('getShiftEvidence', () => {
  it('returns the full evidence chain for a billing line', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_evidence_full'
    const tenantId = await seedTenant(t, clerkOrgId)
    const { billingLineId } = await seedChain(t, tenantId)

    const evidence = await asAdmin(t, clerkOrgId).query(
      api.evidence.getShiftEvidence,
      { clerkOrgId, billingLineId },
    )

    expect(evidence.evidenceComplete).toBe(true)
    expect(evidence.line.amount).toBe(100)
    expect(evidence.shift?.status).toBe('billing_ready')
    expect(evidence.client?.displayName).toBe('Client One')
    expect(evidence.caregiverName).toBe('Caregiver One')
    expect(evidence.punches).toHaveLength(2)
    expect(evidence.punches[0]?.withinGeofence).toBe(true)
    expect(evidence.punches[1]?.withinGeofence).toBe(false)
    expect(evidence.notes).toHaveLength(1)
    expect(evidence.notes[0]?.narrative).toContain('cooking')
    expect(evidence.reviews).toHaveLength(1)
    expect(evidence.reviews[0]?.reviewerName).toBe('Admin One')
    expect(evidence.invoice?.invoiceNumber).toBe(
      'INV-evidence-agency-one-202608',
    )
  })

  it('marks the chain incomplete when a link is missing', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_evidence_incomplete'
    const tenantId = await seedTenant(t, clerkOrgId)
    const { billingLineId } = await seedChain(t, tenantId, {
      withClockOut: false,
      invoiced: false,
    })

    const evidence = await asAdmin(t, clerkOrgId).query(
      api.evidence.getShiftEvidence,
      { clerkOrgId, billingLineId },
    )

    expect(evidence.evidenceComplete).toBe(false)
    expect(evidence.invoice).toBeNull()
    expect(evidence.punches).toHaveLength(1)
  })

  it('is blocked for org:caregiver', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_evidence_block'
    const tenantId = await seedTenant(t, clerkOrgId)
    const { billingLineId } = await seedChain(t, tenantId)

    await expect(
      t
        .withIdentity({
          subject: CAREGIVER_ID,
          org_id: clerkOrgId,
          org_role: 'org:caregiver',
        })
        .query(api.evidence.getShiftEvidence, { clerkOrgId, billingLineId }),
    ).rejects.toThrow()
  })

  it('rejects billing lines from another tenant', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_evidence_tenant_a'
    const otherOrgId = 'org_evidence_tenant_b'
    const tenantId = await seedTenant(t, clerkOrgId)
    const { billingLineId } = await seedChain(t, tenantId)

    // Same admin is also an admin of a second tenant.
    await t.run(async (ctx) => {
      const otherTenantId = await ctx.db.insert('tenants', {
        clerkOrgId: otherOrgId,
        name: 'Other Agency',
        slug: 'other-agency',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('tenantMembers', {
        tenantId: otherTenantId,
        clerkUserId: ADMIN_ID,
        role: 'org:admin',
        displayName: 'Admin One',
        email: 'admin@example.com',
      })
    })

    await expect(
      asAdmin(t, otherOrgId).query(api.evidence.getShiftEvidence, {
        clerkOrgId: otherOrgId,
        billingLineId,
      }),
    ).rejects.toThrow()
  })
})

describe('exportEvidenceCsv', () => {
  it('exports one row per billing line with chain columns', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_evidence_csv'
    const tenantId = await seedTenant(t, clerkOrgId)
    await seedChain(t, tenantId)

    const csv = await asAdmin(t, clerkOrgId).query(
      api.evidence.exportEvidenceCsv,
      { clerkOrgId },
    )

    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('"ATRIA-X Billing Evidence Lineage"')
    const header = lines.find((line) => line.includes('"Clock In GPS"'))
    expect(header).toBeDefined()
    const dataRow = lines.find((line) => line.includes('"Client One"'))
    expect(dataRow).toBeDefined()
    expect(dataRow).toContain('"Caregiver One"')
    expect(dataRow).toContain('"within geofence"')
    expect(dataRow).toContain('"outside geofence"')
    expect(dataRow).toContain('"approved"')
    expect(dataRow).toContain('"INV-evidence-agency-one-202608"')
  })

  it('escapes formula characters and quotes', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_evidence_escape'
    const tenantId = await seedTenant(t, clerkOrgId)
    await seedChain(t, tenantId, { clientName: '=SUM(A1:A2) "x"' })

    const csv = await asAdmin(t, clerkOrgId).query(
      api.evidence.exportEvidenceCsv,
      { clerkOrgId },
    )

    expect(csv).toContain('"\'=SUM(A1:A2) ""x"""')
  })

  it('filters by date range on the billing line creation date', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_evidence_range'
    const tenantId = await seedTenant(t, clerkOrgId)
    await seedChain(t, tenantId, { lineCreatedAt: '2026-08-01T12:00:00.000Z' })
    await seedChain(t, tenantId, {
      lineCreatedAt: '2026-07-01T12:00:00.000Z',
      clientName: 'Client Two',
    })

    const csv = await asAdmin(t, clerkOrgId).query(
      api.evidence.exportEvidenceCsv,
      { clerkOrgId, startDate: '2026-08-01', endDate: '2026-08-31' },
    )

    expect(csv).toContain('"Client One"')
    expect(csv).not.toContain('"Client Two"')
  })
})
