import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

function asHR(
  t: ReturnType<typeof createTestConvex>,
  hrId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: hrId,
    org_id: clerkOrgId,
    org_role: 'org:hr',
  })
}

function asCaregiver(
  t: ReturnType<typeof createTestConvex>,
  caregiverId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: caregiverId,
    org_id: clerkOrgId,
    org_role: 'org:caregiver',
  })
}

async function seedTenant(
  t: ReturnType<typeof createTestConvex>,
  clerkOrgId: string,
  adminId: string,
) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId,
      name: 'Test Agency',
      slug: 'test-agency',
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: adminId,
      role: 'org:admin',
      displayName: 'Admin',
      email: 'admin@example.com',
    })
    return tenantId
  })
}

async function seedHR(
  t: ReturnType<typeof createTestConvex>,
  clerkOrgId: string,
  hrId: string,
) {
  return t.run(async (ctx) => {
    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
      .unique()
    if (!tenant) throw new Error('Tenant not found.')
    await ctx.db.insert('tenantMembers', {
      tenantId: tenant._id,
      clerkUserId: hrId,
      role: 'org:hr',
      displayName: 'HR Person',
      email: 'hr@example.com',
    })
  })
}

beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('createHrCase', () => {
  it('creates a case with correct fields for org:hr', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_create_case'
    const adminId = 'user_admin_case'
    const hrId = 'user_hr_case'

    await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)

    const caseId = await asHR(t, hrId, clerkOrgId).mutation(
      api.hrCases.createHrCase,
      {
        clerkOrgId,
        subjectType: 'employee',
        subjectId: 'user_employee_1',
        category: 'discrepancy',
        title: 'Missing timesheet',
        description: 'Timesheet for last week is missing.',
      },
    )

    const hrCase = await t.run(async (ctx) => ctx.db.get(caseId as Id<'hrCases'>))
    expect(hrCase?.status).toBe('open')
    expect(hrCase?.subjectType).toBe('employee')
    expect(hrCase?.category).toBe('discrepancy')
    expect(hrCase?.description).toBe('Timesheet for last week is missing.')
  })

  it('blocks org:caregiver callers', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_case_block'
    const adminId = 'user_admin_case_block'
    const caregiverId = 'user_cg_case_block'

    await seedTenant(t, clerkOrgId, adminId)
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: caregiverId,
        role: 'org:caregiver',
        displayName: 'Caregiver',
        email: 'cg@example.com',
      })
    })

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).mutation(api.hrCases.createHrCase, {
        clerkOrgId,
        subjectType: 'employee',
        subjectId: 'user_employee_1',
        category: 'dispute',
        title: 'Dispute',
      }),
    ).rejects.toThrow()
  })
})

describe('listHrCases', () => {
  it('returns tenant-isolated cases with resolved names', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_cases'
    const adminId = 'user_admin_list_cases'
    const hrId = 'user_hr_list_cases'

    await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)

    let tenantId: Id<'tenants'>
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      tenantId = tenant._id
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: 'user_employee_1',
        displayName: 'Employee One',
        email: 'employee@example.com',
        adpSyncStatus: 'pending_credentials',
        createdAt: new Date().toISOString(),
      })
    })

    const hrMember = await t.run(async (ctx) => {
      return ctx.db
        .query('tenantMembers')
        .withIndex('by_tenant_user', (q) =>
          q.eq('tenantId', tenantId!).eq('clerkUserId', hrId),
        )
        .unique()
    })

    await asHR(t, hrId, clerkOrgId).mutation(api.hrCases.createHrCase, {
      clerkOrgId,
      subjectType: 'employee',
      subjectId: 'user_employee_1',
      category: 'discrepancy',
      title: 'Test case',
    })

    const cases = await asHR(t, hrId, clerkOrgId).query(api.hrCases.listHrCases, {
      clerkOrgId,
    })

    expect(cases).toHaveLength(1)
    expect(cases[0]?.subjectName).toBe('Employee One')
    expect(cases[0]?.ownerName).toBe('HR Person')
    expect(cases[0]?.ownerMemberId).toBe(hrMember?._id)
  })
})

describe('updateHrCase', () => {
  it('allows org:hr to resolve a case', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_update_case'
    const adminId = 'user_admin_update_case'
    const hrId = 'user_hr_update_case'

    await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)

    const caseId = await asHR(t, hrId, clerkOrgId).mutation(
      api.hrCases.createHrCase,
      {
        clerkOrgId,
        subjectType: 'employee',
        subjectId: 'user_employee_1',
        category: 'dispute',
        title: 'Dispute',
      },
    )

    await asHR(t, hrId, clerkOrgId).mutation(api.hrCases.updateHrCase, {
      clerkOrgId,
      caseId: caseId as Id<'hrCases'>,
      status: 'resolved',
    })

    const hrCase = await t.run(async (ctx) =>
      ctx.db.get(caseId as Id<'hrCases'>),
    )
    expect(hrCase?.status).toBe('resolved')
    expect(hrCase?.resolvedAt).toBeDefined()
  })

  it('rejects invalid status strings', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_invalid_status'
    const adminId = 'user_admin_invalid_status'
    const hrId = 'user_hr_invalid_status'

    await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)

    const caseId = await asHR(t, hrId, clerkOrgId).mutation(
      api.hrCases.createHrCase,
      {
        clerkOrgId,
        subjectType: 'employee',
        subjectId: 'user_employee_1',
        category: 'dispute',
        title: 'Dispute',
      },
    )

    await expect(
      asHR(t, hrId, clerkOrgId).mutation(api.hrCases.updateHrCase, {
        clerkOrgId,
        caseId: caseId as Id<'hrCases'>,
        status: 'bogus',
      }),
    ).rejects.toThrow()
  })
})
