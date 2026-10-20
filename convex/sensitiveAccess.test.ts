import { describe, expect, it, afterEach } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { resetRateLimitsForTests } from './_utils/rateLimit'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

// The limiter is module-scoped; reset between tests so counts never leak.
afterEach(() => {
  resetRateLimitsForTests()
})

type TestConvex = ReturnType<typeof createTestConvex>

function asUser(
  t: TestConvex,
  userId: string,
  clerkOrgId: string,
  role: 'org:admin' | 'org:hr' | 'org:coordinator' | 'org:caregiver',
) {
  return t.withIdentity({ subject: userId, org_id: clerkOrgId, org_role: role })
}

async function seedTenant(t: TestConvex, clerkOrgId: string) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId,
      name: `Agency ${clerkOrgId}`,
      slug: `slug-${clerkOrgId}`,
      createdAt: new Date().toISOString(),
    })
    const roles: Record<
      string,
      'org:admin' | 'org:hr' | 'org:coordinator' | 'org:caregiver'
    > = {
      admin: 'org:admin',
      hr: 'org:hr',
      coordinator: 'org:coordinator',
      caregiver: 'org:caregiver',
    }
    for (const [suffix, role] of Object.entries(roles)) {
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: `${suffix}_${clerkOrgId}`,
        role,
        displayName: `${suffix} user`,
        email: `${suffix}@example.com`,
      })
    }
    return tenantId
  })
}

async function seedCandidateWithApplication(
  t: TestConvex,
  tenantId: Id<'tenants'>,
) {
  return t.run(async (ctx) => {
    const candidateId = await ctx.db.insert('candidates', {
      tenantId,
      email: 'candidate@example.com',
      displayName: 'Test Candidate',
      status: 'applied',
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('applications', {
      tenantId,
      candidateId,
      status: 'submitted',
      fields: {
        personal: { ssn: '123-45-6789' },
        i9: { ssn: '987-65-4321' },
        w4: { ssn: '456-78-9123' },
      },
      submittedAt: new Date().toISOString(),
    })
    return candidateId
  })
}

async function auditEvents(t: TestConvex, tenantId: Id<'tenants'>) {
  return t.run(async (ctx) =>
    ctx.db
      .query('auditEvents')
      .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
      .collect(),
  )
}

describe('sensitiveAccess.revealSsn', () => {
  it('returns the full personal SSN for org:hr', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a')
    const candidateId = await seedCandidateWithApplication(t, tenantId)

    const result = await asUser(t, 'hr_org_a', 'org_a', 'org:hr').mutation(
      api.sensitiveAccess.revealSsn,
      { clerkOrgId: 'org_a', candidateId, contextType: 'application' },
    )
    expect(result.ssn).toBe('123-45-6789')
  })

  it('returns the full SSN for org:admin across contexts', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a')
    const candidateId = await seedCandidateWithApplication(t, tenantId)
    const admin = asUser(t, 'admin_org_a', 'org_a', 'org:admin')

    const w4 = await admin.mutation(api.sensitiveAccess.revealSsn, {
      clerkOrgId: 'org_a',
      candidateId,
      contextType: 'w4',
    })
    expect(w4.ssn).toBe('456-78-9123')

    const i9 = await admin.mutation(api.sensitiveAccess.revealSsn, {
      clerkOrgId: 'org_a',
      candidateId,
      contextType: 'i9',
    })
    expect(i9.ssn).toBe('987-65-4321')
  })

  it('denies org:coordinator and org:caregiver', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a')
    const candidateId = await seedCandidateWithApplication(t, tenantId)

    await expect(
      asUser(t, 'coordinator_org_a', 'org_a', 'org:coordinator').mutation(
        api.sensitiveAccess.revealSsn,
        { clerkOrgId: 'org_a', candidateId, contextType: 'application' },
      ),
    ).rejects.toThrow(/Forbidden/)

    await expect(
      asUser(t, 'caregiver_org_a', 'org_a', 'org:caregiver').mutation(
        api.sensitiveAccess.revealSsn,
        { clerkOrgId: 'org_a', candidateId, contextType: 'application' },
      ),
    ).rejects.toThrow(/Forbidden/)
  })

  it('denies an HR user from another tenant', async () => {
    const t = createTestConvex()
    const tenantA = await seedTenant(t, 'org_a')
    await seedTenant(t, 'org_b')
    const candidateId = await seedCandidateWithApplication(t, tenantA)

    await expect(
      asUser(t, 'hr_org_b', 'org_b', 'org:hr').mutation(
        api.sensitiveAccess.revealSsn,
        { clerkOrgId: 'org_b', candidateId, contextType: 'application' },
      ),
    ).rejects.toThrow(/cross-tenant|not a member|not found/)
  })

  it('writes an access.ssn_revealed audit event without the SSN value', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a')
    const candidateId = await seedCandidateWithApplication(t, tenantId)

    await asUser(t, 'hr_org_a', 'org_a', 'org:hr').mutation(
      api.sensitiveAccess.revealSsn,
      { clerkOrgId: 'org_a', candidateId, contextType: 'w4' },
    )

    const events = await auditEvents(t, tenantId)
    const reveal = events.find((e) => e.action === 'access.ssn_revealed')
    expect(reveal).toBeDefined()
    expect(reveal?.category).toBe('access')
    expect(reveal?.actorId).toBe('hr_org_a')
    expect(reveal?.metadata).toMatchObject({
      contextType: 'w4',
      candidateId: candidateId as string,
    })
    // The audit trail must never contain the revealed value.
    expect(JSON.stringify(reveal?.metadata)).not.toContain('456-78-9123')
    expect(JSON.stringify(events)).not.toContain('456-78-9123')
  })

  it('rate-limits a user to 10 reveals per minute (Stage 5)', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_rl')
    const candidateId = await seedCandidateWithApplication(t, tenantId)
    const hr = asUser(t, 'hr_org_rl', 'org_rl', 'org:hr')
    const args = {
      clerkOrgId: 'org_rl',
      candidateId,
      contextType: 'application' as const,
    }

    for (let i = 0; i < 10; i++) {
      await expect(hr.mutation(api.sensitiveAccess.revealSsn, args)).resolves.toEqual({
        ssn: '123-45-6789',
      })
    }

    await expect(hr.mutation(api.sensitiveAccess.revealSsn, args)).rejects.toThrow(
      /Rate limit exceeded/,
    )
  })
})
