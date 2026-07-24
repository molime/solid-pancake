import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

beforeEach(() => {
  // convex-test executes scheduled functions via the (mocked) timer loop, so
  // fake timers must be active before mutations schedule their follow-ups.
  vi.useFakeTimers()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function asAdmin(
  t: ReturnType<typeof createTestConvex>,
  adminId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: adminId,
    org_id: clerkOrgId,
    org_role: 'org:admin',
  })
}

function asCandidate(
  t: ReturnType<typeof createTestConvex>,
  candidateUserId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: candidateUserId,
    org_id: clerkOrgId,
    org_role: 'org:candidate',
  })
}

async function seedTenantWithCandidate(
  t: ReturnType<typeof createTestConvex>,
  clerkOrgId: string,
  adminId: string,
  candidateUserId: string,
) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId,
      name: 'Test Agency',
      slug: `agency-${clerkOrgId}`,
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: adminId,
      role: 'org:admin',
      displayName: 'Admin',
      email: 'admin@example.com',
    })
    const candidateId = await ctx.db.insert('candidates', {
      tenantId,
      clerkUserId: candidateUserId,
      email: 'candidate@example.com',
      displayName: 'Test Candidate',
      status: 'applied',
      createdAt: new Date().toISOString(),
    })
    return { tenantId, candidateId }
  })
}

async function getCheck(
  t: ReturnType<typeof createTestConvex>,
  checkId: Id<'backgroundChecks'>,
) {
  return t.run((ctx) => ctx.db.get(checkId))
}

describe('initiateBackgroundCheck', () => {
  it('is idempotent: a second initiation returns the existing check', async () => {
    const t = createTestConvex()
    const { tenantId, candidateId } = await seedTenantWithCandidate(t, 'org_1', 'admin_1', 'cand_1')

    const first = await asAdmin(t, 'admin_1', 'org_1').mutation(
      api.backgroundChecks.initiateBackgroundCheck,
      { clerkOrgId: 'org_1', candidateId },
    )
    const second = await asAdmin(t, 'admin_1', 'org_1').mutation(
      api.backgroundChecks.initiateBackgroundCheck,
      { clerkOrgId: 'org_1', candidateId },
    )

    expect(second).toEqual(first)
    const checks = await t.run(async (ctx) =>
      ctx.db
        .query('backgroundChecks')
        .withIndex('by_tenant_candidate', (q) => q.eq('tenantId', tenantId).eq('candidateId', candidateId))
        .collect(),
    )
    expect(checks).toHaveLength(1)
  })

  it('rejects initiation by a non-admin role', async () => {
    const t = createTestConvex()
    const { candidateId } = await seedTenantWithCandidate(t, 'org_1', 'admin_1', 'cand_1')

    await expect(
      asCandidate(t, 'cand_1', 'org_1').mutation(
        api.backgroundChecks.initiateBackgroundCheck,
        { clerkOrgId: 'org_1', candidateId },
      ),
    ).rejects.toThrow()
  })

  it('rejects cross-tenant initiation for a candidate of another tenant', async () => {
    const t = createTestConvex()
    const { candidateId } = await seedTenantWithCandidate(t, 'org_1', 'admin_1', 'cand_1')
    await seedTenantWithCandidate(t, 'org_2', 'admin_2', 'cand_2')

    await expect(
      asAdmin(t, 'admin_2', 'org_2').mutation(
        api.backgroundChecks.initiateBackgroundCheck,
        { clerkOrgId: 'org_2', candidateId },
      ),
    ).rejects.toThrow()
  })
})

describe('updateCheckResult', () => {
  it('does not overwrite a finalized result (retry safety)', async () => {
    const t = createTestConvex()
    const { tenantId, candidateId } = await seedTenantWithCandidate(
      t,
      'org_1',
      'admin_1',
      'cand_1',
    )
    const checkId = await t.run(async (ctx) =>
      ctx.db.insert('backgroundChecks', {
        tenantId,
        candidateId,
        provider: 'mock',
        status: 'clear',
        package: 'basic',
        initiatedAt: new Date().toISOString(),
        result: JSON.stringify({ summary: 'final' }),
      }),
    )

    await t.mutation(internal.backgroundChecks.updateCheckResult, {
      checkId,
      tenantId,
      providerReportId: 'retry_report',
      status: 'consider',
      result: JSON.stringify({ summary: 'retry overwrite' }),
    })

    const check = await getCheck(t, checkId)
    expect(check?.status).toBe('clear')
    expect(check?.providerReportId).toBeUndefined()
    expect(check?.result).toBe(JSON.stringify({ summary: 'final' }))
  })
})

describe('uploadBackgroundCheckResult scan gating', () => {
  it('marks the check pending_scan on upload and completed after a clean scan', async () => {
    const t = createTestConvex()
    const { tenantId, candidateId } = await seedTenantWithCandidate(t, 'org_1', 'admin_1', 'cand_1')

    await asAdmin(t, 'admin_1', 'org_1').mutation(
      api.backgroundChecks.uploadBackgroundCheckResult,
      {
        clerkOrgId: 'org_1',
        candidateId,
        storageId: 'storage_clean_pdf',
        fileName: 'result.pdf',
        contentType: 'application/pdf',
        size: 1024,
      },
    )

    // Before the scheduled scan runs, the check must NOT be completed.
    let check = await t.run(async (ctx) =>
      ctx.db
        .query('backgroundChecks')
        .withIndex('by_tenant_candidate', (q) => q.eq('tenantId', tenantId).eq('candidateId', candidateId))
        .first(),
    )
    expect(check?.status).toBe('pending_scan')
    expect(check?.officialResultStorageId).toBe('storage_clean_pdf')

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    check = await t.run(async (ctx) =>
      ctx.db
        .query('backgroundChecks')
        .withIndex('by_tenant_candidate', (q) => q.eq('tenantId', tenantId).eq('candidateId', candidateId))
        .first(),
    )
    expect(check?.status).toBe('completed')
    expect(check?.completedAt).toBeDefined()
  })

  it('marks the check scan_failed and unlinks a rejected file', async () => {
    const t = createTestConvex()
    const { tenantId, candidateId } = await seedTenantWithCandidate(t, 'org_1', 'admin_1', 'cand_1')

    await asAdmin(t, 'admin_1', 'org_1').mutation(
      api.backgroundChecks.uploadBackgroundCheckResult,
      {
        clerkOrgId: 'org_1',
        candidateId,
        storageId: 'storage_evil_exe',
        fileName: 'evil.exe',
        contentType: 'application/x-msdownload',
        size: 1024,
      },
    )

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const check = await t.run(async (ctx) =>
      ctx.db
        .query('backgroundChecks')
        .withIndex('by_tenant_candidate', (q) => q.eq('tenantId', tenantId).eq('candidateId', candidateId))
        .first(),
    )
    expect(check?.status).toBe('scan_failed')
    expect(check?.officialResultStorageId).toBeUndefined()
  })

  it('rejects cross-tenant upload for a candidate of another tenant', async () => {
    const t = createTestConvex()
    const { candidateId } = await seedTenantWithCandidate(t, 'org_1', 'admin_1', 'cand_1')
    await seedTenantWithCandidate(t, 'org_2', 'admin_2', 'cand_2')

    await expect(
      asAdmin(t, 'admin_2', 'org_2').mutation(
        api.backgroundChecks.uploadBackgroundCheckResult,
        { clerkOrgId: 'org_2', candidateId, storageId: 'storage_x' },
      ),
    ).rejects.toThrow()
  })
})
