import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api, internal } from './_generated/api'
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

  it('resolves agency obligation labels for obligation_due cases', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_agency_cases'
    const adminId = 'user_admin_agency_cases'
    const hrId = 'user_hr_agency_cases'

    const tenantId = await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)

    const obligationId = await t.run(async (ctx) =>
      ctx.db.insert('agencyObligations', {
        tenantId,
        key: 'ds1891_disclosure',
        label: 'DS 1891 applicant/vendor disclosure statement',
        cadenceMonths: 24,
        dueAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }),
    )

    await asHR(t, hrId, clerkOrgId).mutation(api.hrCases.createHrCase, {
      clerkOrgId,
      subjectType: 'agency',
      subjectId: obligationId,
      category: 'compliance',
      title: 'Agency obligation overdue: DS 1891',
    })

    const cases = await asHR(t, hrId, clerkOrgId).query(api.hrCases.listHrCases, {
      clerkOrgId,
    })

    expect(cases).toHaveLength(1)
    expect(cases[0]?.subjectName).toBe('DS 1891 applicant/vendor disclosure statement')
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

describe('case numbers', () => {
  it('generates sequential case numbers per tenant', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_case_numbers'
    const adminId = 'user_admin_case_numbers'
    const hrId = 'user_hr_case_numbers'

    await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)

    const year = new Date().getFullYear()

    const firstId = await asHR(t, hrId, clerkOrgId).mutation(
      api.hrCases.createHrCase,
      {
        clerkOrgId,
        subjectType: 'employee',
        subjectId: 'user_employee_1',
        category: 'discrepancy',
        title: 'First case',
      },
    )
    const secondId = await asHR(t, hrId, clerkOrgId).mutation(
      api.hrCases.createHrCase,
      {
        clerkOrgId,
        subjectType: 'employee',
        subjectId: 'user_employee_1',
        category: 'dispute',
        title: 'Second case',
      },
    )

    const first = await t.run(async (ctx) => ctx.db.get(firstId as Id<'hrCases'>))
    const second = await t.run(async (ctx) =>
      ctx.db.get(secondId as Id<'hrCases'>),
    )
    expect(first?.caseNumber).toBe(`HR-${year}-001`)
    expect(second?.caseNumber).toBe(`HR-${year}-002`)
  })
})

describe('getHrCase', () => {
  it('returns full case details with resolved names and case number', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_get_case'
    const adminId = 'user_admin_get_case'
    const hrId = 'user_hr_get_case'

    const tenantId = await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)

    await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: 'user_employee_1',
        displayName: 'Employee One',
        email: 'employee@example.com',
        adpSyncStatus: 'pending_credentials',
        createdAt: new Date().toISOString(),
      })
    })

    const caseId = await asHR(t, hrId, clerkOrgId).mutation(
      api.hrCases.createHrCase,
      {
        clerkOrgId,
        subjectType: 'employee',
        subjectId: 'user_employee_1',
        category: 'policy_violation',
        title: 'No-call no-show',
        description: 'Employee missed a shift without notice.',
      },
    )

    const hrCase = await asHR(t, hrId, clerkOrgId).query(api.hrCases.getHrCase, {
      clerkOrgId,
      caseId: caseId as Id<'hrCases'>,
    })

    const year = new Date().getFullYear()
    expect(hrCase.caseNumber).toBe(`HR-${year}-001`)
    expect(hrCase.title).toBe('No-call no-show')
    expect(hrCase.subjectName).toBe('Employee One')
    expect(hrCase.ownerName).toBe('HR Person')
    expect(hrCase.status).toBe('open')
    expect(hrCase.description).toBe('Employee missed a shift without notice.')
  })

  it('blocks org:caregiver callers', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_get_case_block'
    const adminId = 'user_admin_get_case_block'
    const hrId = 'user_hr_get_case_block'
    const caregiverId = 'user_cg_get_case_block'

    await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)
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
      asCaregiver(t, caregiverId, clerkOrgId).query(api.hrCases.getHrCase, {
        clerkOrgId,
        caseId: caseId as Id<'hrCases'>,
      }),
    ).rejects.toThrow()
  })

  it('throws when the case does not exist in the tenant', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_get_case_missing'
    const otherClerkOrgId = 'org_get_case_other'
    const adminId = 'user_admin_get_case_missing'
    const hrId = 'user_hr_get_case_missing'

    await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)
    await seedTenant(t, otherClerkOrgId, 'user_admin_other')

    const otherCaseId = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', otherClerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db.insert('hrCases', {
        tenantId: tenant._id,
        subjectType: 'employee',
        subjectId: 'user_employee_9',
        category: 'other',
        title: 'Other tenant case',
        status: 'open',
        createdAt: new Date().toISOString(),
      })
    })

    await expect(
      asHR(t, hrId, clerkOrgId).query(api.hrCases.getHrCase, {
        clerkOrgId,
        caseId: otherCaseId,
      }),
    ).rejects.toThrow()
  })
})

async function seedDocument(
  t: ReturnType<typeof createTestConvex>,
  tenantId: Id<'tenants'>,
  args: {
    subjectId: string
    category: string
    expiresAt?: string
    status?: string
    createdAt?: string
  },
) {
  return t.run(async (ctx) => {
    const fileId = await ctx.db.insert('files', {
      tenantId,
      storageId: `storage_${args.subjectId}_${args.category}`,
      uploadedBy: 'user_admin',
      fileName: `${args.category}.pdf`,
      linkedType: 'complianceDoc' as const,
      linkedId: args.subjectId,
      visibility: 'admins_coordinators' as const,
      createdAt: new Date().toISOString(),
    })
    return ctx.db.insert('documentArchiveItems', {
      tenantId,
      fileId,
      subjectType: 'employee',
      subjectId: args.subjectId,
      category: args.category,
      status: args.status ?? 'active',
      expiresAt: args.expiresAt,
      createdAt: args.createdAt ?? new Date().toISOString(),
    })
  })
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

describe('checkExpiringCredentials', () => {
  it('creates a case for a document expiring within 30 days', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_cron_expiring'
    const tenantId = await seedTenant(t, clerkOrgId, 'user_admin_cron_exp')

    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_1',
      category: 'CPR certificate',
      expiresAt: daysFromNow(10),
    })

    await t.mutation(internal.hrCases.checkExpiringCredentials, {})

    const cases = await t.run(async (ctx) =>
      ctx.db
        .query('hrCases')
        .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(cases).toHaveLength(1)
    expect(cases[0]?.category).toBe('credentialing')
    expect(cases[0]?.subjectType).toBe('employee')
    expect(cases[0]?.subjectId).toBe('user_employee_1')
    expect(cases[0]?.status).toBe('open')
    expect(cases[0]?.title).toContain('CPR certificate')
    expect(cases[0]?.title).toContain('expiring soon')
    expect(cases[0]?.caseNumber).toBe(`HR-${new Date().getFullYear()}-001`)
    expect(cases[0]?.description).toContain('will expire')
  })

  it('does not create duplicate cases when run twice', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_cron_dedup'
    const tenantId = await seedTenant(t, clerkOrgId, 'user_admin_cron_dedup')

    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_1',
      category: 'CPR certificate',
      expiresAt: daysFromNow(10),
    })

    await t.mutation(internal.hrCases.checkExpiringCredentials, {})
    await t.mutation(internal.hrCases.checkExpiringCredentials, {})

    const cases = await t.run(async (ctx) =>
      ctx.db
        .query('hrCases')
        .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(cases).toHaveLength(1)
  })

  it('skips documents without an expiry date', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_cron_no_expiry'
    const tenantId = await seedTenant(t, clerkOrgId, 'user_admin_cron_noexp')

    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_1',
      category: 'CPR certificate',
    })

    await t.mutation(internal.hrCases.checkExpiringCredentials, {})

    const cases = await t.run(async (ctx) =>
      ctx.db
        .query('hrCases')
        .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(cases).toHaveLength(0)
  })

  it('skips documents expiring beyond 30 days', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_cron_far_future'
    const tenantId = await seedTenant(t, clerkOrgId, 'user_admin_cron_far')

    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_1',
      category: 'Passport',
      expiresAt: daysFromNow(60),
    })

    await t.mutation(internal.hrCases.checkExpiringCredentials, {})

    const cases = await t.run(async (ctx) =>
      ctx.db
        .query('hrCases')
        .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(cases).toHaveLength(0)
  })

  it('creates a case for an already expired document', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_cron_expired'
    const tenantId = await seedTenant(t, clerkOrgId, 'user_admin_cron_expd')

    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_1',
      category: 'Passport',
      expiresAt: daysFromNow(-5),
    })

    await t.mutation(internal.hrCases.checkExpiringCredentials, {})

    const cases = await t.run(async (ctx) =>
      ctx.db
        .query('hrCases')
        .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(cases).toHaveLength(1)
    expect(cases[0]?.title).toContain('Passport')
    expect(cases[0]?.title).toContain('expired')
    expect(cases[0]?.description).toContain('expired on')
  })

  it('does not create a second case when both daily crons run', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_cron_both', 'user_admin_cron_both')

    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_1',
      category: 'CPR certificate',
      expiresAt: daysFromNow(10),
    })

    // checkExpiringCredentials first, then checkAndFlagIssues.
    await t.mutation(internal.hrCases.checkExpiringCredentials, {})
    await t.mutation(internal.hrCases.checkAndFlagIssues, {})

    const cases = await t.run(async (ctx) =>
      ctx.db
        .query('hrCases')
        .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(cases).toHaveLength(1)
    expect(cases[0]?.flagType).toBe('expiring_document')
  })

  it('does not create a second case when the crons run in reverse order', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(
      t,
      'org_cron_both_rev',
      'user_admin_cron_both_rev',
    )

    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_1',
      category: 'CPR certificate',
      expiresAt: daysFromNow(10),
    })

    // checkAndFlagIssues first, then checkExpiringCredentials.
    await t.mutation(internal.hrCases.checkAndFlagIssues, {})
    await t.mutation(internal.hrCases.checkExpiringCredentials, {})

    const cases = await t.run(async (ctx) =>
      ctx.db
        .query('hrCases')
        .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    expect(cases).toHaveLength(1)
    expect(cases[0]?.flagType).toBe('expiring_document')
  })
})

describe('hrDashboardStats expiringCredentials', () => {
  it('returns the real count of credentials expiring within 30 days', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_stats_expiring'
    const adminId = 'user_admin_stats_exp'
    const hrId = 'user_hr_stats_exp'

    const tenantId = await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)

    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_1',
      category: 'CPR certificate',
      expiresAt: daysFromNow(10),
    })
    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_2',
      category: 'Passport',
      expiresAt: daysFromNow(-5),
    })
    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_3',
      category: 'Car insurance',
      expiresAt: daysFromNow(60),
    })
    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_4',
      category: 'Training record',
    })

    const stats = await asHR(t, hrId, clerkOrgId).query(
      api.hrCases.hrDashboardStats,
      { clerkOrgId },
    )
    expect(stats.expiringCredentials).toBe(2)
  })
})

async function seedCandidate(
  t: ReturnType<typeof createTestConvex>,
  tenantId: Id<'tenants'>,
  args: { email: string; status: string; createdAt: string },
) {
  return t.run(async (ctx) =>
    ctx.db.insert('candidates', {
      tenantId,
      email: args.email,
      displayName: 'Test Candidate',
      status: args.status,
      createdAt: args.createdAt,
    }),
  )
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

async function listCases(
  t: ReturnType<typeof createTestConvex>,
  tenantId: Id<'tenants'>,
) {
  return t.run(async (ctx) =>
    ctx.db
      .query('hrCases')
      .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
      .collect(),
  )
}

describe('checkAndFlagIssues', () => {
  it('creates cases for expiring and expired documents', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_flag_docs', 'user_admin_flag_docs')

    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_1',
      category: 'CPR certificate',
      expiresAt: daysFromNow(10),
    })
    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_2',
      category: 'Passport',
      expiresAt: daysFromNow(-5),
    })
    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_3',
      category: 'Car insurance',
      expiresAt: daysFromNow(90),
    })

    await t.mutation(internal.hrCases.checkAndFlagIssues, {})

    const cases = await listCases(t, tenantId)
    expect(cases).toHaveLength(2)
    expect(cases.every((c) => c.flagType === 'expiring_document')).toBe(true)
    expect(cases.every((c) => c.category === 'credentialing')).toBe(true)
    expect(cases.every((c) => c.status === 'open')).toBe(true)
    expect(cases.every((c) => c.autoCreatedAt)).toBe(true)
    expect(cases[0]?.caseNumber).toBe(`HR-${new Date().getFullYear()}-001`)
  })

  it('creates cases for expiring and expired training completions', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(
      t,
      'org_flag_training',
      'user_admin_flag_training',
    )

    await t.run(async (ctx) => {
      await ctx.db.insert('platformTrainingCompletions', {
        tenantId,
        clerkUserId: 'user_employee_1',
        trainingId: 'orientation',
        completedAt: daysAgo(300),
        status: 'completed',
        expiresAt: daysFromNow(10),
      })
      await ctx.db.insert('platformTrainingCompletions', {
        tenantId,
        clerkUserId: 'user_employee_2',
        trainingId: 'annual-recert',
        completedAt: daysAgo(400),
        status: 'completed',
        expiresAt: daysAgo(3),
      })
      await ctx.db.insert('platformTrainingCompletions', {
        tenantId,
        clerkUserId: 'user_employee_3',
        trainingId: 'cpr-basics',
        completedAt: daysAgo(10),
        status: 'completed',
        expiresAt: daysFromNow(90),
      })
      await ctx.db.insert('platformTrainingCompletions', {
        tenantId,
        clerkUserId: 'user_employee_4',
        trainingId: 'no-expiry',
        completedAt: daysAgo(10),
        status: 'completed',
      })
    })

    await t.mutation(internal.hrCases.checkAndFlagIssues, {})

    const cases = await listCases(t, tenantId)
    expect(cases).toHaveLength(2)
    expect(cases.every((c) => c.flagType === 'training_expiry')).toBe(true)
    expect(cases.every((c) => c.category === 'training')).toBe(true)
    expect(cases.every((c) => c.subjectType === 'employee')).toBe(true)
    expect(cases.some((c) => c.title.includes('expired'))).toBe(true)
    expect(cases.some((c) => c.title.includes('expiring soon'))).toBe(true)
  })

  it('creates cases for problematic background check statuses', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_flag_bg', 'user_admin_flag_bg')

    const candidateA = await seedCandidate(t, tenantId, {
      email: 'a@example.com',
      status: 'hr_review',
      createdAt: daysAgo(1),
    })
    const candidateB = await seedCandidate(t, tenantId, {
      email: 'b@example.com',
      status: 'hr_review',
      createdAt: daysAgo(1),
    })
    const candidateC = await seedCandidate(t, tenantId, {
      email: 'c@example.com',
      status: 'hr_review',
      createdAt: daysAgo(1),
    })

    await t.run(async (ctx) => {
      await ctx.db.insert('backgroundChecks', {
        tenantId,
        candidateId: candidateA,
        provider: 'mock',
        package: 'basic',
        status: 'consider',
        initiatedAt: daysAgo(2),
      })
      await ctx.db.insert('backgroundChecks', {
        tenantId,
        candidateId: candidateB,
        provider: 'mock',
        package: 'basic',
        status: 'scan_failed',
        initiatedAt: daysAgo(2),
      })
      await ctx.db.insert('backgroundChecks', {
        tenantId,
        candidateId: candidateC,
        provider: 'mock',
        package: 'basic',
        status: 'clear',
        initiatedAt: daysAgo(2),
      })
    })

    await t.mutation(internal.hrCases.checkAndFlagIssues, {})

    const cases = await listCases(t, tenantId)
    expect(cases).toHaveLength(2)
    expect(cases.every((c) => c.flagType === 'bg_check_concern')).toBe(true)
    expect(cases.every((c) => c.category === 'credentialing')).toBe(true)
    expect(cases.every((c) => c.subjectType === 'candidate')).toBe(true)
    expect(cases.some((c) => c.title === 'Background check flagged: consider')).toBe(
      true,
    )
  })

  it('creates cases for candidates stuck beyond status thresholds', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(
      t,
      'org_flag_stall',
      'user_admin_flag_stall',
    )

    await seedCandidate(t, tenantId, {
      email: 'invited-old@example.com',
      status: 'invited',
      createdAt: daysAgo(10),
    })
    await seedCandidate(t, tenantId, {
      email: 'invited-new@example.com',
      status: 'invited',
      createdAt: daysAgo(3),
    })
    await seedCandidate(t, tenantId, {
      email: 'draft-old@example.com',
      status: 'application_draft',
      createdAt: daysAgo(20),
    })
    await seedCandidate(t, tenantId, {
      email: 'submitted-old@example.com',
      status: 'submitted',
      createdAt: daysAgo(6),
    })
    await seedCandidate(t, tenantId, {
      email: 'review-new@example.com',
      status: 'hr_review',
      createdAt: daysAgo(4),
    })

    await t.mutation(internal.hrCases.checkAndFlagIssues, {})

    const cases = await listCases(t, tenantId)
    expect(cases).toHaveLength(3)
    expect(cases.every((c) => c.flagType === 'pipeline_stall')).toBe(true)
    expect(cases.every((c) => c.category === 'recruitment')).toBe(true)
    expect(cases.some((c) => c.title.includes("'invited'"))).toBe(true)
    expect(cases.some((c) => c.title.includes("'application_draft'"))).toBe(true)
    expect(cases.some((c) => c.title.includes("'submitted'"))).toBe(true)
  })

  it('creates cases for rejected applications without notes and stale corrections', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_flag_apps', 'user_admin_flag_apps')

    const rejectedNoNotes = await seedCandidate(t, tenantId, {
      email: 'rej-no-notes@example.com',
      status: 'hr_review',
      createdAt: daysAgo(1),
    })
    const rejectedWithNotes = await seedCandidate(t, tenantId, {
      email: 'rej-notes@example.com',
      status: 'hr_review',
      createdAt: daysAgo(1),
    })
    const staleCorrection = await seedCandidate(t, tenantId, {
      email: 'stale-correction@example.com',
      status: 'hr_review',
      createdAt: daysAgo(1),
    })
    const freshCorrection = await seedCandidate(t, tenantId, {
      email: 'fresh-correction@example.com',
      status: 'hr_review',
      createdAt: daysAgo(1),
    })

    await t.run(async (ctx) => {
      await ctx.db.insert('applications', {
        tenantId,
        candidateId: rejectedNoNotes,
        status: 'reviewed',
        decision: 'rejected',
        decisionAt: daysAgo(1),
      })
      await ctx.db.insert('applications', {
        tenantId,
        candidateId: rejectedWithNotes,
        status: 'reviewed',
        decision: 'rejected',
        decisionAt: daysAgo(1),
        hrNotes: 'Failed screening.',
      })
      await ctx.db.insert('applications', {
        tenantId,
        candidateId: staleCorrection,
        status: 'reviewed',
        decision: 'needs_correction',
        decisionAt: daysAgo(10),
      })
      await ctx.db.insert('applications', {
        tenantId,
        candidateId: freshCorrection,
        status: 'reviewed',
        decision: 'needs_correction',
        decisionAt: daysAgo(3),
      })
    })

    await t.mutation(internal.hrCases.checkAndFlagIssues, {})

    const cases = await listCases(t, tenantId)
    expect(cases).toHaveLength(2)
    expect(cases.every((c) => c.flagType === 'application_rejection')).toBe(true)
    expect(cases.every((c) => c.category === 'recruitment')).toBe(true)
    expect(
      cases.some((c) => c.title === 'Application rejected without HR notes'),
    ).toBe(true)
    expect(cases.some((c) => c.title.includes('correction pending'))).toBe(true)
  })

  it('creates cases for shift issues', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(
      t,
      'org_flag_shifts',
      'user_admin_flag_shifts',
    )

    await t.run(async (ctx) => {
      const clientId = await ctx.db.insert('clients', {
        tenantId,
        displayName: 'Test Client',
        serviceType: 'SLS',
        authorizationHours: 100,
        riskFlags: [],
        serviceAddress: {
          line1: '123 Main St',
          city: 'Minneapolis',
          state: 'MN',
          postalCode: '55401',
        },
      })
      await ctx.db.insert('shifts', {
        tenantId,
        clientId,
        caregiverId: 'user_cg_1',
        scheduledStart: daysAgo(5),
        scheduledEnd: daysAgo(5),
        status: 'needs_correction',
        serviceType: 'SLS',
        rate: 25,
      })
      await ctx.db.insert('shifts', {
        tenantId,
        clientId,
        caregiverId: 'user_cg_2',
        scheduledStart: daysAgo(1),
        scheduledEnd: daysAgo(1),
        status: 'needs_correction',
        serviceType: 'SLS',
        rate: 25,
      })
      await ctx.db.insert('shifts', {
        tenantId,
        clientId,
        caregiverId: 'user_cg_3',
        scheduledStart: daysAgo(2),
        scheduledEnd: daysAgo(2),
        status: 'scheduled',
        serviceType: 'SLS',
        rate: 25,
      })
      await ctx.db.insert('shifts', {
        tenantId,
        clientId,
        caregiverId: 'user_cg_4',
        scheduledStart: daysAgo(2),
        scheduledEnd: daysAgo(1),
        status: 'in_progress',
        clockInAt: daysAgo(2),
        serviceType: 'SLS',
        rate: 25,
      })
      await ctx.db.insert('shifts', {
        tenantId,
        clientId,
        caregiverId: 'user_cg_5',
        scheduledStart: daysAgo(2),
        scheduledEnd: daysAgo(1),
        status: 'approved',
        clockInAt: daysAgo(2),
        clockOutAt: daysAgo(1),
        serviceType: 'SLS',
        rate: 25,
      })
    })

    await t.mutation(internal.hrCases.checkAndFlagIssues, {})

    const cases = await listCases(t, tenantId)
    expect(cases).toHaveLength(3)
    expect(cases.every((c) => c.flagType === 'shift_issue')).toBe(true)
    expect(cases.every((c) => c.category === 'scheduling')).toBe(true)
    const titles = cases.map((c) => c.title)
    expect(titles.some((title) => title.includes('needs correction'))).toBe(true)
    expect(titles.some((title) => title.includes('Missed clock-in'))).toBe(true)
    expect(titles.some((title) => title.includes('Missed clock-out'))).toBe(true)
  })

  it('creates cases for documents pending verification over 7 days', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(
      t,
      'org_flag_pending',
      'user_admin_flag_pending',
    )

    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_1',
      category: 'TB test',
      status: 'pending',
      createdAt: daysAgo(10),
    })
    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_2',
      category: 'Health screen',
      status: 'pending',
      createdAt: daysAgo(3),
    })
    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_3',
      category: 'Passport',
      status: 'active',
      createdAt: daysAgo(30),
    })

    await t.mutation(internal.hrCases.checkAndFlagIssues, {})

    const cases = await listCases(t, tenantId)
    expect(cases).toHaveLength(1)
    expect(cases[0]?.flagType).toBe('unverified_doc')
    expect(cases[0]?.category).toBe('documentation')
    expect(cases[0]?.title).toContain('TB test')
    expect(cases[0]?.title).toContain('10 days')
  })

  it('does not create duplicate cases when run twice', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(
      t,
      'org_flag_dedup',
      'user_admin_flag_dedup',
    )

    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_1',
      category: 'CPR certificate',
      expiresAt: daysFromNow(10),
    })

    await t.mutation(internal.hrCases.checkAndFlagIssues, {})
    await t.mutation(internal.hrCases.checkAndFlagIssues, {})

    const cases = await listCases(t, tenantId)
    expect(cases).toHaveLength(1)
  })

  it('creates a new case after the previous case is resolved', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(
      t,
      'org_flag_resolved',
      'user_admin_flag_resolved',
    )

    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_1',
      category: 'CPR certificate',
      expiresAt: daysFromNow(10),
    })

    await t.mutation(internal.hrCases.checkAndFlagIssues, {})

    const firstCases = await listCases(t, tenantId)
    expect(firstCases).toHaveLength(1)
    await t.run(async (ctx) => {
      await ctx.db.patch(firstCases[0]!._id, { status: 'resolved' })
    })

    await t.mutation(internal.hrCases.checkAndFlagIssues, {})

    const cases = await listCases(t, tenantId)
    expect(cases).toHaveLength(2)
    expect(cases.filter((c) => c.status === 'open')).toHaveLength(1)
    expect(cases.filter((c) => c.status === 'resolved')).toHaveLength(1)
  })

  it('creates no cases when nothing warrants a flag', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_flag_none', 'user_admin_flag_none')

    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_1',
      category: 'CPR certificate',
      expiresAt: daysFromNow(90),
    })
    await seedCandidate(t, tenantId, {
      email: 'healthy@example.com',
      status: 'hr_review',
      createdAt: daysAgo(1),
    })

    await t.mutation(internal.hrCases.checkAndFlagIssues, {})

    const cases = await listCases(t, tenantId)
    expect(cases).toHaveLength(0)
  })
})

describe('triggerFlagCheck', () => {
  it('creates cases for expiring documents for org:hr callers', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_trigger_flag'
    const adminId = 'user_admin_trigger_flag'
    const hrId = 'user_hr_trigger_flag'

    const tenantId = await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)

    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_1',
      category: 'CPR certificate',
      expiresAt: daysFromNow(10),
    })
    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_2',
      category: 'Car insurance',
      expiresAt: daysFromNow(90),
    })

    const result = await asHR(t, hrId, clerkOrgId).mutation(
      api.hrCases.triggerFlagCheck,
      { clerkOrgId },
    )

    expect(result.created).toBe(1)
    const cases = await listCases(t, tenantId)
    expect(cases).toHaveLength(1)
    expect(cases[0]?.flagType).toBe('expiring_document')
    expect(cases[0]?.title).toContain('CPR certificate')
  })

  it('allows org:admin callers', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_trigger_admin'
    const adminId = 'user_admin_trigger_admin'

    await seedTenant(t, clerkOrgId, adminId)

    const result = await t
      .withIdentity({
        subject: adminId,
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .mutation(api.hrCases.triggerFlagCheck, { clerkOrgId })

    expect(result.created).toBe(0)
  })

  it('blocks org:caregiver callers', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_trigger_block'
    const adminId = 'user_admin_trigger_block'
    const caregiverId = 'user_cg_trigger_block'

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
      asCaregiver(t, caregiverId, clerkOrgId).mutation(
        api.hrCases.triggerFlagCheck,
        { clerkOrgId },
      ),
    ).rejects.toThrow()
  })
})

describe('triggerFlagCheck', () => {
  it('creates cases for expiring documents in the caller tenant', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_trigger_flag'
    const adminId = 'user_admin_trigger_flag'
    const hrId = 'user_hr_trigger_flag'

    const tenantId = await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)

    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_1',
      category: 'CPR certificate',
      expiresAt: daysFromNow(10),
    })
    await seedDocument(t, tenantId, {
      subjectId: 'user_employee_2',
      category: 'Passport',
      expiresAt: daysFromNow(90),
    })

    const result = await asHR(t, hrId, clerkOrgId).mutation(
      api.hrCases.triggerFlagCheck,
      { clerkOrgId },
    )
    expect(result.created).toBe(1)

    const cases = await listCases(t, tenantId)
    expect(cases).toHaveLength(1)
    expect(cases[0]?.flagType).toBe('expiring_document')
    expect(cases[0]?.subjectId).toBe('user_employee_1')
    expect(cases[0]?.status).toBe('open')
  })

  it('blocks org:caregiver callers', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_trigger_guard'
    const caregiverId = 'user_cg_trigger_guard'

    const tenantId = await seedTenant(t, clerkOrgId, 'user_admin_trigger_guard')
    await t.run(async (ctx) => {
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: caregiverId,
        role: 'org:caregiver',
        displayName: 'Caregiver',
        email: 'cg-trigger@example.com',
      })
    })

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).mutation(
        api.hrCases.triggerFlagCheck,
        { clerkOrgId },
      ),
    ).rejects.toThrow()
  })
})
