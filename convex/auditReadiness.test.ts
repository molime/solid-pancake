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
