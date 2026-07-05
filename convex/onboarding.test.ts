import { describe, expect, it, afterEach, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
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

function asCandidate(
  t: ReturnType<typeof createTestConvex>,
  candidateId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: candidateId,
    org_id: clerkOrgId,
    org_role: 'org:candidate',
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

describe('completePlatformTraining', () => {
  it('is idempotent for caregiver', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_training_idempotent'
    const adminId = 'user_admin_training'
    const caregiverId = 'user_cg_training'

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

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.onboarding.completePlatformTraining,
      { clerkOrgId },
    )
    await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.onboarding.completePlatformTraining,
      { clerkOrgId },
    )

    const completions = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db
        .query('platformTrainingCompletions')
        .withIndex('by_tenant_user', (q) =>
          q.eq('tenantId', tenant._id).eq('clerkUserId', caregiverId),
        )
        .collect()
    })

    expect(completions).toHaveLength(1)
    expect(completions[0]?.status).toBe('completed')
  })

  it('works for candidate role', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_training_candidate'
    const adminId = 'user_admin_training_cand'
    const candidateId = 'user_candidate_training'

    await seedTenant(t, clerkOrgId, adminId)
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: candidateId,
        role: 'org:candidate',
        displayName: 'Candidate',
        email: 'candidate@example.com',
      })
    })

    await asCandidate(t, candidateId, clerkOrgId).mutation(
      api.onboarding.completePlatformTraining,
      { clerkOrgId },
    )

    const completed = await asCandidate(t, candidateId, clerkOrgId).query(
      api.onboarding.hasPlatformTrainingCompleted,
      { clerkOrgId },
    )
    expect(completed).toBe(true)
  })
})

describe('hasPlatformTrainingCompleted', () => {
  it('returns false before completion and true after', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_training_has'
    const adminId = 'user_admin_training_has'
    const caregiverId = 'user_cg_training_has'

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

    const before = await asCaregiver(t, caregiverId, clerkOrgId).query(
      api.onboarding.hasPlatformTrainingCompleted,
      { clerkOrgId },
    )
    expect(before).toBe(false)

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.onboarding.completePlatformTraining,
      { clerkOrgId },
    )

    const after = await asCaregiver(t, caregiverId, clerkOrgId).query(
      api.onboarding.hasPlatformTrainingCompleted,
      { clerkOrgId },
    )
    expect(after).toBe(true)
  })
})

describe('resetPlatformTraining', () => {
  it('deletes completion for admin', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_training_reset'
    const adminId = 'user_admin_training_reset'
    const caregiverId = 'user_cg_training_reset'

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
      await ctx.db.insert('platformTrainingCompletions', {
        tenantId: tenant._id,
        clerkUserId: caregiverId,
        trainingId: 'platform_training',
        completedAt: new Date().toISOString(),
        status: 'completed',
      })
    })

    const result = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.onboarding.resetPlatformTraining,
      { clerkOrgId, clerkUserId: caregiverId },
    )
    expect(result.deleted).toBe(true)

    const after = await asCaregiver(t, caregiverId, clerkOrgId).query(
      api.onboarding.hasPlatformTrainingCompleted,
      { clerkOrgId },
    )
    expect(after).toBe(false)
  })

  it('blocks non-admin callers', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_training_reset_block'
    const adminId = 'user_admin_training_reset_block'
    const caregiverId = 'user_cg_training_reset_block'

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
        api.onboarding.resetPlatformTraining,
        { clerkOrgId, clerkUserId: caregiverId },
      ),
    ).rejects.toThrow()
  })
})
