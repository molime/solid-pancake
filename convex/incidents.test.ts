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

const HOUR_MS = 60 * 60 * 1000

const CLERK_ORG_ID = 'org_incidents_test'
const OTHER_ORG_ID = 'org_incidents_other'
const ADMIN_ID = 'user_admin_incidents'
const COORDINATOR_ID = 'user_coordinator_incidents'
const HR_ID = 'user_hr_incidents'
const CAREGIVER_ID = 'user_caregiver_incidents'
const CANDIDATE_ID = 'user_candidate_incidents'

async function seedTenant(t: TestConvex, clerkOrgId = CLERK_ORG_ID) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId,
      name: 'Incident Agency',
      slug: 'incident-agency',
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
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: CANDIDATE_ID,
      role: 'org:candidate',
      displayName: 'Candidate',
      email: 'candidate@example.com',
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

function asAdmin(t: TestConvex, clerkOrgId = CLERK_ORG_ID) {
  return t.withIdentity({
    subject: ADMIN_ID,
    org_id: clerkOrgId,
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

function asCandidate(t: TestConvex) {
  return t.withIdentity({
    subject: CANDIDATE_ID,
    org_id: CLERK_ORG_ID,
    org_role: 'org:candidate',
  })
}

function baseIncidentArgs(clientId: Id<'clients'>) {
  return {
    clerkOrgId: CLERK_ORG_ID,
    clientId,
    category: 'medication_error' as const,
    occurredAt: new Date(Date.now() - 2 * HOUR_MS).toISOString(),
    learnedAt: new Date(Date.now() - HOUR_MS).toISOString(),
    location: 'Client home',
    description: 'Wrong dose administered.',
    actionsTaken: 'Poison control contacted; client monitored.',
    agenciesNotified: [] as (
      | 'aps'
      | 'cps'
      | 'ccl'
      | 'law_enforcement'
      | 'ombudsman'
      | 'dph'
      | 'other'
    )[],
  }
}

async function seedIncident(
  t: TestConvex,
  tenantId: Id<'tenants'>,
  clientId: Id<'clients'>,
  overrides: Record<string, unknown> = {},
) {
  return t.run(async (ctx) =>
    ctx.db.insert('specialIncidents', {
      tenantId,
      clientId,
      category: 'medication_error',
      occurredAt: new Date(Date.now() - 2 * HOUR_MS).toISOString(),
      learnedAt: new Date(Date.now() - HOUR_MS).toISOString(),
      location: 'Client home',
      description: 'Wrong dose administered.',
      actionsTaken: 'Poison control contacted; client monitored.',
      agenciesNotified: [],
      status: 'draft',
      createdBy: ADMIN_ID,
      createdAt: new Date().toISOString(),
      ...overrides,
    }),
  )
}

describe('incidents.createIncident', () => {
  it('lets a caregiver file an incident and audits it', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)

    const incidentId = await asCaregiver(t).mutation(
      api.incidents.createIncident,
      baseIncidentArgs(clientId),
    )

    const state = await t.run(async (ctx) => {
      const incident = await ctx.db.get(incidentId)
      const audits = await ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect()
      return { incident, audits }
    })

    expect(state.incident?.status).toBe('draft')
    expect(state.incident?.createdBy).toBe(CAREGIVER_ID)
    expect(state.incident?.tenantId).toBe(tenantId)
    expect(state.audits.some((a) => a.action === 'incident_created')).toBe(true)
  })

  it('rejects candidates and unauthenticated callers', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)

    await expect(
      asCandidate(t).mutation(
        api.incidents.createIncident,
        baseIncidentArgs(clientId),
      ),
    ).rejects.toThrow('Forbidden')
    await expect(
      t.mutation(api.incidents.createIncident, baseIncidentArgs(clientId)),
    ).rejects.toThrow('authentication required')
  })

  it('requires description, location and actions taken', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)

    await expect(
      asCoordinator(t).mutation(api.incidents.createIncident, {
        ...baseIncidentArgs(clientId),
        description: '   ',
      }),
    ).rejects.toThrow('Description is required')
    await expect(
      asCoordinator(t).mutation(api.incidents.createIncident, {
        ...baseIncidentArgs(clientId),
        location: '',
      }),
    ).rejects.toThrow('Location is required')
    await expect(
      asCoordinator(t).mutation(api.incidents.createIncident, {
        ...baseIncidentArgs(clientId),
        actionsTaken: '',
      }),
    ).rejects.toThrow('Actions taken is required')
  })

  it('rejects a client from another tenant', async () => {
    const t = createTestConvex()
    await seedTenant(t)
    const otherClientId = await t.run(async (ctx) => {
      const otherTenantId = await ctx.db.insert('tenants', {
        clerkOrgId: OTHER_ORG_ID,
        name: 'Other Agency',
        slug: 'other-agency',
        createdAt: new Date().toISOString(),
      })
      return ctx.db.insert('clients', {
        tenantId: otherTenantId,
        displayName: 'Other Client',
        serviceType: 'ILS',
        authorizationHours: 20,
        riskFlags: [],
      })
    })

    await expect(
      asAdmin(t).mutation(
        api.incidents.createIncident,
        baseIncidentArgs(otherClientId),
      ),
    ).rejects.toThrow('cross-tenant')
  })

  it('rejects learnedAt before occurredAt', async () => {
    const t = createTestConvex()
    const { clientId } = await seedTenant(t)

    await expect(
      asCoordinator(t).mutation(api.incidents.createIncident, {
        ...baseIncidentArgs(clientId),
        occurredAt: new Date(Date.now() - HOUR_MS).toISOString(),
        learnedAt: new Date(Date.now() - 2 * HOUR_MS).toISOString(),
      }),
    ).rejects.toThrow('learned must be on or after')
  })
})

describe('incident transitions', () => {
  it('marks the verbal report, advancing draft to verbal_reported with audit', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const incidentId = await seedIncident(t, tenantId, clientId)

    await asCoordinator(t).mutation(api.incidents.markVerbalReported, {
      clerkOrgId: CLERK_ORG_ID,
      incidentId,
    })

    const state = await t.run(async (ctx) => {
      const incident = await ctx.db.get(incidentId)
      const audits = await ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect()
      return { incident, audits }
    })

    expect(state.incident?.status).toBe('verbal_reported')
    expect(state.incident?.verbalReportedAt).toBeTruthy()
    const audit = state.audits.find(
      (a) => a.action === 'incident_verbal_reported',
    )
    expect(audit?.previousStatus).toBe('draft')
    expect(audit?.nextStatus).toBe('verbal_reported')
  })

  it('marks the written report and closes with audit events', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const incidentId = await seedIncident(t, tenantId, clientId)

    await asHr(t).mutation(api.incidents.markWrittenSubmitted, {
      clerkOrgId: CLERK_ORG_ID,
      incidentId,
    })
    await asAdmin(t).mutation(api.incidents.closeIncident, {
      clerkOrgId: CLERK_ORG_ID,
      incidentId,
    })

    const state = await t.run(async (ctx) => {
      const incident = await ctx.db.get(incidentId)
      const audits = await ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect()
      return { incident, audits }
    })

    expect(state.incident?.status).toBe('closed')
    expect(state.incident?.writtenSubmittedAt).toBeTruthy()
    expect(
      state.audits.some((a) => a.action === 'incident_written_submitted'),
    ).toBe(true)
    const closeAudit = state.audits.find((a) => a.action === 'incident_closed')
    expect(closeAudit?.previousStatus).toBe('written_submitted')
    expect(closeAudit?.nextStatus).toBe('closed')
  })

  it('rejects caregivers and double-reporting', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const incidentId = await seedIncident(t, tenantId, clientId)

    await expect(
      asCaregiver(t).mutation(api.incidents.markVerbalReported, {
        clerkOrgId: CLERK_ORG_ID,
        incidentId,
      }),
    ).rejects.toThrow('Forbidden')

    await asAdmin(t).mutation(api.incidents.markVerbalReported, {
      clerkOrgId: CLERK_ORG_ID,
      incidentId,
    })
    await expect(
      asAdmin(t).mutation(api.incidents.markVerbalReported, {
        clerkOrgId: CLERK_ORG_ID,
        incidentId,
      }),
    ).rejects.toThrow('already recorded')
  })

  it('blocks transitions and updates on a closed incident', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const incidentId = await seedIncident(t, tenantId, clientId, {
      status: 'closed',
    })

    await expect(
      asAdmin(t).mutation(api.incidents.markWrittenSubmitted, {
        clerkOrgId: CLERK_ORG_ID,
        incidentId,
      }),
    ).rejects.toThrow('closed')
    await expect(
      asAdmin(t).mutation(api.incidents.closeIncident, {
        clerkOrgId: CLERK_ORG_ID,
        incidentId,
      }),
    ).rejects.toThrow('already closed')
    await expect(
      asAdmin(t).mutation(api.incidents.addIncidentUpdate, {
        clerkOrgId: CLERK_ORG_ID,
        incidentId,
        note: 'Follow-up',
      }),
    ).rejects.toThrow('closed')
  })

  it('enforces tenant isolation on transitions', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const incidentId = await seedIncident(t, tenantId, clientId)
    await seedTenant(t, OTHER_ORG_ID)

    await expect(
      asAdmin(t, OTHER_ORG_ID).mutation(api.incidents.markVerbalReported, {
        clerkOrgId: OTHER_ORG_ID,
        incidentId,
      }),
    ).rejects.toThrow('cross-tenant')
  })
})

describe('incidents.addIncidentUpdate', () => {
  it('appends an update and audits it without touching the incident narrative', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const incidentId = await seedIncident(t, tenantId, clientId)

    await asAdmin(t).mutation(api.incidents.addIncidentUpdate, {
      clerkOrgId: CLERK_ORG_ID,
      incidentId,
      note: 'Regional center called back.',
    })

    const state = await t.run(async (ctx) => {
      const incident = await ctx.db.get(incidentId)
      const updates = await ctx.db
        .query('specialIncidentUpdates')
        .withIndex('by_tenant_incident', (q) =>
          q.eq('tenantId', tenantId).eq('incidentId', incidentId),
        )
        .collect()
      const audits = await ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect()
      return { incident, updates, audits }
    })

    expect(state.updates).toHaveLength(1)
    expect(state.updates[0]?.note).toBe('Regional center called back.')
    expect(state.updates[0]?.addedBy).toBe(ADMIN_ID)
    expect(state.incident?.description).toBe('Wrong dose administered.')
    expect(
      state.audits.some((a) => a.action === 'incident_update_added'),
    ).toBe(true)
  })

  it('requires a non-blank note', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const incidentId = await seedIncident(t, tenantId, clientId)

    await expect(
      asAdmin(t).mutation(api.incidents.addIncidentUpdate, {
        clerkOrgId: CLERK_ORG_ID,
        incidentId,
        note: '  ',
      }),
    ).rejects.toThrow('Update note is required')
  })
})

describe('incidents.listIncidents', () => {
  it('forbids caregivers from listing incidents', async () => {
    const t = createTestConvex()
    await seedTenant(t)

    await expect(
      asCaregiver(t).query(api.incidents.listIncidents, {
        clerkOrgId: CLERK_ORG_ID,
      }),
    ).rejects.toThrow('Forbidden')
  })

  it('computes SLA fields: breached past 24h/48h, on time inside them', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    // Learned 25h ago, nothing reported -> verbal breached, written pending.
    await seedIncident(t, tenantId, clientId, {
      learnedAt: new Date(Date.now() - 25 * HOUR_MS).toISOString(),
    })
    // Learned 1h ago, nothing reported -> both pending.
    await seedIncident(t, tenantId, clientId, {
      learnedAt: new Date(Date.now() - HOUR_MS).toISOString(),
    })
    // Learned 50h ago, verbal on time, written late -> written breached.
    await seedIncident(t, tenantId, clientId, {
      learnedAt: new Date(Date.now() - 50 * HOUR_MS).toISOString(),
      verbalReportedAt: new Date(Date.now() - 49 * HOUR_MS).toISOString(),
      writtenSubmittedAt: new Date(Date.now() - HOUR_MS).toISOString(),
      status: 'written_submitted',
    })

    const incidents = await asCoordinator(t).query(
      api.incidents.listIncidents,
      { clerkOrgId: CLERK_ORG_ID },
    )

    expect(incidents).toHaveLength(3)
    const overdue = incidents.find(
      (i) => !i.verbalReportedAt && !i.writtenSubmittedAt && i.learnedAt < new Date(Date.now() - 24 * HOUR_MS).toISOString(),
    )
    expect(overdue?.verbalBreached).toBe(true)
    expect(overdue?.writtenBreached).toBe(false)

    const recent = incidents.find(
      (i) => i.learnedAt > new Date(Date.now() - 2 * HOUR_MS).toISOString(),
    )
    expect(recent?.verbalBreached).toBe(false)
    expect(recent?.writtenBreached).toBe(false)
    expect(recent?.clientName).toBe('Client One')

    const lateWritten = incidents.find((i) => i.status === 'written_submitted')
    expect(lateWritten?.verbalBreached).toBe(false)
    expect(lateWritten?.writtenBreached).toBe(true)
  })

  it('filters by status and client', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const otherClientId = await t.run(async (ctx) =>
      ctx.db.insert('clients', {
        tenantId,
        displayName: 'Client Two',
        serviceType: 'ILS',
        authorizationHours: 10,
        riskFlags: [],
      }),
    )
    await seedIncident(t, tenantId, clientId, { status: 'draft' })
    await seedIncident(t, tenantId, otherClientId, { status: 'closed' })

    const drafts = await asAdmin(t).query(api.incidents.listIncidents, {
      clerkOrgId: CLERK_ORG_ID,
      status: 'draft',
    })
    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.clientName).toBe('Client One')

    const byClient = await asAdmin(t).query(api.incidents.listIncidents, {
      clerkOrgId: CLERK_ORG_ID,
      clientId: otherClientId,
    })
    expect(byClient).toHaveLength(1)
    expect(byClient[0]?.status).toBe('closed')
  })
})

describe('incidents.getIncident', () => {
  it('returns the incident with SLA fields and named updates', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const incidentId = await seedIncident(t, tenantId, clientId)
    await asHr(t).mutation(api.incidents.addIncidentUpdate, {
      clerkOrgId: CLERK_ORG_ID,
      incidentId,
      note: 'APS opened a case.',
    })

    const detail = await asAdmin(t).query(api.incidents.getIncident, {
      clerkOrgId: CLERK_ORG_ID,
      incidentId,
    })

    expect(detail.clientName).toBe('Client One')
    expect(detail.verbalDueAt).toBeTruthy()
    expect(detail.updates).toHaveLength(1)
    expect(detail.updates[0]?.addedByName).toBe('HR')
  })

  it('forbids caregivers', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const incidentId = await seedIncident(t, tenantId, clientId)

    await expect(
      asCaregiver(t).query(api.incidents.getIncident, {
        clerkOrgId: CLERK_ORG_ID,
        incidentId,
      }),
    ).rejects.toThrow('Forbidden')
  })
})

describe('incidents.getIncidentTimeliness', () => {
  it('counts on-time, breached and pending reports over the last 90 days', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    // Breached verbal (25h, unreported).
    await seedIncident(t, tenantId, clientId, {
      learnedAt: new Date(Date.now() - 25 * HOUR_MS).toISOString(),
    })
    // On-time verbal + written.
    await seedIncident(t, tenantId, clientId, {
      learnedAt: new Date(Date.now() - 72 * HOUR_MS).toISOString(),
      verbalReportedAt: new Date(Date.now() - 71 * HOUR_MS).toISOString(),
      writtenSubmittedAt: new Date(Date.now() - 70 * HOUR_MS).toISOString(),
      status: 'written_submitted',
    })
    // Outside the 90-day window — excluded.
    await seedIncident(t, tenantId, clientId, {
      createdAt: new Date(Date.now() - 100 * 24 * HOUR_MS).toISOString(),
    })

    const counts = await asAdmin(t).query(api.incidents.getIncidentTimeliness, {
      clerkOrgId: CLERK_ORG_ID,
    })

    expect(counts.total).toBe(2)
    expect(counts.verbalOnTime).toBe(1)
    expect(counts.verbalBreached).toBe(1)
    expect(counts.writtenOnTime).toBe(1)
    expect(counts.writtenPending).toBe(1)
  })
})

describe('incidents.exportIncidentsCsv', () => {
  it('applies the management role guard and escapes cells', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    await seedIncident(t, tenantId, clientId, {
      location: '=MAIN office',
      description: 'Fell, bruised "left" arm',
    })

    await expect(
      asCaregiver(t).query(api.incidents.exportIncidentsCsv, {
        clerkOrgId: CLERK_ORG_ID,
      }),
    ).rejects.toThrow('Forbidden')

    const csv = await asAdmin(t).query(api.incidents.exportIncidentsCsv, {
      clerkOrgId: CLERK_ORG_ID,
    })

    expect(csv).toContain('ATRIA-X Special Incident Report Log')
    expect(csv).toContain('"Client One"')
    expect(csv).toContain('"Fell, bruised ""left"" arm"')
    expect(csv).toContain('"\'=MAIN office"')
    expect(csv).not.toContain('"=MAIN office"')
  })

  it('filters by occurredAt date range', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    await seedIncident(t, tenantId, clientId, {
      occurredAt: '2026-01-10T08:00:00.000Z',
    })
    await seedIncident(t, tenantId, clientId, {
      occurredAt: '2026-03-10T08:00:00.000Z',
    })

    const csv = await asAdmin(t).query(api.incidents.exportIncidentsCsv, {
      clerkOrgId: CLERK_ORG_ID,
      startDate: '2026-02-01T00:00:00.000Z',
    })

    expect(csv).toContain('2026-03-10')
    expect(csv).not.toContain('2026-01-10')
  })
})

describe('incidents.checkOverdueIncidents cron', () => {
  it('creates one deduplicated HR case per overdue incident and notifies admin/hr', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    const overdueId = await seedIncident(t, tenantId, clientId, {
      learnedAt: new Date(Date.now() - 49 * HOUR_MS).toISOString(),
    })
    // On-time incident — nothing due yet.
    await seedIncident(t, tenantId, clientId, {
      learnedAt: new Date(Date.now() - HOUR_MS).toISOString(),
    })

    await t.mutation(internal.incidents.checkOverdueIncidents, {})
    // Second run must not duplicate the case or the notifications.
    await t.mutation(internal.incidents.checkOverdueIncidents, {})

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

    expect(state.cases).toHaveLength(1)
    const hrCase = state.cases[0]
    expect(hrCase?.flagType).toBe('sir_overdue')
    expect(hrCase?.subjectType).toBe('incident')
    expect(hrCase?.subjectId).toBe(overdueId)
    expect(hrCase?.category).toBe('compliance')

    // admin + hr only (not coordinator, caregiver or candidate), once each.
    expect(state.notifications).toHaveLength(2)
    const recipients = state.notifications
      .map((n) => n.clerkUserId)
      .sort()
    expect(recipients).toEqual([ADMIN_ID, HR_ID].sort())
    expect(state.notifications.every((n) => n.type === 'sir_overdue')).toBe(
      true,
    )
  })

  it('ignores incidents whose reports were filed on time', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    await seedIncident(t, tenantId, clientId, {
      learnedAt: new Date(Date.now() - 72 * HOUR_MS).toISOString(),
      verbalReportedAt: new Date(Date.now() - 71 * HOUR_MS).toISOString(),
      writtenSubmittedAt: new Date(Date.now() - 70 * HOUR_MS).toISOString(),
      status: 'written_submitted',
    })

    const result = await t.mutation(internal.incidents.checkOverdueIncidents, {})
    expect(result.created).toBe(0)

    const cases = await t.run(async (ctx) =>
      ctx.db
        .query('hrCases')
        .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(cases).toHaveLength(0)
  })

  it('flags an incident missing only the written report', async () => {
    const t = createTestConvex()
    const { tenantId, clientId } = await seedTenant(t)
    await seedIncident(t, tenantId, clientId, {
      learnedAt: new Date(Date.now() - 50 * HOUR_MS).toISOString(),
      verbalReportedAt: new Date(Date.now() - 49 * HOUR_MS).toISOString(),
      status: 'verbal_reported',
    })

    const result = await t.mutation(internal.incidents.checkOverdueIncidents, {})
    expect(result.created).toBe(1)

    const cases = await t.run(async (ctx) =>
      ctx.db
        .query('hrCases')
        .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(cases[0]?.description).toContain('48h written report')
  })
})
