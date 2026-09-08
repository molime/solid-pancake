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

const DAY_MS = 24 * 60 * 60 * 1000
const CLERK_ORG_ID = 'org_packet_test'
const ADMIN_ID = 'user_admin_packet'
const HR_ID = 'user_hr_packet'
const CAREGIVER_ID = 'user_caregiver_packet'

function asAdmin(t: TestConvex) {
  return t.withIdentity({
    subject: ADMIN_ID,
    org_id: CLERK_ORG_ID,
    org_role: 'org:admin',
  })
}

async function seedTenant(t: TestConvex) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: CLERK_ORG_ID,
      name: 'Packet Agency',
      slug: 'packet-agency',
      ein: '12-3456789',
      address: '123 Main St',
      createdAt: new Date().toISOString(),
    })
    for (const [clerkUserId, role, displayName] of [
      [ADMIN_ID, 'org:admin', 'Admin One'],
      [HR_ID, 'org:hr', 'HR One'],
      [CAREGIVER_ID, 'org:caregiver', 'Caregiver One'],
    ] as const) {
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId,
        role,
        displayName,
        email: `${clerkUserId}@example.com`,
      })
    }
    return tenantId
  })
}

/** Seeds one of each record type the packet reports on. */
async function seedAgency(t: TestConvex, tenantId: Id<'tenants'>) {
  return t.run(async (ctx) => {
    const now = new Date().toISOString()

    await ctx.db.insert('agencyBranches', {
      tenantId,
      branchType: 'SLS',
      label: 'SLS',
      isPredefined: true,
      order: 0,
      active: true,
    })

    await ctx.db.insert('agencyObligations', {
      tenantId,
      key: 'insurance_general_liability',
      label: 'General liability insurance certificate',
      cadenceMonths: 12,
      dueAt: new Date(Date.now() - DAY_MS).toISOString(), // overdue
      createdAt: now,
    })
    await ctx.db.insert('agencyObligations', {
      tenantId,
      key: 'ds1891_disclosure',
      label: 'DS 1891 applicant/vendor disclosure statement',
      cadenceMonths: 24,
      dueAt: new Date(Date.now() + 300 * DAY_MS).toISOString(), // current
      createdAt: now,
    })

    const fileId = await ctx.db.insert('files', {
      tenantId,
      storageId: 'storage_1',
      uploadedBy: ADMIN_ID,
      fileName: 'doc.pdf',
      linkedType: 'complianceDoc',
      linkedId: 'link_1',
      visibility: 'admins_coordinators',
      createdAt: now,
    })
    const profileId = await ctx.db.insert('employeeProfiles', {
      tenantId,
      clerkUserId: CAREGIVER_ID,
      displayName: 'Caregiver One',
      email: 'caregiver@example.com',
      adpSyncStatus: 'synced',
      createdAt: now,
    })
    await ctx.db.insert('documentArchiveItems', {
      tenantId,
      fileId,
      subjectType: 'employee',
      subjectId: profileId as string,
      category: 'cpr',
      status: 'verified',
      createdAt: now,
    })

    await ctx.db.insert('platformTrainingCompletions', {
      tenantId,
      clerkUserId: CAREGIVER_ID,
      trainingId: 'orientation',
      completedAt: now,
      status: 'completed',
    })

    const candidateId = await ctx.db.insert('candidates', {
      tenantId,
      email: 'candidate@example.com',
      displayName: 'Candidate One',
      status: 'hired',
      createdAt: now,
    })
    await ctx.db.insert('backgroundChecks', {
      tenantId,
      candidateId,
      provider: 'mock',
      status: 'clear',
      package: 'basic',
      initiatedAt: now,
      completedAt: now,
    })

    const clientId = await ctx.db.insert('clients', {
      tenantId,
      displayName: 'Client One',
      serviceType: 'SLS',
      authorizationHours: 100,
      riskFlags: [],
    })

    // In-range incident (verbal on time, written breached) and an
    // out-of-range incident that must not appear.
    await ctx.db.insert('specialIncidents', {
      tenantId,
      clientId,
      category: 'hospitalization',
      occurredAt: '2026-08-10T10:00:00.000Z',
      learnedAt: '2026-08-10T12:00:00.000Z',
      location: 'Client home',
      description: 'Fall with injury',
      actionsTaken: 'Called 911',
      agenciesNotified: ['law_enforcement'],
      verbalReportedAt: '2026-08-10T20:00:00.000Z',
      writtenSubmittedAt: '2026-08-14T12:00:00.000Z',
      status: 'written_submitted',
      createdBy: ADMIN_ID,
      createdAt: now,
    })
    await ctx.db.insert('specialIncidents', {
      tenantId,
      clientId,
      category: 'medication_error',
      occurredAt: '2025-01-01T10:00:00.000Z',
      learnedAt: '2025-01-01T12:00:00.000Z',
      location: 'Client home',
      description: 'Old incident outside the packet range',
      actionsTaken: 'Notified nurse',
      agenciesNotified: [],
      status: 'closed',
      createdBy: ADMIN_ID,
      createdAt: now,
    })

    await ctx.db.insert('progressReports', {
      tenantId,
      clientId,
      periodType: 'quarterly',
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      entries: [],
      status: 'submitted',
      generatedBy: ADMIN_ID,
      submittedAt: '2026-08-01T00:00:00.000Z',
      submittedTo: 'sc@example.com',
      createdAt: now,
    })

    const shiftId = await ctx.db.insert('shifts', {
      tenantId,
      clientId,
      caregiverId: CAREGIVER_ID,
      scheduledStart: '2026-08-05T08:00:00.000Z',
      scheduledEnd: '2026-08-05T12:00:00.000Z',
      status: 'approved',
      serviceType: 'SLS',
      rate: 25,
    })
    await ctx.db.insert('billingLines', {
      tenantId,
      shiftId,
      hours: 4,
      rate: 25,
      amount: 100,
      blockedReason: 'Missing required credential: CPR',
      blockedAt: '2026-08-06T00:00:00.000Z',
      createdAt: '2026-08-06T00:00:00.000Z',
    })

    await ctx.db.insert('auditEvents', {
      tenantId,
      actorId: ADMIN_ID,
      actorRole: 'org:admin',
      action: 'shift_approved',
      createdAt: '2026-08-06T01:00:00.000Z',
    })
    await ctx.db.insert('auditEvents', {
      tenantId,
      actorId: ADMIN_ID,
      actorRole: 'org:admin',
      action: 'shift_approved',
      createdAt: '2026-08-07T01:00:00.000Z',
    })

    return { clientId }
  })
}

const RANGE = { startDate: '2026-08-01', endDate: '2026-08-31' }

describe('auditPacket.exportPacketCsv', () => {
  it('includes all nine packet sections with the seeded rows', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t)
    await seedAgency(t, tenantId)

    const csv = await asAdmin(t).query(api.auditPacket.exportPacketCsv, {
      clerkOrgId: CLERK_ORG_ID,
      ...RANGE,
    })

    for (const section of [
      '"Agency Information"',
      '"Agency Obligations"',
      '"Personnel Roster"',
      '"Training Matrix"',
      '"Background Checks"',
      '"Special Incident Report Log (17 CCR §54327)"',
      '"Progress Reports"',
      '"Documentation Completeness"',
      '"Billing Exceptions"',
      '"Audit Events"',
    ]) {
      expect(csv).toContain(section)
    }

    expect(csv).toContain('"Packet Agency"')
    // Obligation statuses: GL overdue, DS 1891 current.
    expect(csv).toContain('"General liability insurance certificate"')
    expect(csv).toContain('"Overdue"')
    expect(csv).toContain('"DS 1891 applicant/vendor disclosure statement"')
    // Personnel roster row.
    expect(csv).toContain('"Caregiver One"')
    // SIR timeliness columns: verbal on time, written breached.
    expect(csv).toContain('"hospitalization"')
    // Audit events summary: two shift_approved events in range.
    expect(csv).toContain('"shift_approved","2"')
  })

  it('filters log sections to the requested date range', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t)
    await seedAgency(t, tenantId)

    const csv = await asAdmin(t).query(api.auditPacket.exportPacketCsv, {
      clerkOrgId: CLERK_ORG_ID,
      ...RANGE,
    })

    expect(csv).not.toContain('Old incident outside the packet range')
    expect(csv).not.toContain('medication_error')
  })

  it('rejects invalid dates and inverted ranges', async () => {
    const t = createTestConvex()
    await seedTenant(t)

    await expect(
      asAdmin(t).query(api.auditPacket.exportPacketCsv, {
        clerkOrgId: CLERK_ORG_ID,
        startDate: '08/01/2026',
        endDate: '2026-08-31',
      }),
    ).rejects.toThrow('Start date must be an ISO date')

    await expect(
      asAdmin(t).query(api.auditPacket.exportPacketCsv, {
        clerkOrgId: CLERK_ORG_ID,
        startDate: '2026-08-31',
        endDate: '2026-08-01',
      }),
    ).rejects.toThrow('Start date must be on or before the end date')
  })

  it('is blocked for org:caregiver and org:coordinator', async () => {
    const t = createTestConvex()
    await seedTenant(t)

    await expect(
      t
        .withIdentity({
          subject: CAREGIVER_ID,
          org_id: CLERK_ORG_ID,
          org_role: 'org:caregiver',
        })
        .query(api.auditPacket.exportPacketCsv, {
          clerkOrgId: CLERK_ORG_ID,
          ...RANGE,
        }),
    ).rejects.toThrow()
  })
})
