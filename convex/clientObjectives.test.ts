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

const CLERK_ORG_ID = 'org_objectives_test'
const ADMIN_ID = 'user_admin_objectives'
const HR_ID = 'user_hr_objectives'
const COORDINATOR_ID = 'user_coordinator_objectives'
const CAREGIVER_ID = 'user_caregiver_objectives'

async function seedTenant(t: TestConvex) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: CLERK_ORG_ID,
      name: 'Objectives Agency',
      slug: 'objectives-agency',
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

async function listAuditActions(t: TestConvex, tenantId: Id<'tenants'>) {
  const events = await t.run(async (ctx) =>
    ctx.db
      .query('auditEvents')
      .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
      .collect(),
  )
  return events.map((e) => e.action)
}

describe('clientObjectives.create', () => {
  it('creates an active objective and audits objective_created', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)

    const objectiveId = await asCoordinator(t).mutation(
      api.clientObjectives.create,
      {
        clerkOrgId: CLERK_ORG_ID,
        clientId,
        title: 'Prepare a simple meal',
        description: 'Uses microwave safely',
        source: 'ipp',
        targetDate: '2026-12-31',
        hoursPerMonth: 6,
      },
    )

    const objective = await t.run(async (ctx) => ctx.db.get(objectiveId))
    expect(objective).toMatchObject({
      tenantId,
      clientId,
      title: 'Prepare a simple meal',
      description: 'Uses microwave safely',
      source: 'ipp',
      targetDate: '2026-12-31',
      hoursPerMonth: 6,
      status: 'active',
    })

    const actions = await listAuditActions(t, tenantId)
    expect(actions).toContain('objective_created')
  })

  it('rejects an empty title', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)

    await expect(
      asAdmin(t).mutation(api.clientObjectives.create, {
        clerkOrgId: CLERK_ORG_ID,
        clientId,
        title: '   ',
        source: 'isp',
      }),
    ).rejects.toThrow('title is required')
  })

  it('rejects a malformed target date', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)

    await expect(
      asAdmin(t).mutation(api.clientObjectives.create, {
        clerkOrgId: CLERK_ORG_ID,
        clientId,
        title: 'Goal',
        source: 'ipp',
        targetDate: '12/31/2026',
      }),
    ).rejects.toThrow('ISO date')
  })

  it('rejects caregivers', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)

    await expect(
      asCaregiver(t).mutation(api.clientObjectives.create, {
        clerkOrgId: CLERK_ORG_ID,
        clientId,
        title: 'Goal',
        source: 'ipp',
      }),
    ).rejects.toThrow('org:admin')
  })
})

describe('clientObjectives.listByClient', () => {
  it('returns only the requested client’s objectives and allows caregiver reads', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const otherClientId = await t.run(async (ctx) =>
      ctx.db.insert('clients', {
        tenantId,
        displayName: 'Jordan Lee',
        serviceType: 'ILS',
        authorizationHours: 20,
        riskFlags: [],
      }),
    )

    await asAdmin(t).mutation(api.clientObjectives.create, {
      clerkOrgId: CLERK_ORG_ID,
      clientId,
      title: 'Objective A',
      source: 'ipp',
    })
    await asAdmin(t).mutation(api.clientObjectives.create, {
      clerkOrgId: CLERK_ORG_ID,
      clientId: otherClientId,
      title: 'Objective B',
      source: 'isp',
    })

    const objectives = await asCaregiver(t).query(
      api.clientObjectives.listByClient,
      { clerkOrgId: CLERK_ORG_ID, clientId },
    )

    expect(objectives).toHaveLength(1)
    expect(objectives[0].title).toBe('Objective A')
    expect(objectives[0].tenantId).toBe(tenantId)
  })

  it('rejects a client from another tenant', async () => {
    const t = createTestConvex()
    await seedTenant(t)
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
      asAdmin(t).query(api.clientObjectives.listByClient, {
        clerkOrgId: CLERK_ORG_ID,
        clientId: otherClientId,
      }),
    ).rejects.toThrow('cross-tenant')
  })
})

describe('clientObjectives.update', () => {
  it('edits fields and audits objective_updated', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const objectiveId = await asAdmin(t).mutation(api.clientObjectives.create, {
      clerkOrgId: CLERK_ORG_ID,
      clientId,
      title: 'Objective A',
      source: 'ipp',
    })

    await asHr(t).mutation(api.clientObjectives.update, {
      clerkOrgId: CLERK_ORG_ID,
      objectiveId,
      title: 'Objective A (revised)',
      targetDate: '2027-03-31',
      hoursPerMonth: 4,
    })

    const objective = await t.run(async (ctx) => ctx.db.get(objectiveId))
    expect(objective?.title).toBe('Objective A (revised)')
    expect(objective?.targetDate).toBe('2027-03-31')
    expect(objective?.hoursPerMonth).toBe(4)
    expect(objective?.status).toBe('active')

    const actions = await listAuditActions(t, tenantId)
    expect(actions).toContain('objective_updated')
    expect(actions).not.toContain('objective_status_changed')
  })

  it('audits objective_status_changed when the status transitions', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const objectiveId = await asAdmin(t).mutation(api.clientObjectives.create, {
      clerkOrgId: CLERK_ORG_ID,
      clientId,
      title: 'Objective A',
      source: 'isp',
    })

    await asAdmin(t).mutation(api.clientObjectives.update, {
      clerkOrgId: CLERK_ORG_ID,
      objectiveId,
      status: 'achieved',
    })

    const objective = await t.run(async (ctx) => ctx.db.get(objectiveId))
    expect(objective?.status).toBe('achieved')

    const events = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    const statusEvent = events.find(
      (e) => e.action === 'objective_status_changed',
    )
    expect(statusEvent?.previousStatus).toBe('active')
    expect(statusEvent?.nextStatus).toBe('achieved')
  })

  it('rejects an objective from another tenant', async () => {
    const t = createTestConvex()
    await seedTenant(t)
    const otherObjectiveId = await t.run(async (ctx) => {
      const otherTenantId = await ctx.db.insert('tenants', {
        clerkOrgId: 'org_other',
        name: 'Other',
        slug: 'other',
        createdAt: new Date().toISOString(),
      })
      const otherClientId = await ctx.db.insert('clients', {
        tenantId: otherTenantId,
        displayName: 'Other Client',
        serviceType: 'SLS',
        authorizationHours: 10,
        riskFlags: [],
      })
      return ctx.db.insert('clientObjectives', {
        tenantId: otherTenantId,
        clientId: otherClientId,
        title: 'Other Objective',
        source: 'ipp',
        status: 'active',
        createdAt: new Date().toISOString(),
      })
    })

    await expect(
      asAdmin(t).mutation(api.clientObjectives.update, {
        clerkOrgId: CLERK_ORG_ID,
        objectiveId: otherObjectiveId,
        title: 'Hijack',
      }),
    ).rejects.toThrow('cross-tenant')
  })
})

describe('shifts.updateProgressNote objective tagging', () => {
  async function seedInProgressShift(
    t: TestConvex,
    tenantId: Id<'tenants'>,
    clientId: Id<'clients'>,
  ) {
    return t.run(async (ctx) => {
      const now = new Date().toISOString()
      const shiftId = await ctx.db.insert('shifts', {
        tenantId,
        clientId,
        caregiverId: CAREGIVER_ID,
        scheduledStart: '2026-08-10T09:00:00Z',
        scheduledEnd: '2026-08-10T13:00:00Z',
        clockInAt: now,
        status: 'in_progress',
        serviceType: 'SLS',
        rate: 28.5,
      })
      await ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId: CAREGIVER_ID,
        punchType: 'clock_in',
        at: now,
        source: 'atriax',
        adpSyncStatus: 'synced',
        createdAt: now,
      })
      await ctx.db.insert('progressNotes', {
        tenantId,
        shiftId,
        startTime: '',
        endTime: '',
        servicesProvided: '',
        clientResponse: '',
        narrative: '',
      })
      return shiftId
    })
  }

  it('tags the shift note with an objective of the same client', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const shiftId = await seedInProgressShift(t, tenantId, clientId)
    const objectiveId = await asAdmin(t).mutation(
      api.clientObjectives.create,
      {
        clerkOrgId: CLERK_ORG_ID,
        clientId,
        title: 'Objective A',
        source: 'ipp',
      },
    )

    const noteId = await asCoordinator(t).mutation(
      api.shifts.updateProgressNote,
      { clerkOrgId: CLERK_ORG_ID, shiftId, objectiveId },
    )

    const note = await t.run(async (ctx) => ctx.db.get(noteId))
    expect(note?.objectiveId).toBe(objectiveId)
  })

  it('rejects an objective belonging to a different client', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const shiftId = await seedInProgressShift(t, tenantId, clientId)
    const otherClientId = await t.run(async (ctx) =>
      ctx.db.insert('clients', {
        tenantId,
        displayName: 'Other Client',
        serviceType: 'SLS',
        authorizationHours: 10,
        riskFlags: [],
      }),
    )
    const objectiveId = await asAdmin(t).mutation(
      api.clientObjectives.create,
      {
        clerkOrgId: CLERK_ORG_ID,
        clientId: otherClientId,
        title: 'Other Objective',
        source: 'isp',
      },
    )

    await expect(
      asCoordinator(t).mutation(api.shifts.updateProgressNote, {
        clerkOrgId: CLERK_ORG_ID,
        shiftId,
        objectiveId,
      }),
    ).rejects.toThrow('different client')
  })

  it('rejects an objective from another tenant', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const shiftId = await seedInProgressShift(t, tenantId, clientId)
    const foreignObjectiveId = await t.run(async (ctx) => {
      const otherTenantId = await ctx.db.insert('tenants', {
        clerkOrgId: 'org_other',
        name: 'Other',
        slug: 'other',
        createdAt: new Date().toISOString(),
      })
      const otherClientId = await ctx.db.insert('clients', {
        tenantId: otherTenantId,
        displayName: 'Other Client',
        serviceType: 'SLS',
        authorizationHours: 10,
        riskFlags: [],
      })
      return ctx.db.insert('clientObjectives', {
        tenantId: otherTenantId,
        clientId: otherClientId,
        title: 'Foreign Objective',
        source: 'ipp',
        status: 'active',
        createdAt: new Date().toISOString(),
      })
    })

    await expect(
      asCoordinator(t).mutation(api.shifts.updateProgressNote, {
        clerkOrgId: CLERK_ORG_ID,
        shiftId,
        objectiveId: foreignObjectiveId,
      }),
    ).rejects.toThrow('cross-tenant')
  })
})

describe('clientObjectives.discontinue', () => {
  it('marks the objective discontinued, audits once, and is idempotent', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const objectiveId = await asAdmin(t).mutation(api.clientObjectives.create, {
      clerkOrgId: CLERK_ORG_ID,
      clientId,
      title: 'Objective A',
      source: 'ipp',
    })

    await asCoordinator(t).mutation(api.clientObjectives.discontinue, {
      clerkOrgId: CLERK_ORG_ID,
      objectiveId,
    })
    await asCoordinator(t).mutation(api.clientObjectives.discontinue, {
      clerkOrgId: CLERK_ORG_ID,
      objectiveId,
    })

    const objective = await t.run(async (ctx) => ctx.db.get(objectiveId))
    expect(objective?.status).toBe('discontinued')

    const events = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    const statusEvents = events.filter(
      (e) => e.action === 'objective_status_changed',
    )
    expect(statusEvents).toHaveLength(1)
    expect(statusEvents[0].nextStatus).toBe('discontinued')
  })

  it('rejects caregivers', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)
    const objectiveId = await asAdmin(t).mutation(api.clientObjectives.create, {
      clerkOrgId: CLERK_ORG_ID,
      clientId,
      title: 'Objective A',
      source: 'ipp',
    })

    await expect(
      asCaregiver(t).mutation(api.clientObjectives.discontinue, {
        clerkOrgId: CLERK_ORG_ID,
        objectiveId,
      }),
    ).rejects.toThrow('org:admin')
  })
})
