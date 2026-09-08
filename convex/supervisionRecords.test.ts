import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

type TestConvex = ReturnType<typeof createTestConvex>

const CLERK_ORG_ID = 'org_supervision_test'
const ADMIN_ID = 'user_admin_supervision'
const HR_ID = 'user_hr_supervision'
const COORDINATOR_ID = 'user_coordinator_supervision'
const CAREGIVER_ID = 'user_caregiver_supervision'

async function seedTenant(t: TestConvex) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: CLERK_ORG_ID,
      name: 'Supervision Agency',
      slug: 'supervision-agency',
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

    const employeeProfileId = await ctx.db.insert('employeeProfiles', {
      tenantId,
      clerkUserId: CAREGIVER_ID,
      displayName: 'Caregiver',
      email: 'caregiver@example.com',
      adpSyncStatus: 'synced',
      createdAt: new Date().toISOString(),
    })

    return { tenantId, employeeProfileId }
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

describe('supervisionRecords', () => {
  it('adds and lists records newest-first with recorder names and audit events', async () => {
    const t = createTestConvex()
    const { tenantId, employeeProfileId } = await seedTenant(t)

    await asAdmin(t).mutation(api.supervisionRecords.addSupervisionRecord, {
      clerkOrgId: CLERK_ORG_ID,
      employeeProfileId,
      kind: 'supervision',
      occurredAt: '2026-07-15T10:00:00.000Z',
      summary: 'Monthly supervision: reviewed care plan documentation.',
    })
    await asHr(t).mutation(api.supervisionRecords.addSupervisionRecord, {
      clerkOrgId: CLERK_ORG_ID,
      employeeProfileId,
      kind: 'annual_evaluation',
      occurredAt: '2026-08-01T10:00:00.000Z',
      summary: 'Annual evaluation: meets expectations.',
    })

    const list = await asHr(t).query(
      api.supervisionRecords.listSupervisionRecords,
      { clerkOrgId: CLERK_ORG_ID, employeeProfileId },
    )
    expect(list).toHaveLength(2)
    expect(list[0].kind).toBe('annual_evaluation')
    expect(list[0].recordedBy).toBe(HR_ID)
    expect(list[0].recordedByName).toBe('HR')
    expect(list[1].kind).toBe('supervision')
    expect(list[1].recordedByName).toBe('Admin')

    const auditEvents = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    const added = auditEvents.filter(
      (e) => e.action === 'supervision_record_added',
    )
    expect(added).toHaveLength(2)
  })

  it('validates input', async () => {
    const t = createTestConvex()
    const { employeeProfileId } = await seedTenant(t)

    await expect(
      asAdmin(t).mutation(api.supervisionRecords.addSupervisionRecord, {
        clerkOrgId: CLERK_ORG_ID,
        employeeProfileId,
        kind: 'supervision',
        occurredAt: '2026-07-15T10:00:00.000Z',
        summary: '   ',
      }),
    ).rejects.toThrow(/Summary is required/)

    await expect(
      asAdmin(t).mutation(api.supervisionRecords.addSupervisionRecord, {
        clerkOrgId: CLERK_ORG_ID,
        employeeProfileId,
        kind: 'supervision',
        occurredAt: 'not-a-date',
        summary: 'Ok.',
      }),
    ).rejects.toThrow(/valid date/)
  })

  it('rejects coordinators and caregivers', async () => {
    const t = createTestConvex()
    const { employeeProfileId } = await seedTenant(t)

    await expect(
      asCoordinator(t).mutation(api.supervisionRecords.addSupervisionRecord, {
        clerkOrgId: CLERK_ORG_ID,
        employeeProfileId,
        kind: 'supervision',
        occurredAt: '2026-07-15T10:00:00.000Z',
        summary: 'Nope.',
      }),
    ).rejects.toThrow()
    await expect(
      asCoordinator(t).query(api.supervisionRecords.listSupervisionRecords, {
        clerkOrgId: CLERK_ORG_ID,
        employeeProfileId,
      }),
    ).rejects.toThrow()
  })
})
