import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

type TestConvex = ReturnType<typeof createTestConvex>

const CLERK_ORG_ID = 'org_reports_test'
const ADMIN_ID = 'user_admin_reports'
const HR_ID = 'user_hr_reports'
const COORDINATOR_ID = 'user_coordinator_reports'
const CAREGIVER_ID = 'user_caregiver_reports'

const PERIOD_START = '2026-01-01'
const PERIOD_END = '2026-03-31'

async function seedTenant(t: TestConvex) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: CLERK_ORG_ID,
      name: 'Reports Agency',
      slug: 'reports-agency',
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
      serviceCoordinatorEmail: 'sc@rc.example.com',
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

async function seedObjective(
  t: TestConvex,
  tenantId: Id<'tenants'>,
  clientId: Id<'clients'>,
  title: string,
  status: 'active' | 'achieved' | 'discontinued' = 'active',
  createdAt = '2026-01-05T12:00:00.000Z',
) {
  return t.run(async (ctx) =>
    ctx.db.insert('clientObjectives', {
      tenantId,
      clientId,
      title,
      source: 'ipp',
      status,
      createdAt,
    }),
  )
}

async function seedShift(
  t: TestConvex,
  opts: {
    tenantId: Id<'tenants'>
    clientId: Id<'clients'>
    scheduledStart: string
    scheduledEnd: string
    status?: 'scheduled' | 'approved' | 'billing_ready'
    objectiveId?: Id<'clientObjectives'>
    servicesProvided?: string
  },
) {
  return t.run(async (ctx) => {
    const shiftId = await ctx.db.insert('shifts', {
      tenantId: opts.tenantId,
      clientId: opts.clientId,
      caregiverId: CAREGIVER_ID,
      scheduledStart: opts.scheduledStart,
      scheduledEnd: opts.scheduledEnd,
      status: opts.status ?? 'approved',
      serviceType: 'SLS',
      rate: 28.5,
    })
    await ctx.db.insert('progressNotes', {
      tenantId: opts.tenantId,
      shiftId,
      startTime: '',
      endTime: '',
      servicesProvided: opts.servicesProvided ?? '',
      clientResponse: '',
      narrative: 'Shift narrative',
      objectiveId: opts.objectiveId,
    })
    return shiftId
  })
}

async function listAuditActions(t: TestConvex, tenantId: Id<'tenants'>) {
  const events = await t.run(async (ctx) =>
    ctx.db
      .query('auditEvents')
      .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
      .collect(),
  )
  return events.map((e) => e.action)
}

describe('progressReports.generateProgressReport', () => {
  it('prefills entries from active objectives with hours and services summaries', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const objectiveA = await seedObjective(t, tenantId, clientId, 'Objective A')
    const objectiveB = await seedObjective(t, tenantId, clientId, 'Objective B')
    await seedObjective(t, tenantId, clientId, 'Old Objective', 'discontinued')

    // Two approved shifts in period linked to objective A (4h + 2h).
    await seedShift(t, {
      tenantId,
      clientId,
      scheduledStart: '2026-02-01T09:00:00.000Z',
      scheduledEnd: '2026-02-01T13:00:00.000Z',
      objectiveId: objectiveA,
      servicesProvided: 'Meal prep practice',
    })
    await seedShift(t, {
      tenantId,
      clientId,
      scheduledStart: '2026-02-10T09:00:00.000Z',
      scheduledEnd: '2026-02-10T11:00:00.000Z',
      status: 'billing_ready',
      objectiveId: objectiveA,
      servicesProvided: 'Meal prep practice',
    })
    // Out of period — must not count.
    await seedShift(t, {
      tenantId,
      clientId,
      scheduledStart: '2026-05-01T09:00:00.000Z',
      scheduledEnd: '2026-05-01T12:00:00.000Z',
      objectiveId: objectiveA,
      servicesProvided: 'Out of period',
    })
    // Not approved — must not count.
    await seedShift(t, {
      tenantId,
      clientId,
      scheduledStart: '2026-02-15T09:00:00.000Z',
      scheduledEnd: '2026-02-15T17:00:00.000Z',
      status: 'scheduled',
      objectiveId: objectiveB,
      servicesProvided: 'Budget practice',
    })
    // Approved but no objective link — counts toward no objective.
    await seedShift(t, {
      tenantId,
      clientId,
      scheduledStart: '2026-02-20T09:00:00.000Z',
      scheduledEnd: '2026-02-20T12:00:00.000Z',
      servicesProvided: 'Untagged support',
    })

    const reportId = await asCoordinator(t).mutation(
      api.progressReports.generateProgressReport,
      {
        clerkOrgId: CLERK_ORG_ID,
        clientId,
        periodType: 'quarterly',
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
      },
    )

    const report = await t.run(async (ctx) => ctx.db.get(reportId))
    expect(report).toMatchObject({
      tenantId,
      clientId,
      periodType: 'quarterly',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      status: 'draft',
    })
    // Only active objectives, in creation order.
    expect(report?.entries.map((e) => e.objectiveTitle)).toEqual([
      'Objective A',
      'Objective B',
    ])
    const [entryA, entryB] = report!.entries
    expect(entryA.hoursDelivered).toBe(6)
    expect(entryA.servicesSummary).toBe('Meal prep practice')
    expect(entryA.progressSummary).toBe('')
    expect(entryA.barriers).toBe('')
    expect(entryA.planForward).toBe('')
    expect(entryB.hoursDelivered).toBe(0)
    expect(entryB.servicesSummary).toBe('')

    const actions = await listAuditActions(t, tenantId)
    expect(actions).toContain('report_generated')
  })

  it('regenerating an existing draft updates it instead of duplicating', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const objectiveA = await seedObjective(t, tenantId, clientId, 'Objective A')
    await seedShift(t, {
      tenantId,
      clientId,
      scheduledStart: '2026-02-01T09:00:00.000Z',
      scheduledEnd: '2026-02-01T13:00:00.000Z',
      objectiveId: objectiveA,
      servicesProvided: 'Meal prep practice',
    })

    const args = {
      clerkOrgId: CLERK_ORG_ID,
      clientId,
      periodType: 'quarterly' as const,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    }
    const firstId = await asAdmin(t).mutation(
      api.progressReports.generateProgressReport,
      args,
    )
    const secondId = await asAdmin(t).mutation(
      api.progressReports.generateProgressReport,
      args,
    )

    expect(secondId).toBe(firstId)
    const reports = await t.run(async (ctx) =>
      ctx.db
        .query('progressReports')
        .withIndex('by_tenant_client_period', (q) =>
          q.eq('tenantId', tenantId).eq('clientId', clientId),
        )
        .collect(),
    )
    expect(reports).toHaveLength(1)
  })

  it('rejects regenerating a submitted report', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)
    const args = {
      clerkOrgId: CLERK_ORG_ID,
      clientId,
      periodType: 'quarterly' as const,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    }
    const reportId = await asAdmin(t).mutation(
      api.progressReports.generateProgressReport,
      args,
    )
    await asAdmin(t).mutation(api.progressReports.submitProgressReport, {
      clerkOrgId: CLERK_ORG_ID,
      reportId,
    })

    await expect(
      asAdmin(t).mutation(api.progressReports.generateProgressReport, args),
    ).rejects.toThrow('locked')
  })

  it('enforces the cadence implied by the client serviceType', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t)
    const ilsClientId = await t.run(async (ctx) =>
      ctx.db.insert('clients', {
        tenantId,
        displayName: 'Sam Lee',
        serviceType: 'ILS',
        authorizationHours: 20,
        riskFlags: [],
      }),
    )

    await expect(
      asAdmin(t).mutation(api.progressReports.generateProgressReport, {
        clerkOrgId: CLERK_ORG_ID,
        clientId: ilsClientId,
        periodType: 'quarterly',
        periodStart: PERIOD_START,
        periodEnd: '2026-06-30',
      }),
    ).rejects.toThrow('semiannual')
  })

  it('validates ISO dates and period ordering', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)

    await expect(
      asAdmin(t).mutation(api.progressReports.generateProgressReport, {
        clerkOrgId: CLERK_ORG_ID,
        clientId,
        periodType: 'quarterly',
        periodStart: '01/01/2026',
        periodEnd: PERIOD_END,
      }),
    ).rejects.toThrow('ISO date')

    await expect(
      asAdmin(t).mutation(api.progressReports.generateProgressReport, {
        clerkOrgId: CLERK_ORG_ID,
        clientId,
        periodType: 'quarterly',
        periodStart: PERIOD_END,
        periodEnd: PERIOD_START,
      }),
    ).rejects.toThrow('on or before')
  })

  it('rejects caregivers and cross-tenant clients', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)

    await expect(
      asCaregiver(t).mutation(api.progressReports.generateProgressReport, {
        clerkOrgId: CLERK_ORG_ID,
        clientId,
        periodType: 'quarterly',
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
      }),
    ).rejects.toThrow('org:admin')

    const otherClientId = await t.run(async (ctx) => {
      const otherTenantId = await ctx.db.insert('tenants', {
        clerkOrgId: 'org_other',
        name: 'Other',
        slug: 'other',
        createdAt: new Date().toISOString(),
      })
      return ctx.db.insert('clients', {
        tenantId: otherTenantId,
        displayName: 'Other Client',
        serviceType: 'SLS',
        authorizationHours: 10,
        riskFlags: [],
      })
    })

    await expect(
      asAdmin(t).mutation(api.progressReports.generateProgressReport, {
        clerkOrgId: CLERK_ORG_ID,
        clientId: otherClientId,
        periodType: 'quarterly',
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
      }),
    ).rejects.toThrow('cross-tenant')
  })
})

describe('progressReports.updateProgressReportEntries', () => {
  async function seedDraft(t: TestConvex) {
    const { tenantId, clientId } = await seedTenant(t)
    const objectiveA = await seedObjective(t, tenantId, clientId, 'Objective A')
    await seedShift(t, {
      tenantId,
      clientId,
      scheduledStart: '2026-02-01T09:00:00.000Z',
      scheduledEnd: '2026-02-01T13:00:00.000Z',
      objectiveId: objectiveA,
      servicesProvided: 'Meal prep practice',
    })
    const reportId = await asAdmin(t).mutation(
      api.progressReports.generateProgressReport,
      {
        clerkOrgId: CLERK_ORG_ID,
        clientId,
        periodType: 'quarterly',
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
      },
    )
    return { tenantId, clientId, objectiveA, reportId }
  }

  it('updates narrative fields while preserving computed hours', async () => {
    const t = createTestConvex()
    const { tenantId, objectiveA, reportId } = await seedDraft(t)

    await asHr(t).mutation(api.progressReports.updateProgressReportEntries, {
      clerkOrgId: CLERK_ORG_ID,
      reportId,
      entries: [
        {
          objectiveId: objectiveA,
          servicesSummary: 'Edited services',
          progressSummary: 'Making steady progress',
          barriers: 'Transportation',
          planForward: 'Continue weekly practice',
        },
      ],
    })

    const report = await t.run(async (ctx) => ctx.db.get(reportId))
    expect(report?.entries[0]).toMatchObject({
      objectiveTitle: 'Objective A',
      servicesSummary: 'Edited services',
      progressSummary: 'Making steady progress',
      barriers: 'Transportation',
      planForward: 'Continue weekly practice',
      hoursDelivered: 4,
    })

    const actions = await listAuditActions(t, tenantId)
    expect(actions).toContain('report_updated')
  })

  it('rejects edits to submitted reports', async () => {
    const t = createTestConvex()
    const { objectiveA, reportId } = await seedDraft(t)
    await asAdmin(t).mutation(api.progressReports.submitProgressReport, {
      clerkOrgId: CLERK_ORG_ID,
      reportId,
    })

    await expect(
      asAdmin(t).mutation(api.progressReports.updateProgressReportEntries, {
        clerkOrgId: CLERK_ORG_ID,
        reportId,
        entries: [
          {
            objectiveId: objectiveA,
            servicesSummary: 'x',
            progressSummary: 'x',
            barriers: 'x',
            planForward: 'x',
          },
        ],
      }),
    ).rejects.toThrow('draft')
  })

  it('rejects an objective belonging to a different client', async () => {
    const t = createTestConvex()
    const { tenantId, reportId } = await seedDraft(t)
    const otherObjectiveId = await t.run(async (ctx) => {
      const otherClientId = await ctx.db.insert('clients', {
        tenantId,
        displayName: 'Other Client',
        serviceType: 'SLS',
        authorizationHours: 10,
        riskFlags: [],
      })
      return ctx.db.insert('clientObjectives', {
        tenantId,
        clientId: otherClientId,
        title: 'Other Objective',
        source: 'isp',
        status: 'active',
        createdAt: new Date().toISOString(),
      })
    })

    await expect(
      asAdmin(t).mutation(api.progressReports.updateProgressReportEntries, {
        clerkOrgId: CLERK_ORG_ID,
        reportId,
        entries: [
          {
            objectiveId: otherObjectiveId,
            servicesSummary: 'x',
            progressSummary: 'x',
            barriers: 'x',
            planForward: 'x',
          },
        ],
      }),
    ).rejects.toThrow('different client')
  })
})

describe('progressReports.submitProgressReport', () => {
  it('locks the report, defaults submittedTo to the service coordinator, and audits', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const reportId = await asAdmin(t).mutation(
      api.progressReports.generateProgressReport,
      {
        clerkOrgId: CLERK_ORG_ID,
        clientId,
        periodType: 'quarterly',
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
      },
    )

    await asAdmin(t).mutation(api.progressReports.submitProgressReport, {
      clerkOrgId: CLERK_ORG_ID,
      reportId,
    })

    const report = await t.run(async (ctx) => ctx.db.get(reportId))
    expect(report?.status).toBe('submitted')
    expect(report?.submittedAt).toBeTruthy()
    expect(report?.submittedTo).toBe('sc@rc.example.com')

    const events = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    const submitEvent = events.find((e) => e.action === 'report_submitted')
    expect(submitEvent?.previousStatus).toBe('draft')
    expect(submitEvent?.nextStatus).toBe('submitted')

    await expect(
      asAdmin(t).mutation(api.progressReports.submitProgressReport, {
        clerkOrgId: CLERK_ORG_ID,
        reportId,
      }),
    ).rejects.toThrow('already been submitted')
  })

  it('uses an explicit submittedTo when provided', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)
    const reportId = await asAdmin(t).mutation(
      api.progressReports.generateProgressReport,
      {
        clerkOrgId: CLERK_ORG_ID,
        clientId,
        periodType: 'quarterly',
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
      },
    )

    await asAdmin(t).mutation(api.progressReports.submitProgressReport, {
      clerkOrgId: CLERK_ORG_ID,
      reportId,
      submittedTo: 'Jordan SC (jordan@rc.example.com)',
    })

    const report = await t.run(async (ctx) => ctx.db.get(reportId))
    expect(report?.submittedTo).toBe('Jordan SC (jordan@rc.example.com)')
  })
})

describe('progressReports.listProgressReports', () => {
  it('returns reports with clientName and per-client due-ness', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    // Anchor objective created 2026-01-05 → SLS quarterly → nextDue 2026-04-05.
    await seedObjective(t, tenantId, clientId, 'Objective A')
    await asAdmin(t).mutation(api.progressReports.generateProgressReport, {
      clerkOrgId: CLERK_ORG_ID,
      clientId,
      periodType: 'quarterly',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    })
    // Client with no objectives → no baseline.
    await t.run(async (ctx) =>
      ctx.db.insert('clients', {
        tenantId,
        displayName: 'No Objectives',
        serviceType: 'ILS',
        authorizationHours: 10,
        riskFlags: [],
      }),
    )

    const result = await asHr(t).query(api.progressReports.listProgressReports, {
      clerkOrgId: CLERK_ORG_ID,
    })

    expect(result.reports).toHaveLength(1)
    expect(result.reports[0].clientName).toBe('Alex Rivera')

    const dueAlex = result.due.find((d) => d.clientName === 'Alex Rivera')
    expect(dueAlex).toMatchObject({
      serviceType: 'SLS',
      periodType: 'quarterly',
      lastSubmittedPeriodEnd: null,
      nextDueAt: '2026-04-05',
      suggestedPeriodStart: '2026-01-05',
      suggestedPeriodEnd: '2026-04-04',
    })
    const dueEmpty = result.due.find((d) => d.clientName === 'No Objectives')
    expect(dueEmpty).toMatchObject({
      periodType: 'semiannual',
      nextDueAt: null,
      dueStatus: 'no_baseline',
      suggestedPeriodStart: null,
    })
  })

  it('derives the next due date from the last submitted report', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)
    const reportId = await asAdmin(t).mutation(
      api.progressReports.generateProgressReport,
      {
        clerkOrgId: CLERK_ORG_ID,
        clientId,
        periodType: 'quarterly',
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
      },
    )
    await asAdmin(t).mutation(api.progressReports.submitProgressReport, {
      clerkOrgId: CLERK_ORG_ID,
      reportId,
    })

    const result = await asAdmin(t).query(
      api.progressReports.listProgressReports,
      { clerkOrgId: CLERK_ORG_ID, clientId, status: 'submitted' },
    )

    expect(result.reports).toHaveLength(1)
    expect(result.due[0]).toMatchObject({
      lastSubmittedPeriodEnd: PERIOD_END,
      nextDueAt: '2026-06-30',
      suggestedPeriodStart: '2026-04-01',
      suggestedPeriodEnd: '2026-06-30',
    })
  })

  it('filters by status and rejects caregivers', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)
    await asAdmin(t).mutation(api.progressReports.generateProgressReport, {
      clerkOrgId: CLERK_ORG_ID,
      clientId,
      periodType: 'quarterly',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    })

    const drafts = await asAdmin(t).query(
      api.progressReports.listProgressReports,
      { clerkOrgId: CLERK_ORG_ID, status: 'draft' },
    )
    expect(drafts.reports).toHaveLength(1)
    const submitted = await asAdmin(t).query(
      api.progressReports.listProgressReports,
      { clerkOrgId: CLERK_ORG_ID, status: 'submitted' },
    )
    expect(submitted.reports).toHaveLength(0)

    await expect(
      asCaregiver(t).query(api.progressReports.listProgressReports, {
        clerkOrgId: CLERK_ORG_ID,
      }),
    ).rejects.toThrow('org:admin')
  })
})

describe('progressReports.exportReportCsv', () => {
  it('exports the report with the shared CSV escaping conventions', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const objectiveA = await seedObjective(t, tenantId, clientId, 'Objective A')
    await seedShift(t, {
      tenantId,
      clientId,
      scheduledStart: '2026-02-01T09:00:00.000Z',
      scheduledEnd: '2026-02-01T13:00:00.000Z',
      objectiveId: objectiveA,
      servicesProvided: '=HYPERLINK("http://evil")',
    })
    const reportId = await asAdmin(t).mutation(
      api.progressReports.generateProgressReport,
      {
        clerkOrgId: CLERK_ORG_ID,
        clientId,
        periodType: 'quarterly',
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
      },
    )

    const csv = await asAdmin(t).query(api.progressReports.exportReportCsv, {
      clerkOrgId: CLERK_ORG_ID,
      reportId,
    })

    expect(csv).toContain('"ATRIA-X Client Progress Report"')
    expect(csv).toContain('"Client","Alex Rivera"')
    expect(csv).toContain('"2026-01-01 to 2026-03-31"')
    // Formula-character guard: leading = is apostrophe-prefixed, quotes doubled.
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`)
    expect(csv).toContain('"Objective A"')
    expect(csv).toContain(',"4"') // hours delivered
  })
})

describe('progressReports.checkProgressReportsDue cron', () => {
  function monthsAgoDateOnly(months: number) {
    const date = new Date()
    date.setUTCMonth(date.getUTCMonth() - months)
    return `${date.toISOString().slice(0, 10)}T12:00:00.000Z`
  }

  it('flags due clients once and notifies admin + coordinator only', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    // Objective created ~4 months ago → SLS quarterly next-due is past.
    await seedObjective(
      t,
      tenantId,
      clientId,
      'Objective A',
      'active',
      monthsAgoDateOnly(4),
    )
    // Far-future due date → skipped.
    const futureClientId = await t.run(async (ctx) =>
      ctx.db.insert('clients', {
        tenantId,
        displayName: 'Future Client',
        serviceType: 'SLS',
        authorizationHours: 10,
        riskFlags: [],
      }),
    )
    await seedObjective(
      t,
      tenantId,
      futureClientId,
      'Objective F',
      'active',
      new Date().toISOString(),
    )

    const first = await t.mutation(
      internal.progressReports.checkProgressReportsDue,
      {},
    )
    expect(first.created).toBe(1)

    const second = await t.mutation(
      internal.progressReports.checkProgressReportsDue,
      {},
    )
    expect(second.created).toBe(0)

    const cases = await t.run(async (ctx) =>
      ctx.db
        .query('hrCases')
        .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(cases).toHaveLength(1)
    expect(cases[0]).toMatchObject({
      subjectType: 'client',
      subjectId: clientId,
      flagType: 'progress_report_due',
      category: 'compliance',
      status: 'open',
    })

    const notifications = await t.run(async (ctx) =>
      ctx.db
        .query('notifications')
        .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    const flagged = notifications.filter(
      (n) => n.type === 'progress_report_due',
    )
    expect(flagged.map((n) => n.clerkUserId).sort()).toEqual([
      ADMIN_ID,
      COORDINATOR_ID,
    ])
  })

  it('skips clients with no baseline', async () => {
    const t = createTestConvex()
    await seedTenant(t)

    const result = await t.mutation(
      internal.progressReports.checkProgressReportsDue,
      {},
    )
    expect(result.created).toBe(0)
  })
})

describe('progressReports.getProgressReportSummary', () => {
  it('counts clients by due status and reports by status', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    // Active objective created months ago → next quarterly due date is past.
    await seedObjective(t, tenantId, clientId, 'Old objective')
    await t.run(async (ctx) => {
      await ctx.db.insert('progressReports', {
        tenantId,
        clientId,
        periodType: 'quarterly',
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        entries: [],
        status: 'submitted',
        generatedBy: ADMIN_ID,
        submittedAt: '2026-04-01T00:00:00.000Z',
        createdAt: '2026-04-01T00:00:00.000Z',
      })
      await ctx.db.insert('progressReports', {
        tenantId,
        clientId,
        periodType: 'quarterly',
        periodStart: '2026-04-01',
        periodEnd: '2026-06-30',
        entries: [],
        status: 'draft',
        generatedBy: ADMIN_ID,
        createdAt: '2026-07-01T00:00:00.000Z',
      })
    })

    const summary = await asAdmin(t).query(
      api.progressReports.getProgressReportSummary,
      { clerkOrgId: CLERK_ORG_ID },
    )

    expect(summary.clients).toBe(1)
    // Last submitted periodEnd 2026-03-31 + 3 months → 2026-06-30, past due.
    expect(summary.overdue).toBe(1)
    expect(summary.dueSoon).toBe(0)
    expect(summary.onTrack).toBe(0)
    expect(summary.noBaseline).toBe(0)
    expect(summary.submittedReports).toBe(1)
    expect(summary.draftReports).toBe(1)
  })

  it('counts clients without objectives as no_baseline', async () => {
    const t = createTestConvex()
    await seedTenant(t)

    const summary = await asHr(t).query(
      api.progressReports.getProgressReportSummary,
      { clerkOrgId: CLERK_ORG_ID },
    )

    expect(summary.clients).toBe(1)
    expect(summary.noBaseline).toBe(1)
    expect(summary.submittedReports).toBe(0)
  })

  it('is blocked for org:caregiver', async () => {
    const t = createTestConvex()
    await seedTenant(t)

    await expect(
      asCaregiver(t).query(api.progressReports.getProgressReportSummary, {
        clerkOrgId: CLERK_ORG_ID,
      }),
    ).rejects.toThrow()
  })
})
