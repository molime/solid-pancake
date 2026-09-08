import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { addBusinessDays, grievanceSlaDueAt } from './grievances'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

type TestConvex = ReturnType<typeof createTestConvex>

const CLERK_ORG_ID = 'org_grievances_test'
const ADMIN_ID = 'user_admin_grievances'
const COORDINATOR_ID = 'user_coordinator_grievances'
const HR_ID = 'user_hr_grievances'
const CAREGIVER_ID = 'user_caregiver_grievances'

async function seedTenant(t: TestConvex) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: CLERK_ORG_ID,
      name: 'Grievance Agency',
      slug: 'grievance-agency',
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
      displayName: 'Caregiver',
      email: 'caregiver@example.com',
    })

    const clientId = await ctx.db.insert('clients', {
      tenantId,
      displayName: 'Client One',
      serviceType: 'SLS',
      authorizationHours: 100,
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

function fileArgs(clientId: Id<'clients'>, filedAt?: string) {
  return {
    clerkOrgId: CLERK_ORG_ID,
    clientId,
    filedAt: filedAt ?? new Date().toISOString(),
    filedBy: 'Client One',
    description: 'Staff arrived late repeatedly.',
  }
}

async function seedGrievance(
  t: TestConvex,
  tenantId: Id<'tenants'>,
  clientId: Id<'clients'>,
  overrides: Record<string, unknown> = {},
) {
  return t.run(async (ctx) =>
    ctx.db.insert('grievances', {
      tenantId,
      clientId,
      filedAt: new Date().toISOString(),
      filedBy: 'Client One',
      description: 'Staff arrived late repeatedly.',
      status: 'open',
      createdAt: new Date().toISOString(),
      ...overrides,
    } as never),
  )
}

describe('grievances SLA business-day math', () => {
  it('adds 5 business days skipping weekends', () => {
    // 2026-08-14 is a Friday: 17,18,19,20,21 are the 5 business days.
    expect(addBusinessDays('2026-08-14T10:00:00.000Z', 5)).toBe(
      '2026-08-21T23:59:59.999Z',
    )
    // 2026-08-17 is a Monday: due the following Monday.
    expect(addBusinessDays('2026-08-17T10:00:00.000Z', 5)).toBe(
      '2026-08-24T23:59:59.999Z',
    )
    // Saturday filing starts counting Monday.
    expect(addBusinessDays('2026-08-15T10:00:00.000Z', 5)).toBe(
      '2026-08-21T23:59:59.999Z',
    )
  })
})

describe('grievances workflow', () => {
  it('files a grievance with SLA fields and an audit event', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)

    const grievanceId = await asAdmin(t).mutation(
      api.grievances.fileGrievance,
      fileArgs(clientId, '2026-08-17T10:00:00.000Z'),
    )
    expect(grievanceId).toBeDefined()

    const list = await asCoordinator(t).query(api.grievances.listGrievances, {
      clerkOrgId: CLERK_ORG_ID,
      clientId,
    })
    expect(list).toHaveLength(1)
    expect(list[0].status).toBe('open')
    expect(list[0].clientName).toBe('Client One')
    expect(list[0].slaDueAt).toBe('2026-08-24T23:59:59.999Z')
    expect(list[0].slaBreached).toBe(false)

    const auditEvents = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(auditEvents.some((e) => e.action === 'grievance_filed')).toBe(true)
  })

  it('moves open → resolution_proposed → resolved with audit events', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)

    const grievanceId = await asAdmin(t).mutation(
      api.grievances.fileGrievance,
      fileArgs(clientId),
    )

    await asAdmin(t).mutation(api.grievances.proposeResolution, {
      clerkOrgId: CLERK_ORG_ID,
      grievanceId,
      resolutionNote: 'Schedule adjusted with the caregiver.',
    })

    let list = await asAdmin(t).query(api.grievances.listGrievances, {
      clerkOrgId: CLERK_ORG_ID,
      clientId,
    })
    expect(list[0].status).toBe('resolution_proposed')
    expect(list[0].proposedAt).toBeDefined()

    // A second proposal is rejected.
    await expect(
      asAdmin(t).mutation(api.grievances.proposeResolution, {
        clerkOrgId: CLERK_ORG_ID,
        grievanceId,
        resolutionNote: 'Duplicate.',
      }),
    ).rejects.toThrow(/already proposed/)

    await asAdmin(t).mutation(api.grievances.resolveGrievance, {
      clerkOrgId: CLERK_ORG_ID,
      grievanceId,
    })

    list = await asAdmin(t).query(api.grievances.listGrievances, {
      clerkOrgId: CLERK_ORG_ID,
      clientId,
    })
    expect(list[0].status).toBe('resolved')
    expect(list[0].resolvedAt).toBeDefined()

    // Resolved grievances are terminal.
    await expect(
      asAdmin(t).mutation(api.grievances.escalateGrievance, {
        clerkOrgId: CLERK_ORG_ID,
        grievanceId,
      }),
    ).rejects.toThrow(/already resolved/)

    const auditEvents = await t.run(async (ctx) =>
      ctx.db.query('auditEvents').collect(),
    )
    for (const action of [
      'grievance_filed',
      'grievance_resolution_proposed',
      'grievance_resolved',
    ]) {
      expect(auditEvents.some((e) => e.action === action)).toBe(true)
    }
  })

  it('escalates from open and can still be resolved afterwards', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)

    const grievanceId = await asAdmin(t).mutation(
      api.grievances.fileGrievance,
      fileArgs(clientId),
    )
    await asAdmin(t).mutation(api.grievances.escalateGrievance, {
      clerkOrgId: CLERK_ORG_ID,
      grievanceId,
    })

    let list = await asAdmin(t).query(api.grievances.listGrievances, {
      clerkOrgId: CLERK_ORG_ID,
      clientId,
    })
    expect(list[0].status).toBe('escalated')

    await asAdmin(t).mutation(api.grievances.resolveGrievance, {
      clerkOrgId: CLERK_ORG_ID,
      grievanceId,
      resolutionNote: 'Resolved after regional center involvement.',
    })
    list = await asAdmin(t).query(api.grievances.listGrievances, {
      clerkOrgId: CLERK_ORG_ID,
      clientId,
    })
    expect(list[0].status).toBe('resolved')

    const auditEvents = await t.run(async (ctx) =>
      ctx.db.query('auditEvents').collect(),
    )
    expect(auditEvents.some((e) => e.action === 'grievance_escalated')).toBe(
      true,
    )
  })

  it('rejects caregivers and blank input', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)

    await expect(
      asCaregiver(t).mutation(api.grievances.fileGrievance, fileArgs(clientId)),
    ).rejects.toThrow()
    await expect(
      asAdmin(t).mutation(api.grievances.fileGrievance, {
        ...fileArgs(clientId),
        description: '   ',
      }),
    ).rejects.toThrow(/Description is required/)
  })
})

describe('grievances.getGrievanceSummary', () => {
  it('counts unresolved and SLA-overdue grievances', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)

    // Long past the 5-business-day SLA → overdue.
    await seedGrievance(t, tenantId, clientId, {
      filedAt: '2026-01-05T10:00:00.000Z',
    })
    // Filed today → not overdue.
    await seedGrievance(t, tenantId, clientId)
    // Resolved → excluded from open count.
    await seedGrievance(t, tenantId, clientId, {
      filedAt: '2026-01-05T10:00:00.000Z',
      status: 'resolved',
      resolvedAt: '2026-01-06T10:00:00.000Z',
    })

    const summary = await asAdmin(t).query(api.grievances.getGrievanceSummary, {
      clerkOrgId: CLERK_ORG_ID,
    })
    expect(summary).toEqual({ open: 2, overdue: 1 })
  })
})

describe('grievances.checkOverdueGrievances cron', () => {
  it('creates one deduplicated HR case per overdue grievance and notifies admin/hr', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)

    const overdueId = await seedGrievance(t, tenantId, clientId, {
      filedAt: '2026-01-05T10:00:00.000Z',
    })
    // Within SLA: no case.
    await seedGrievance(t, tenantId, clientId)
    // Resolved: no case even though filed long ago.
    await seedGrievance(t, tenantId, clientId, {
      filedAt: '2026-01-05T10:00:00.000Z',
      status: 'resolved',
      resolvedAt: '2026-02-01T10:00:00.000Z',
    })

    await t.mutation(internal.grievances.checkOverdueGrievances, {})
    // Second run must not duplicate the case or the notifications.
    await t.mutation(internal.grievances.checkOverdueGrievances, {})

    const state = await t.run(async (ctx) => {
      const cases = await ctx.db
        .query('hrCases')
        .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
        .collect()
      const notifications = await ctx.db
        .query('notifications')
        .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
        .collect()
      return { cases, notifications }
    })

    const flagCases = state.cases.filter(
      (c) => c.flagType === 'grievance_overdue',
    )
    expect(flagCases).toHaveLength(1)
    expect(flagCases[0].subjectId).toBe(overdueId as string)
    expect(flagCases[0].subjectType).toBe('grievance')

    // Admin + HR notified, not the coordinator or caregiver.
    expect(state.notifications).toHaveLength(2)
    expect(
      state.notifications.every((n) => n.type === 'grievance_overdue'),
    ).toBe(true)
  })

  it('creates no case when nothing is overdue', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    await seedGrievance(t, tenantId, clientId)

    const result = await t.mutation(
      internal.grievances.checkOverdueGrievances,
      {},
    )
    expect(result.created).toBe(0)
  })
})

// Pure-helper sanity: SLA due is anchored to filedAt.
describe('grievanceSlaDueAt', () => {
  it('derives the due date from filedAt', () => {
    expect(grievanceSlaDueAt({ filedAt: '2026-08-17T10:00:00.000Z' })).toBe(
      '2026-08-24T23:59:59.999Z',
    )
  })
})
