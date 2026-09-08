import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { STANDARD_CA_OBLIGATIONS, addMonths } from './agencyObligations'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

type TestConvex = ReturnType<typeof createTestConvex>

const CLERK_ORG_ID = 'org_obligations_test'
const ADMIN_ID = 'user_admin_obligations'
const HR_ID = 'user_hr_obligations'
const COORDINATOR_ID = 'user_coordinator_obligations'

async function seedTenant(t: TestConvex) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: CLERK_ORG_ID,
      name: 'Obligations Agency',
      slug: 'obligations-agency',
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

async function listObligationDocs(t: TestConvex, tenantId: Id<'tenants'>) {
  return t.run(async (ctx) =>
    ctx.db
      .query('agencyObligations')
      .withIndex('by_tenant_due', (q) => q.eq('tenantId', tenantId))
      .collect(),
  )
}

async function seedEvidenceItem(t: TestConvex, tenantId: Id<'tenants'>) {
  return t.run(async (ctx) => {
    const fileId = await ctx.db.insert('files', {
      tenantId,
      storageId: 'storage_evidence',
      uploadedBy: ADMIN_ID,
      fileName: 'coi.pdf',
      contentType: 'application/pdf',
      linkedType: 'complianceDoc',
      linkedId: 'link_evidence',
      visibility: 'admins_coordinators',
      createdAt: new Date().toISOString(),
    })
    return ctx.db.insert('documentArchiveItems', {
      tenantId,
      fileId,
      subjectType: 'agency',
      subjectId: tenantId as string,
      category: 'insurance_general_liability',
      status: 'verified',
      createdAt: new Date().toISOString(),
    })
  })
}

describe('addMonths', () => {
  it('adds calendar months and clamps to end-of-month', () => {
    expect(addMonths('2026-01-15T00:00:00.000Z', 12)).toBe(
      '2027-01-15T00:00:00.000Z',
    )
    expect(addMonths('2026-01-31T10:00:00.000Z', 1)).toBe(
      '2026-02-28T10:00:00.000Z',
    )
  })
})

describe('agencyObligations.seedObligations', () => {
  it('creates the full standard set with due dates one cadence out', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t)

    const result = await asAdmin(t).mutation(
      api.agencyObligations.seedObligations,
      { clerkOrgId: CLERK_ORG_ID },
    )

    expect(result.status).toBe('seeded')
    expect(result.counts.created).toBe(STANDARD_CA_OBLIGATIONS.length)

    const obligations = await listObligationDocs(t, tenantId)
    expect(obligations).toHaveLength(STANDARD_CA_OBLIGATIONS.length)
    const now = Date.now()
    for (const template of STANDARD_CA_OBLIGATIONS) {
      const match = obligations.find((o) => o.key === template.key)
      expect(match, template.key).toBeDefined()
      expect(match?.label).toBe(template.label)
      expect(match?.cadenceMonths).toBe(template.cadenceMonths)
      // Roughly now + cadenceMonths (within a minute of drift).
      const expected =
        new Date(addMonths(new Date(now).toISOString(), template.cadenceMonths)).getTime()
      expect(Math.abs(new Date(match!.dueAt).getTime() - expected)).toBeLessThan(
        60_000,
      )
    }

    const audits = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(audits.some((a) => a.action === 'agency_obligations_seeded')).toBe(
      true,
    )
  })

  it('is idempotent — re-seeding skips every existing key', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t)

    await asAdmin(t).mutation(api.agencyObligations.seedObligations, {
      clerkOrgId: CLERK_ORG_ID,
    })
    const second = await asAdmin(t).mutation(
      api.agencyObligations.seedObligations,
      { clerkOrgId: CLERK_ORG_ID },
    )

    expect(second.status).toBe('already-seeded')
    expect(second.counts.created).toBe(0)
    expect(second.counts.skipped).toBe(STANDARD_CA_OBLIGATIONS.length)
    expect(await listObligationDocs(t, tenantId)).toHaveLength(
      STANDARD_CA_OBLIGATIONS.length,
    )
  })

  it('rejects non-admin roles', async () => {
    const t = createTestConvex()
    await seedTenant(t)

    await expect(
      asHr(t).mutation(api.agencyObligations.seedObligations, {
        clerkOrgId: CLERK_ORG_ID,
      }),
    ).rejects.toThrow('org:admin')
  })
})

describe('agencyObligations.listObligations', () => {
  it('returns obligations ordered by due date for read roles', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t)
    await asAdmin(t).mutation(api.agencyObligations.seedObligations, {
      clerkOrgId: CLERK_ORG_ID,
    })

    const obligations = await asCoordinator(t).query(
      api.agencyObligations.listObligations,
      { clerkOrgId: CLERK_ORG_ID },
    )

    expect(obligations).toHaveLength(STANDARD_CA_OBLIGATIONS.length)
    const dues = obligations.map((o) => o.dueAt)
    expect([...dues].sort()).toEqual(dues)
    expect(obligations.every((o) => o.tenantId === tenantId)).toBe(true)
  })
})

describe('agencyObligations.completeObligation', () => {
  it('stamps completedAt, rolls dueAt forward by the cadence, links evidence, and audits', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t)
    await asAdmin(t).mutation(api.agencyObligations.seedObligations, {
      clerkOrgId: CLERK_ORG_ID,
    })
    const evidenceItemId = await seedEvidenceItem(t, tenantId)

    const before = await listObligationDocs(t, tenantId)
    const target = before.find((o) => o.key === 'insurance_general_liability')!

    await asAdmin(t).mutation(api.agencyObligations.completeObligation, {
      clerkOrgId: CLERK_ORG_ID,
      obligationId: target._id,
      evidenceItemId,
      notes: 'Renewed with broker.',
    })

    const after = await t.run(async (ctx) => ctx.db.get(target._id))
    expect(after?.completedAt).toBeTruthy()
    expect(after?.evidenceItemId).toBe(evidenceItemId)
    expect(after?.notes).toBe('Renewed with broker.')

    const completedMs = new Date(after!.completedAt!).getTime()
    const expectedDue = new Date(
      addMonths(after!.completedAt!, target.cadenceMonths),
    ).getTime()
    expect(new Date(after!.dueAt).getTime()).toBe(expectedDue)
    expect(new Date(after!.dueAt).getTime()).toBeGreaterThan(completedMs)

    const audits = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(
      audits.some((a) => a.action === 'agency_obligation_completed'),
    ).toBe(true)
  })

  it('rolls an overdue obligation to a future due date', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t)
    await asAdmin(t).mutation(api.agencyObligations.seedObligations, {
      clerkOrgId: CLERK_ORG_ID,
    })
    const target = (await listObligationDocs(t, tenantId)).find(
      (o) => o.key === 'ds1891_disclosure',
    )!
    await asAdmin(t).mutation(api.agencyObligations.updateDueDate, {
      clerkOrgId: CLERK_ORG_ID,
      obligationId: target._id,
      dueAt: '2020-01-01T00:00:00.000Z',
    })

    await asHr(t).mutation(api.agencyObligations.completeObligation, {
      clerkOrgId: CLERK_ORG_ID,
      obligationId: target._id,
    })

    const after = await t.run(async (ctx) => ctx.db.get(target._id))
    expect(new Date(after!.dueAt).getTime()).toBeGreaterThan(Date.now())
  })

  it('rejects evidence from another tenant', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t)
    await asAdmin(t).mutation(api.agencyObligations.seedObligations, {
      clerkOrgId: CLERK_ORG_ID,
    })
    const target = (await listObligationDocs(t, tenantId))[0]!

    const otherTenantItem = await t.run(async (ctx) => {
      const otherTenantId = await ctx.db.insert('tenants', {
        clerkOrgId: 'org_other',
        name: 'Other',
        slug: 'other',
        createdAt: new Date().toISOString(),
      })
      const fileId = await ctx.db.insert('files', {
        tenantId: otherTenantId,
        storageId: 'storage_other',
        uploadedBy: 'someone',
        fileName: 'other.pdf',
        linkedType: 'complianceDoc',
        linkedId: 'link_other',
        visibility: 'admins_coordinators',
        createdAt: new Date().toISOString(),
      })
      return ctx.db.insert('documentArchiveItems', {
        tenantId: otherTenantId,
        fileId,
        subjectType: 'agency',
        subjectId: otherTenantId as string,
        category: 'insurance_general_liability',
        status: 'verified',
        createdAt: new Date().toISOString(),
      })
    })

    await expect(
      asAdmin(t).mutation(api.agencyObligations.completeObligation, {
        clerkOrgId: CLERK_ORG_ID,
        obligationId: target._id,
        evidenceItemId: otherTenantItem,
      }),
    ).rejects.toThrow('cross-tenant')
  })

  it('rejects coordinators', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t)
    await asAdmin(t).mutation(api.agencyObligations.seedObligations, {
      clerkOrgId: CLERK_ORG_ID,
    })
    const target = (await listObligationDocs(t, tenantId))[0]!

    await expect(
      asCoordinator(t).mutation(api.agencyObligations.completeObligation, {
        clerkOrgId: CLERK_ORG_ID,
        obligationId: target._id,
      }),
    ).rejects.toThrow('org:admin')
  })
})

describe('agencyObligations.updateDueDate', () => {
  it('updates the due date and audits the change', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t)
    await asAdmin(t).mutation(api.agencyObligations.seedObligations, {
      clerkOrgId: CLERK_ORG_ID,
    })
    const target = (await listObligationDocs(t, tenantId))[0]!

    await asAdmin(t).mutation(api.agencyObligations.updateDueDate, {
      clerkOrgId: CLERK_ORG_ID,
      obligationId: target._id,
      dueAt: '2027-06-01T00:00:00.000Z',
    })

    const after = await t.run(async (ctx) => ctx.db.get(target._id))
    expect(after?.dueAt).toBe('2027-06-01T00:00:00.000Z')

    const audits = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(
      audits.some((a) => a.action === 'agency_obligation_due_date_updated'),
    ).toBe(true)
  })

  it('rejects invalid dates', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t)
    await asAdmin(t).mutation(api.agencyObligations.seedObligations, {
      clerkOrgId: CLERK_ORG_ID,
    })
    const target = (await listObligationDocs(t, tenantId))[0]!

    await expect(
      asAdmin(t).mutation(api.agencyObligations.updateDueDate, {
        clerkOrgId: CLERK_ORG_ID,
        obligationId: target._id,
        dueAt: 'not-a-date',
      }),
    ).rejects.toThrow('valid date')
  })
})

describe('obligation_due auto-flagging (hrCases.checkAndFlagIssues)', () => {
  const DAY_MS = 24 * 60 * 60 * 1000

  async function seedObligationWithDue(
    t: TestConvex,
    tenantId: Id<'tenants'>,
    dueAt: string,
  ) {
    return t.run(async (ctx) =>
      ctx.db.insert('agencyObligations', {
        tenantId,
        key: 'insurance_general_liability',
        label: 'General liability insurance certificate',
        cadenceMonths: 12,
        dueAt,
        createdAt: new Date().toISOString(),
      }),
    )
  }

  async function listCases(t: TestConvex, tenantId: Id<'tenants'>) {
    return t.run(async (ctx) =>
      ctx.db
        .query('hrCases')
        .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
  }

  it('opens a case and notifies admins for obligations due within 30 days or overdue', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t)
    await seedObligationWithDue(
      t,
      tenantId,
      new Date(Date.now() + 10 * DAY_MS).toISOString(),
    )
    await t.run(async (ctx) =>
      ctx.db.insert('agencyObligations', {
        tenantId,
        key: 'cpa_audit_or_review',
        label: 'Independent CPA audit or review (WIC §4652.5)',
        cadenceMonths: 12,
        dueAt: new Date(Date.now() - 5 * DAY_MS).toISOString(),
        createdAt: new Date().toISOString(),
      }),
    )
    // Far-future obligation: no flag.
    await t.run(async (ctx) =>
      ctx.db.insert('agencyObligations', {
        tenantId,
        key: 'whistleblower_policy',
        label: 'Whistleblower-protection policy acknowledgement',
        cadenceMonths: 12,
        dueAt: new Date(Date.now() + 200 * DAY_MS).toISOString(),
        createdAt: new Date().toISOString(),
      }),
    )

    await t.mutation(internal.hrCases.checkAndFlagIssues, {})

    const cases = await listCases(t, tenantId)
    expect(cases).toHaveLength(2)
    expect(cases.every((c) => c.flagType === 'obligation_due')).toBe(true)
    expect(cases.every((c) => c.subjectType === 'agency')).toBe(true)
    expect(cases.every((c) => c.category === 'compliance')).toBe(true)
    expect(cases.some((c) => c.title.includes('overdue'))).toBe(true)
    expect(cases.some((c) => c.title.includes('due soon'))).toBe(true)

    const notifications = await t.run(async (ctx) =>
      ctx.db
        .query('notifications')
        .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    // One notification per flagged obligation to the single org:admin member.
    expect(notifications).toHaveLength(2)
    expect(
      notifications.every(
        (n) => n.type === 'obligation_due' && n.clerkUserId === ADMIN_ID,
      ),
    ).toBe(true)
  })

  it('deduplicates across runs while a case is still open', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t)
    await seedObligationWithDue(
      t,
      tenantId,
      new Date(Date.now() - 2 * DAY_MS).toISOString(),
    )

    await t.mutation(internal.hrCases.checkAndFlagIssues, {})
    await t.mutation(internal.hrCases.checkAndFlagIssues, {})

    const cases = await listCases(t, tenantId)
    expect(cases).toHaveLength(1)
  })
})
