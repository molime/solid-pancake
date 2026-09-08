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

const CLERK_ORG_ID = 'org_audit_test'
const OTHER_ORG_ID = 'org_audit_other'
const ADMIN_ID = 'user_admin_audit'
const HR_ID = 'user_hr_audit'
const COORDINATOR_ID = 'user_coordinator_audit'
const CAREGIVER_ID = 'user_caregiver_audit'

async function seedTenant(
  t: TestConvex,
  clerkOrgId: string,
  name: string,
) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId,
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      ein: '12-3456789',
      address: '123 Main St',
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

    return tenantId
  })
}

async function seedFullAgency(t: TestConvex, tenantId: Id<'tenants'>) {
  return t.run(async (ctx) => {
    const fileId = await ctx.db.insert('files', {
      tenantId,
      storageId: 'storage_1',
      uploadedBy: ADMIN_ID,
      fileName: 'doc.pdf',
      linkedType: 'complianceDoc',
      linkedId: 'link_1',
      visibility: 'admins_coordinators',
      createdAt: new Date().toISOString(),
    })

    const profileId = await ctx.db.insert('employeeProfiles', {
      tenantId,
      clerkUserId: CAREGIVER_ID,
      displayName: 'Caregiver One',
      email: 'caregiver@example.com',
      adpSyncStatus: 'synced',
      createdAt: new Date().toISOString(),
    })

    // One compliant credential, one expired credential, and one required
    // credential missing entirely (drives the compliance gap).
    await ctx.db.insert('documentArchiveItems', {
      tenantId,
      fileId,
      subjectType: 'employee',
      subjectId: profileId as string,
      category: 'cpr',
      status: 'verified',
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('documentArchiveItems', {
      tenantId,
      fileId,
      subjectType: 'employee',
      subjectId: profileId as string,
      category: 'health_screen',
      status: 'verified',
      expiresAt: new Date(Date.now() - DAY_MS).toISOString(),
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('credentialRequirements', {
      tenantId,
      role: 'org:caregiver',
      category: 'license',
      label: 'Driver License',
      isRequired: true,
    })

    const candidateId = await ctx.db.insert('candidates', {
      tenantId,
      email: 'candidate@example.com',
      displayName: 'Candidate One',
      status: 'hired',
      createdAt: new Date().toISOString(),
    })
    for (const status of ['clear', 'pending', 'consider', 'scan_failed']) {
      await ctx.db.insert('backgroundChecks', {
        tenantId,
        candidateId,
        provider: 'mock',
        status,
        package: 'basic',
        initiatedAt: new Date().toISOString(),
      })
    }

    await ctx.db.insert('platformTrainingCompletions', {
      tenantId,
      clerkUserId: CAREGIVER_ID,
      trainingId: 'orientation',
      completedAt: new Date().toISOString(),
      status: 'completed',
    })
    // Expires exactly at the 30-day window boundary -> counts as expiring.
    await ctx.db.insert('platformTrainingCompletions', {
      tenantId,
      clerkUserId: CAREGIVER_ID,
      trainingId: 'cpr_refresh',
      completedAt: new Date().toISOString(),
      status: 'completed',
      expiresAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
    })
    await ctx.db.insert('platformTrainingCompletions', {
      tenantId,
      clerkUserId: CAREGIVER_ID,
      trainingId: 'abuse_prevention',
      completedAt: new Date().toISOString(),
      status: 'in_progress',
    })

    const clientId = await ctx.db.insert('clients', {
      tenantId,
      displayName: 'Client One',
      serviceType: 'SLS',
      authorizationHours: 100,
      riskFlags: [],
    })
    const makeShift = () =>
      ctx.db.insert('shifts', {
        tenantId,
        clientId,
        caregiverId: CAREGIVER_ID,
        scheduledStart: '2026-01-01T08:00:00.000Z',
        scheduledEnd: '2026-01-01T16:00:00.000Z',
        status: 'submitted',
        serviceType: 'SLS',
        rate: 25,
      })
    const shiftWithNote = await makeShift()
    const shiftWithBlankNote = await makeShift()
    const shiftWithoutNote = await makeShift()

    await ctx.db.insert('progressNotes', {
      tenantId,
      shiftId: shiftWithNote,
      startTime: '08:00',
      endTime: '12:00',
      servicesProvided: 'Personal care',
      clientResponse: 'Cooperative',
      narrative: 'Shift completed as planned.',
    })
    await ctx.db.insert('progressNotes', {
      tenantId,
      shiftId: shiftWithBlankNote,
      startTime: '08:00',
      endTime: '12:00',
      servicesProvided: 'Personal care',
      clientResponse: 'Cooperative',
      narrative: '   ',
    })

    await ctx.db.insert('billingLines', {
      tenantId,
      shiftId: shiftWithNote,
      hours: 4,
      rate: 25,
      amount: 100,
      blockedReason: 'Missing required credential: Driver License',
      blockedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('billingLines', {
      tenantId,
      shiftId: shiftWithoutNote,
      hours: 4,
      rate: 25,
      amount: 100,
      createdAt: new Date().toISOString(),
    })

    await ctx.db.insert('auditEvents', {
      tenantId,
      actorId: ADMIN_ID,
      actorRole: 'org:admin',
      action: 'shift_approved',
      createdAt: new Date(Date.now() - 29 * DAY_MS).toISOString(),
    })
    await ctx.db.insert('auditEvents', {
      tenantId,
      actorId: ADMIN_ID,
      actorRole: 'org:admin',
      action: 'shift_approved',
      createdAt: new Date(Date.now() - 31 * DAY_MS).toISOString(),
    })

    await ctx.db.insert('agencyBranches', {
      tenantId,
      branchType: 'ILS',
      label: 'ILS',
      isPredefined: true,
      order: 0,
      active: true,
    })
    await ctx.db.insert('agencyBranches', {
      tenantId,
      branchType: 'custom',
      label: 'Retired Branch',
      isPredefined: false,
      order: 1,
      active: false,
    })

    return { profileId, shiftWithNote }
  })
}

function asAdmin(t: TestConvex, clerkOrgId = CLERK_ORG_ID) {
  return t.withIdentity({
    subject: ADMIN_ID,
    org_id: clerkOrgId,
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

describe('auditReadiness.getReport', () => {
  it('rejects unauthenticated callers', async () => {
    const t = createTestConvex()
    await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')

    await expect(
      t.query(api.auditReadiness.getReport, { clerkOrgId: CLERK_ORG_ID }),
    ).rejects.toThrow('authentication required')
  })

  it('rejects coordinator and caregiver roles', async () => {
    const t = createTestConvex()
    await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')

    await expect(
      asCoordinator(t).query(api.auditReadiness.getReport, {
        clerkOrgId: CLERK_ORG_ID,
      }),
    ).rejects.toThrow('Forbidden')
    await expect(
      asCaregiver(t).query(api.auditReadiness.getReport, {
        clerkOrgId: CLERK_ORG_ID,
      }),
    ).rejects.toThrow('Forbidden')
  })

  it('allows org:admin and org:hr', async () => {
    const t = createTestConvex()
    await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')

    const asAdminReport = await asAdmin(t).query(
      api.auditReadiness.getReport,
      { clerkOrgId: CLERK_ORG_ID },
    )
    const asHrReport = await asHr(t).query(api.auditReadiness.getReport, {
      clerkOrgId: CLERK_ORG_ID,
    })

    expect(asAdminReport.agency.name).toBe('Audit Agency')
    expect(asHrReport.agency.name).toBe('Audit Agency')
  })

  it('returns zeros for an empty tenant without throwing', async () => {
    const t = createTestConvex()
    await seedTenant(t, CLERK_ORG_ID, 'Empty Agency')

    const report = await asAdmin(t).query(api.auditReadiness.getReport, {
      clerkOrgId: CLERK_ORG_ID,
    })

    expect(report.agency).toEqual({
      name: 'Empty Agency',
      ein: '12-3456789',
      address: '123 Main St',
    })
    expect(report.branches).toEqual([])
    expect(report.personnel).toEqual({
      compliant: 0,
      expiring: 0,
      expired: 0,
      blocked: 0,
      total: 0,
    })
    expect(report.gaps).toEqual([])
    expect(report.backgroundChecks).toEqual({
      clear: 0,
      pending: 0,
      consider: 0,
      other: 0,
      total: 0,
    })
    expect(report.training).toEqual({
      completed: 0,
      pending: 0,
      expiring: 0,
      total: 0,
    })
    expect(report.documentation).toEqual({
      total: 0,
      withNotes: 0,
      withoutNotes: 0,
    })
    expect(report.blockedBillingLines).toBe(0)
    expect(report.auditEvents).toEqual({ total: 0, last30Days: 0 })
  })

  it('aggregates all nine sections correctly', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')
    await seedFullAgency(t, tenantId)

    const report = await asAdmin(t).query(api.auditReadiness.getReport, {
      clerkOrgId: CLERK_ORG_ID,
    })

    expect(report.agency).toEqual({
      name: 'Audit Agency',
      ein: '12-3456789',
      address: '123 Main St',
    })
    // Inactive branches are excluded.
    expect(report.branches).toEqual(['ILS'])
    expect(report.personnel).toEqual({
      compliant: 1,
      expiring: 0,
      expired: 1,
      blocked: 1,
      total: 2,
    })
    expect(report.gaps).toHaveLength(1)
    expect(report.gaps[0]?.displayName).toBe('Caregiver One')
    expect(report.gaps[0]?.missing).toEqual(['Driver License'])
    expect(report.gaps[0]?.expired).toEqual(['health_screen'])
    // Unknown statuses fall into the other bucket.
    expect(report.backgroundChecks).toEqual({
      clear: 1,
      pending: 1,
      consider: 1,
      other: 1,
      total: 4,
    })
    expect(report.training).toEqual({
      completed: 2,
      pending: 1,
      expiring: 1,
      total: 3,
    })
    expect(report.documentation).toEqual({
      total: 3,
      withNotes: 1,
      withoutNotes: 2,
    })
    expect(report.blockedBillingLines).toBe(1)
    expect(report.auditEvents).toEqual({ total: 2, last30Days: 1 })
  })

  it('isolates tenants — org A sees none of org B data', async () => {
    const t = createTestConvex()
    const tenantA = await seedTenant(t, CLERK_ORG_ID, 'Agency A')
    const tenantB = await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId: OTHER_ORG_ID,
        name: 'Agency B',
        slug: 'agency-b',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: 'user_b',
        displayName: 'Org B Employee',
        email: 'b@example.com',
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })
      const candidateId = await ctx.db.insert('candidates', {
        tenantId,
        email: 'candidate-b@example.com',
        displayName: 'Candidate B',
        status: 'hired',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('backgroundChecks', {
        tenantId,
        candidateId,
        provider: 'mock',
        status: 'clear',
        package: 'basic',
        initiatedAt: new Date().toISOString(),
      })
      await ctx.db.insert('auditEvents', {
        tenantId,
        actorId: 'user_b',
        actorRole: 'org:admin',
        action: 'org_b_action',
        createdAt: new Date().toISOString(),
      })
      return tenantId
    })
    void tenantA
    void tenantB

    const report = await asAdmin(t).query(api.auditReadiness.getReport, {
      clerkOrgId: CLERK_ORG_ID,
    })

    expect(report.gaps).toEqual([])
    expect(report.backgroundChecks.total).toBe(0)
    expect(report.auditEvents.total).toBe(0)
  })
})

describe('auditReadiness.exportCsv', () => {
  it('applies the same role guard as getReport', async () => {
    const t = createTestConvex()
    await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')

    await expect(
      t.query(api.auditReadiness.exportCsv, { clerkOrgId: CLERK_ORG_ID }),
    ).rejects.toThrow('authentication required')
    await expect(
      asCoordinator(t).query(api.auditReadiness.exportCsv, {
        clerkOrgId: CLERK_ORG_ID,
      }),
    ).rejects.toThrow('Forbidden')

    const csv = await asHr(t).query(api.auditReadiness.exportCsv, {
      clerkOrgId: CLERK_ORG_ID,
    })
    expect(csv).toContain('ATRIA-X Audit Readiness Report')
  })

  it('contains all section headers and a generated date', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')
    await seedFullAgency(t, tenantId)

    const csv = await asAdmin(t).query(api.auditReadiness.exportCsv, {
      clerkOrgId: CLERK_ORG_ID,
    })

    expect(csv).toContain('"Generated"')
    expect(csv).toContain('"Agency Information"')
    expect(csv).toContain('"Personnel Roster"')
    expect(csv).toContain('"Background Checks"')
    expect(csv).toContain('"Training"')
    expect(csv).toContain('"Documentation"')
    expect(csv).toContain('"Compliance Gaps"')
    expect(csv).toContain('"Audit Events"')
    expect(csv).toContain('"Caregiver One"')
    expect(csv).toContain('"Driver License"')
  })

  it('escapes commas and quotes in cell values', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')
    await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: 'user_tricky',
        displayName: 'Doe, John "JD"',
        email: 'tricky@example.com',
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })
    })

    const csv = await asAdmin(t).query(api.auditReadiness.exportCsv, {
      clerkOrgId: CLERK_ORG_ID,
    })

    expect(csv).toContain('"Doe, John ""JD"""')
  })

  it('prefixes formula-injection characters with an apostrophe', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')
    await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: 'user_formula',
        displayName: '=SUM(A1:A2)',
        email: 'formula@example.com',
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })
    })

    const csv = await asAdmin(t).query(api.auditReadiness.exportCsv, {
      clerkOrgId: CLERK_ORG_ID,
    })

    expect(csv).toContain('"' + "'=SUM(A1:A2)" + '"')
    expect(csv).not.toContain('"=SUM(A1:A2)"')
  })
})


describe('auditReadiness.getAnnualEvaluation', () => {
  async function seedEvaluationData(t: TestConvex, tenantId: Id<'tenants'>) {
    return t.run(async (ctx) => {
      const clientA = await ctx.db.insert('clients', {
        tenantId,
        displayName: 'Client A',
        serviceType: 'SLS',
        authorizationHours: 40,
        riskFlags: [],
      })
      const clientB = await ctx.db.insert('clients', {
        tenantId,
        displayName: 'Client B',
        serviceType: 'ILS',
        authorizationHours: 20,
        riskFlags: [],
      })

      // FY ending 2026 = 2025-07-01 → 2026-06-30.
      const makeShift = (
        clientId: Id<'clients'>,
        start: string,
        end: string,
        status: 'submitted' | 'approved' | 'billing_ready',
      ) =>
        ctx.db.insert('shifts', {
          tenantId,
          clientId,
          caregiverId: CAREGIVER_ID,
          scheduledStart: start,
          scheduledEnd: end,
          status,
          serviceType: 'SLS',
          rate: 25,
        })

      // In FY: approved 4h shift with a narrative note.
      const shiftA = await makeShift(
        clientA,
        '2026-01-10T09:00:00.000Z',
        '2026-01-10T13:00:00.000Z',
        'approved',
      )
      await ctx.db.insert('progressNotes', {
        tenantId,
        shiftId: shiftA,
        startTime: '',
        endTime: '',
        servicesProvided: 'Personal care',
        clientResponse: '',
        narrative: 'Documented shift.',
      })
      // In FY: billing_ready 2h shift without a note.
      await makeShift(
        clientB,
        '2025-12-01T09:00:00.000Z',
        '2025-12-01T11:00:00.000Z',
        'billing_ready',
      )
      // Outside FY (after June 30) — excluded.
      await makeShift(
        clientA,
        '2026-08-01T09:00:00.000Z',
        '2026-08-01T17:00:00.000Z',
        'approved',
      )
      // In FY but not approved — excluded.
      await makeShift(
        clientA,
        '2026-02-01T09:00:00.000Z',
        '2026-02-01T17:00:00.000Z',
        'submitted',
      )

      for (const status of [
        'active',
        'active',
        'achieved',
        'discontinued',
      ] as const) {
        await ctx.db.insert('clientObjectives', {
          tenantId,
          clientId: clientA,
          title: `Objective ${status}`,
          source: 'ipp',
          status,
          createdAt: new Date().toISOString(),
        })
      }

      const makeIncident = (
        category: 'medication_error' | 'death' | 'hospitalization',
        occurredAt: string,
      ) =>
        ctx.db.insert('specialIncidents', {
          tenantId,
          clientId: clientA,
          category,
          occurredAt,
          learnedAt: occurredAt,
          location: 'Client home',
          description: 'Incident',
          actionsTaken: 'Actions',
          agenciesNotified: [],
          status: 'closed',
          createdBy: ADMIN_ID,
          createdAt: occurredAt,
        })
      // In FY (incl. first-day boundary).
      await makeIncident('medication_error', '2026-02-01T10:00:00.000Z')
      await makeIncident('death', '2025-07-01T10:00:00.000Z')
      // Out of FY.
      await makeIncident('hospitalization', '2026-08-01T10:00:00.000Z')
    })
  }

  it('aggregates the fiscal year for a seeded dataset', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')
    await seedEvaluationData(t, tenantId)

    const evaluation = await asAdmin(t).query(
      api.auditReadiness.getAnnualEvaluation,
      { clerkOrgId: CLERK_ORG_ID, fiscalYearEnd: 2026 },
    )

    expect(evaluation).toMatchObject({
      fiscalYearEnd: 2026,
      periodStart: '2025-07-01',
      periodEnd: '2026-06-30',
      clientsServed: 2,
      hoursDelivered: 6,
      objectives: { active: 2, achieved: 1, discontinued: 1, total: 4 },
      documentation: { total: 2, withNotes: 1, withoutNotes: 1 },
    })
    expect(evaluation.incidents.total).toBe(2)
    expect(evaluation.incidents.byCategory).toEqual({
      death: 1,
      medication_error: 1,
    })
  })

  it('returns zero service metrics for a fiscal year with no activity', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')
    await seedEvaluationData(t, tenantId)

    const evaluation = await asAdmin(t).query(
      api.auditReadiness.getAnnualEvaluation,
      { clerkOrgId: CLERK_ORG_ID, fiscalYearEnd: 2024 },
    )

    expect(evaluation.clientsServed).toBe(0)
    expect(evaluation.hoursDelivered).toBe(0)
    expect(evaluation.incidents.total).toBe(0)
    expect(evaluation.documentation.total).toBe(0)
    // Objectives are a current-status snapshot regardless of fiscal year.
    expect(evaluation.objectives.total).toBe(4)
  })

  it('rejects coordinator and caregiver roles', async () => {
    const t = createTestConvex()
    await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')

    await expect(
      asCoordinator(t).query(api.auditReadiness.getAnnualEvaluation, {
        clerkOrgId: CLERK_ORG_ID,
      }),
    ).rejects.toThrow('Forbidden')
    await expect(
      asCaregiver(t).query(api.auditReadiness.getAnnualEvaluation, {
        clerkOrgId: CLERK_ORG_ID,
      }),
    ).rejects.toThrow('Forbidden')
  })

  it('exports the evaluation as CSV with the shared conventions', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')
    await seedEvaluationData(t, tenantId)

    const csv = await asHr(t).query(
      api.auditReadiness.exportAnnualEvaluationCsv,
      { clerkOrgId: CLERK_ORG_ID, fiscalYearEnd: 2026 },
    )

    expect(csv).toContain('"ATRIA-X Annual Program Evaluation')
    expect(csv).toContain('"FY 2025-26"')
    expect(csv).toContain('"2025-07-01 to 2026-06-30"')
    expect(csv).toContain('"Clients Served","2"')
    expect(csv).toContain('"Hours Delivered","6"')
    expect(csv).toContain('"Active","2"')
    expect(csv).toContain('"Achieved","1"')
    expect(csv).toContain('"death","1"')
    expect(csv).toContain('"medication_error","1"')
    expect(csv).toContain('"Shifts With Notes","1"')
  })
})

describe('auditReadiness.getReport — evidence lineage counts', () => {
  it('counts billing lines with a complete evidence chain', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')
    const { shiftWithNote } = await seedFullAgency(t, tenantId)

    // Neither seeded billing line has punches or review events yet.
    const before = await asAdmin(t).query(api.auditReadiness.getReport, {
      clerkOrgId: CLERK_ORG_ID,
    })
    expect(before.evidence).toEqual({ complete: 0, total: 2 })

    // Complete the chain for the line tied to shiftWithNote: clock-in and
    // clock-out GPS punches plus a review event (the note already exists).
    await t.run(async (ctx) => {
      const now = new Date().toISOString()
      await ctx.db.insert('timePunches', {
        tenantId,
        shiftId: shiftWithNote,
        caregiverId: CAREGIVER_ID,
        punchType: 'clock_in',
        at: '2026-01-01T08:00:00.000Z',
        source: 'atriax',
        adpSyncStatus: 'queued',
        createdAt: now,
      })
      await ctx.db.insert('timePunches', {
        tenantId,
        shiftId: shiftWithNote,
        caregiverId: CAREGIVER_ID,
        punchType: 'clock_out',
        at: '2026-01-01T16:00:00.000Z',
        source: 'atriax',
        adpSyncStatus: 'queued',
        createdAt: now,
      })
      await ctx.db.insert('reviewEvents', {
        tenantId,
        shiftId: shiftWithNote,
        reviewerId: COORDINATOR_ID,
        decision: 'approved',
        comment: 'ok',
        createdAt: now,
      })
    })

    const after = await asAdmin(t).query(api.auditReadiness.getReport, {
      clerkOrgId: CLERK_ORG_ID,
    })
    expect(after.evidence).toEqual({ complete: 1, total: 2 })

    const csv = await asAdmin(t).query(api.auditReadiness.exportCsv, {
      clerkOrgId: CLERK_ORG_ID,
    })
    expect(csv).toContain('"Evidence-Complete Billing Lines","1 of 2"')
  })
})


describe('auditReadiness.getFixList', () => {
  it('rejects coordinator and caregiver roles', async () => {
    const t = createTestConvex()
    await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')

    await expect(
      asCoordinator(t).query(api.auditReadiness.getFixList, {
        clerkOrgId: CLERK_ORG_ID,
      }),
    ).rejects.toThrow('Forbidden')
    await expect(
      asCaregiver(t).query(api.auditReadiness.getFixList, {
        clerkOrgId: CLERK_ORG_ID,
      }),
    ).rejects.toThrow('Forbidden')
  })

  it('returns ready with an empty list when nothing needs fixing', async () => {
    const t = createTestConvex()
    await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')

    const result = await asAdmin(t).query(api.auditReadiness.getFixList, {
      clerkOrgId: CLERK_ORG_ID,
    })
    expect(result.status).toBe('ready')
    expect(result.items).toEqual([])
  })

  it('surfaces credential gaps and blocked billing as critical items', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')
    await seedFullAgency(t, tenantId)

    const result = await asAdmin(t).query(api.auditReadiness.getFixList, {
      clerkOrgId: CLERK_ORG_ID,
    })

    expect(result.status).toBe('not_ready')

    const expired = result.items.find((item) =>
      item.id.startsWith('credential-expired-'),
    )
    expect(expired?.title).toBe("Caregiver One's health_screen expired")
    expect(expired?.severity).toBe('critical')
    expect(expired?.linkTo).toBe('/compliance')

    const missing = result.items.find((item) =>
      item.id.startsWith('credential-missing-'),
    )
    expect(missing?.title).toBe('Caregiver One is missing: Driver License')
    expect(missing?.linkTo).toBe('/compliance')

    const billing = result.items.find((item) => item.id.startsWith('billing-'))
    expect(billing?.title).toBe("A shift for Client One can't be billed yet")
    expect(billing?.severity).toBe('critical')
    expect(billing?.linkTo).toBe('/billing')

    // Every seeded problem is critical, and all criticals sort before any
    // soon items.
    const soonIndex = result.items.findIndex(
      (item) => item.severity === 'soon',
    )
    const criticalIndexes = result.items
      .map((item, index) => (item.severity === 'critical' ? index : -1))
      .filter((index) => index >= 0)
    if (soonIndex >= 0) {
      expect(Math.max(...criticalIndexes)).toBeLessThan(soonIndex)
    }
  })

  it('gives HR no deep link on billing items', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')
    await seedFullAgency(t, tenantId)

    const result = await asHr(t).query(api.auditReadiness.getFixList, {
      clerkOrgId: CLERK_ORG_ID,
    })

    const billing = result.items.find((item) => item.id.startsWith('billing-'))
    expect(billing).toBeDefined()
    expect(billing?.linkTo).toBeNull()
    expect(
      result.items.find((item) => item.id.startsWith('credential-expired-'))
        ?.linkTo,
    ).toBe('/compliance')
  })

  it('flags credentials expiring within 30 days as soon items', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')
    await t.run(async (ctx) => {
      const now = new Date().toISOString()
      const fileId = await ctx.db.insert('files', {
        tenantId,
        storageId: 'storage_1',
        uploadedBy: ADMIN_ID,
        fileName: 'cpr.pdf',
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
        expiresAt: new Date(Date.now() + 10 * DAY_MS).toISOString(),
        createdAt: now,
      })
    })

    const result = await asAdmin(t).query(api.auditReadiness.getFixList, {
      clerkOrgId: CLERK_ORG_ID,
    })

    expect(result.status).toBe('almost')
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.severity).toBe('soon')
    expect(result.items[0]?.title).toBe(
      "Caregiver One's cpr expires in 10 days",
    )
    expect(result.items[0]?.linkTo).toBe('/compliance')
  })

  it('derives SIR items from the shared SLA math', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')
    const incidentId = await t.run(async (ctx) => {
      const now = new Date().toISOString()
      const clientId = await ctx.db.insert('clients', {
        tenantId,
        displayName: 'Client One',
        serviceType: 'SLS',
        authorizationHours: 100,
        riskFlags: [],
      })
      // Learned 30 hours ago: 24h verbal breached, 48h written still pending.
      return ctx.db.insert('specialIncidents', {
        tenantId,
        clientId,
        category: 'medication_error',
        occurredAt: new Date(Date.now() - 31 * 60 * 60 * 1000).toISOString(),
        learnedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
        location: 'Client home',
        description: 'Wrong dose administered.',
        actionsTaken: 'Poison control contacted; client monitored.',
        agenciesNotified: [],
        status: 'draft',
        createdBy: ADMIN_ID,
        createdAt: now,
      })
    })

    const result = await asAdmin(t).query(api.auditReadiness.getFixList, {
      clerkOrgId: CLERK_ORG_ID,
    })

    expect(result.status).toBe('not_ready')

    const verbal = result.items.find((item) => item.id.startsWith('sir-verbal-'))
    expect(verbal?.severity).toBe('critical')
    expect(verbal?.title).toContain('24-hour call')
    expect(verbal?.detail).toMatch(/^overdue by 6 hours$/)
    expect(verbal?.linkTo).toBe(`/incidents/${incidentId}`)

    const written = result.items.find((item) =>
      item.id.startsWith('sir-written-'),
    )
    expect(written?.severity).toBe('soon')
    expect(written?.detail).toMatch(/^due in 1[78] hours$/)

    // Worst first: the breached critical precedes the pending soon item.
    const verbalIndex = result.items.findIndex((item) =>
      item.id.startsWith('sir-verbal-'),
    )
    const writtenIndex = result.items.findIndex((item) =>
      item.id.startsWith('sir-written-'),
    )
    expect(verbalIndex).toBeLessThan(writtenIndex)
  })

  it('strips statutory citations from overdue obligation labels', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')
    await t.run(async (ctx) => {
      await ctx.db.insert('agencyObligations', {
        tenantId,
        key: 'cpa_audit_or_review',
        label: 'Independent CPA audit or review (WIC §4652.5)',
        cadenceMonths: 12,
        dueAt: new Date(Date.now() - DAY_MS).toISOString(),
        createdAt: new Date().toISOString(),
      })
    })

    const result = await asAdmin(t).query(api.auditReadiness.getFixList, {
      clerkOrgId: CLERK_ORG_ID,
    })

    expect(result.status).toBe('not_ready')
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.title).toBe(
      'Independent CPA audit or review is overdue',
    )
    expect(result.items[0]?.title).not.toContain('§')
    expect(result.items[0]?.linkTo).toBe('/compliance')
  })

  it('flags overdue progress reports per client', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')
    const clientId = await t.run(async (ctx) => {
      const clientId = await ctx.db.insert('clients', {
        tenantId,
        displayName: 'Client One',
        serviceType: 'SLS',
        authorizationHours: 100,
        riskFlags: [],
      })
      // Active objective created 4 months ago: the first quarterly SLS report
      // was due one month ago.
      await ctx.db.insert('clientObjectives', {
        tenantId,
        clientId,
        title: 'Objective One',
        source: 'ipp',
        status: 'active',
        createdAt: new Date(Date.now() - 120 * DAY_MS).toISOString(),
      })
      return clientId
    })

    const result = await asAdmin(t).query(api.auditReadiness.getFixList, {
      clerkOrgId: CLERK_ORG_ID,
    })

    expect(result.status).toBe('not_ready')
    const progress = result.items.find((item) =>
      item.id.startsWith('progress-report-'),
    )
    expect(progress?.title).toBe(
      "Client One's quarterly progress report is overdue",
    )
    expect(progress?.linkTo).toBe(`/clients/${clientId}`)
  })

  it('never includes another tenant’s problems', async () => {
    const t = createTestConvex()
    await seedTenant(t, CLERK_ORG_ID, 'Audit Agency')
    const otherTenantId = await seedTenant(t, OTHER_ORG_ID, 'Other Agency')
    await seedFullAgency(t, otherTenantId)

    const result = await asAdmin(t).query(api.auditReadiness.getFixList, {
      clerkOrgId: CLERK_ORG_ID,
    })
    expect(result.status).toBe('ready')
    expect(result.items).toEqual([])
  })
})
