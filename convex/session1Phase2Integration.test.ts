import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

function asAdmin(
  t: ReturnType<typeof createTestConvex>,
  userId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: userId,
    org_id: clerkOrgId,
    org_role: 'org:admin',
  })
}

describe('session1 phase2 backend integration', () => {
  it('admin can create, get and update a candidate', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_phase2_candidate'
    const adminId = 'user_phase2_admin'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Phase2 Agency',
        slug: 'phase2-agency',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@phase2.com',
      })
    })

    const candidateId = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.candidates.create,
      {
        clerkOrgId,
        email: 'candidate@example.com',
        displayName: 'Candidate',
        source: 'referral',
      },
    )

    const candidate = await asAdmin(t, adminId, clerkOrgId).query(
      api.candidates.get,
      {
        clerkOrgId,
        candidateId,
      },
    )
    expect(candidate.email).toBe('candidate@example.com')
    expect(candidate.status).toBe('new')

    await asAdmin(t, adminId, clerkOrgId).mutation(api.candidates.update, {
      clerkOrgId,
      candidateId,
      status: 'screening',
    })

    const updated = await asAdmin(t, adminId, clerkOrgId).query(
      api.candidates.get,
      {
        clerkOrgId,
        candidateId,
      },
    )
    expect(updated.status).toBe('screening')
  })

  it('platform training completion can be recorded for a tenant member', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_phase2_training'
    const adminId = 'user_phase2_training_admin'
    const caregiverId = 'user_phase2_caregiver'
    let tenantId: Id<'tenants'>

    await t.run(async (ctx) => {
      tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Training Agency',
        slug: 'training-agency',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@training.com',
      })
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: caregiverId,
        role: 'org:caregiver',
        displayName: 'Caregiver',
        email: 'caregiver@training.com',
      })
    })

    const completionId = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.platformTrainingCompletions.create,
      {
        clerkOrgId,
        clerkUserId: caregiverId,
        trainingId: 'cpr-101',
        completedAt: new Date().toISOString(),
        status: 'completed',
      },
    )
    expect(completionId).toBeDefined()
  })
})
