import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { CAP_DEFAULT_DUE_DAYS } from './correctiveActions'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

type TestConvex = ReturnType<typeof createTestConvex>

const CLERK_ORG_ID = 'org_cap_test'
const ADMIN_ID = 'user_admin_cap'
const HR_ID = 'user_hr_cap'
const COORDINATOR_ID = 'user_coordinator_cap'

const DAY_MS = 24 * 60 * 60 * 1000

async function seedTenant(t: TestConvex) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: CLERK_ORG_ID,
      name: 'CAP Agency',
      slug: 'cap-agency',
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

    return { tenantId }
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

async function seedCap(
  t: TestConvex,
  tenantId: Id<'tenants'>,
  overrides: Record<string, unknown> = {},
) {
  return t.run(async (ctx) =>
    ctx.db.insert('correctiveActions', {
      tenantId,
      source: 'regional_center',
      finding: 'SIR submitted late in Q2 sample.',
      dueAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
      status: 'open',
      createdAt: new Date().toISOString(),
      ...overrides,
    } as never),
  )
}

async function seedEvidenceItem(t: TestConvex, tenantId: Id<'tenants'>) {
  return t.run(async (ctx) => {
    const fileId = await ctx.db.insert('files', {
      tenantId,
      storageId: 'storage_evidence',
      uploadedBy: ADMIN_ID,
      fileName: 'cap-response.pdf',
      linkedType: 'complianceDoc',
      linkedId: 'cap_evidence',
      visibility: 'admins_coordinators',
      createdAt: new Date().toISOString(),
    })
    return ctx.db.insert('documentArchiveItems', {
      tenantId,
      fileId,
      subjectType: 'agency',
      subjectId: tenantId as string,
      category: 'cap_evidence',
      status: 'active',
      createdAt: new Date().toISOString(),
    })
  })
}

describe('correctiveActions.createCorrectiveAction', () => {
  it('defaults the due date to finding date + 30 days', async () => {
    const t = createTestConvex()
    await seedTenant(t)

    const before = Date.now()
    const capId = await asAdmin(t).mutation(
      api.correctiveActions.createCorrectiveAction,
      {
        clerkOrgId: CLERK_ORG_ID,
        source: 'dds',
        finding: 'Missing quarterly progress reports.',
      },
    )
    const after = Date.now()

    const list = await asAdmin(t).query(
      api.correctiveActions.listCorrectiveActions,
      { clerkOrgId: CLERK_ORG_ID },
    )
    expect(list).toHaveLength(1)
    expect(list[0]._id).toBe(capId)
    expect(list[0].status).toBe('open')
    expect(list[0].overdue).toBe(false)
    const dueMs = new Date(list[0].dueAt).getTime()
    expect(dueMs).toBeGreaterThanOrEqual(before + CAP_DEFAULT_DUE_DAYS * DAY_MS)
    expect(dueMs).toBeLessThanOrEqual(after + CAP_DEFAULT_DUE_DAYS * DAY_MS)

    const auditEvents = await t.run(async (ctx) =>
      ctx.db.query('auditEvents').collect(),
    )
    expect(
      auditEvents.some((e) => e.action === 'corrective_action_created'),
    ).toBe(true)
  })

  it('accepts an explicit due date and rejects blank findings', async () => {
    const t = createTestConvex()
    await seedTenant(t)

    await asAdmin(t).mutation(api.correctiveActions.createCorrectiveAction, {
      clerkOrgId: CLERK_ORG_ID,
      source: 'internal',
      finding: 'Internal review gap.',
      dueAt: '2026-09-15T00:00:00.000Z',
    })
    const list = await asAdmin(t).query(
      api.correctiveActions.listCorrectiveActions,
      { clerkOrgId: CLERK_ORG_ID },
    )
    expect(list[0].dueAt).toBe('2026-09-15T00:00:00.000Z')

    await expect(
      asAdmin(t).mutation(api.correctiveActions.createCorrectiveAction, {
        clerkOrgId: CLERK_ORG_ID,
        source: 'internal',
        finding: '  ',
      }),
    ).rejects.toThrow(/Finding is required/)
  })

  it('rejects coordinators', async () => {
    const t = createTestConvex()
    await seedTenant(t)
    await expect(
      asCoordinator(t).mutation(api.correctiveActions.createCorrectiveAction, {
        clerkOrgId: CLERK_ORG_ID,
        source: 'internal',
        finding: 'Nope.',
      }),
    ).rejects.toThrow()
    await expect(
      asCoordinator(t).query(api.correctiveActions.listCorrectiveActions, {
        clerkOrgId: CLERK_ORG_ID,
      }),
    ).rejects.toThrow()
  })
})

describe('correctiveActions submit → verify flow', () => {
  it('moves open → submitted → verified with evidence and audit events', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t)
    const capId = await seedCap(t, tenantId)
    const evidenceItemId = await seedEvidenceItem(t, tenantId)

    // Verify before submit is rejected.
    await expect(
      asAdmin(t).mutation(api.correctiveActions.verifyCorrectiveAction, {
        clerkOrgId: CLERK_ORG_ID,
        correctiveActionId: capId,
      }),
    ).rejects.toThrow(/Submit the corrective action/)

    await asAdmin(t).mutation(
      api.correctiveActions.submitCorrectiveActionEvidence,
      {
        clerkOrgId: CLERK_ORG_ID,
        correctiveActionId: capId,
        evidenceItemId,
      },
    )

    let list = await asAdmin(t).query(
      api.correctiveActions.listCorrectiveActions,
      { clerkOrgId: CLERK_ORG_ID },
    )
    expect(list[0].status).toBe('submitted')
    expect(list[0].evidenceItemId).toBe(evidenceItemId)
    expect(list[0].evidenceFileName).toBe('cap-response.pdf')

    // Double submission is rejected.
    await expect(
      asAdmin(t).mutation(api.correctiveActions.submitCorrectiveActionEvidence, {
        clerkOrgId: CLERK_ORG_ID,
        correctiveActionId: capId,
      }),
    ).rejects.toThrow(/already submitted/)

    await asHr(t).mutation(api.correctiveActions.verifyCorrectiveAction, {
      clerkOrgId: CLERK_ORG_ID,
      correctiveActionId: capId,
    })

    list = await asAdmin(t).query(api.correctiveActions.listCorrectiveActions, {
      clerkOrgId: CLERK_ORG_ID,
    })
    expect(list[0].status).toBe('verified')
    expect(list[0].verifiedBy).toBe(HR_ID)
    expect(list[0].verifiedAt).toBeDefined()

    const auditEvents = await t.run(async (ctx) =>
      ctx.db.query('auditEvents').collect(),
    )
    for (const action of [
      'corrective_action_submitted',
      'corrective_action_verified',
    ]) {
      expect(auditEvents.some((e) => e.action === action)).toBe(true)
    }
  })

  it('rejects evidence from another tenant', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t)
    const capId = await seedCap(t, tenantId)

    const otherItemId = await t.run(async (ctx) => {
      const otherTenantId = await ctx.db.insert('tenants', {
        clerkOrgId: 'org_cap_other',
        name: 'Other Agency',
        slug: 'other-agency',
        createdAt: new Date().toISOString(),
      })
      const fileId = await ctx.db.insert('files', {
        tenantId: otherTenantId,
        storageId: 'storage_other',
        uploadedBy: 'user_other',
        fileName: 'other.pdf',
        linkedType: 'complianceDoc',
        linkedId: 'other',
        visibility: 'admins_coordinators',
        createdAt: new Date().toISOString(),
      })
      return ctx.db.insert('documentArchiveItems', {
        tenantId: otherTenantId,
        fileId,
        subjectType: 'agency',
        subjectId: otherTenantId as string,
        category: 'cap_evidence',
        status: 'active',
        createdAt: new Date().toISOString(),
      })
    })

    await expect(
      asAdmin(t).mutation(api.correctiveActions.submitCorrectiveActionEvidence, {
        clerkOrgId: CLERK_ORG_ID,
        correctiveActionId: capId,
        evidenceItemId: otherItemId,
      }),
    ).rejects.toThrow()
  })
})

describe('correctiveActions overdue + cron', () => {
  it('computes overdue on open CAPs past due', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t)
    await seedCap(t, tenantId, {
      dueAt: new Date(Date.now() - DAY_MS).toISOString(),
    })
    // Submitted past due: not overdue (response is with the finding source).
    await seedCap(t, tenantId, {
      dueAt: new Date(Date.now() - DAY_MS).toISOString(),
      status: 'submitted',
    })

    const list = await asAdmin(t).query(
      api.correctiveActions.listCorrectiveActions,
      { clerkOrgId: CLERK_ORG_ID },
    )
    expect(list).toHaveLength(2)
    expect(list.filter((cap) => cap.overdue)).toHaveLength(1)
  })

  it('cron creates one deduplicated HR case per overdue CAP and notifies admin/hr', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t)

    const overdueId = await seedCap(t, tenantId, {
      dueAt: new Date(Date.now() - DAY_MS).toISOString(),
    })
    // Not yet due: no case.
    await seedCap(t, tenantId)
    // Submitted past due: no case.
    await seedCap(t, tenantId, {
      dueAt: new Date(Date.now() - DAY_MS).toISOString(),
      status: 'submitted',
    })

    await t.mutation(internal.correctiveActions.checkOverdueCaps, {})
    // Second run must not duplicate.
    await t.mutation(internal.correctiveActions.checkOverdueCaps, {})

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

    const flagCases = state.cases.filter((c) => c.flagType === 'cap_overdue')
    expect(flagCases).toHaveLength(1)
    expect(flagCases[0].subjectId).toBe(overdueId as string)
    expect(flagCases[0].subjectType).toBe('corrective_action')

    expect(state.notifications).toHaveLength(2)
    expect(state.notifications.every((n) => n.type === 'cap_overdue')).toBe(true)
  })
})
