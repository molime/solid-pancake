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

describe('phase2 tenant guards', () => {
  it('candidate update is tenant-guarded via assertTenantDoc', async () => {
    const t = createTestConvex()
    const clerkOrgIdA = 'org_phase2_update_a'
    const clerkOrgIdB = 'org_phase2_update_b'
    const adminA = 'user_admin_update_a'
    const adminB = 'user_admin_update_b'
    let candidateId: Id<'candidates'>

    await t.run(async (ctx) => {
      const tenantA = await ctx.db.insert('tenants', {
        clerkOrgId: clerkOrgIdA,
        name: 'Agency A',
        slug: 'agency-a',
        createdAt: new Date().toISOString(),
      })
      const tenantB = await ctx.db.insert('tenants', {
        clerkOrgId: clerkOrgIdB,
        name: 'Agency B',
        slug: 'agency-b',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId: tenantA,
        clerkUserId: adminA,
        role: 'org:admin',
        displayName: 'Admin A',
        email: 'admin@a.com',
      })
      await ctx.db.insert('tenantMembers', {
        tenantId: tenantB,
        clerkUserId: adminB,
        role: 'org:admin',
        displayName: 'Admin B',
        email: 'admin@b.com',
      })

      candidateId = await ctx.db.insert('candidates', {
        tenantId: tenantA,
        email: 'candidate@example.com',
        displayName: 'Candidate',
        status: 'new',
        createdAt: new Date().toISOString(),
      })
    })

    await expect(
      asAdmin(t, adminA, clerkOrgIdA).mutation(api.candidates.update, {
        clerkOrgId: clerkOrgIdA,
        candidateId: candidateId!,
        status: 'screening',
      }),
    ).resolves.toBeDefined()

    await expect(
      asAdmin(t, adminB, clerkOrgIdB).mutation(api.candidates.update, {
        clerkOrgId: clerkOrgIdB,
        candidateId: candidateId!,
        status: 'rejected',
      }),
    ).rejects.toThrow('cross-tenant access denied')
  })

  it('cross-tenant candidate read is rejected', async () => {
    const t = createTestConvex()
    const clerkOrgIdA = 'org_phase2_read_a'
    const clerkOrgIdB = 'org_phase2_read_b'
    const adminA = 'user_admin_read_a'
    const adminB = 'user_admin_read_b'
    let candidateId: Id<'candidates'>

    await t.run(async (ctx) => {
      const tenantA = await ctx.db.insert('tenants', {
        clerkOrgId: clerkOrgIdA,
        name: 'Agency A',
        slug: 'agency-a',
        createdAt: new Date().toISOString(),
      })
      const tenantB = await ctx.db.insert('tenants', {
        clerkOrgId: clerkOrgIdB,
        name: 'Agency B',
        slug: 'agency-b',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId: tenantA,
        clerkUserId: adminA,
        role: 'org:admin',
        displayName: 'Admin A',
        email: 'admin@a.com',
      })
      await ctx.db.insert('tenantMembers', {
        tenantId: tenantB,
        clerkUserId: adminB,
        role: 'org:admin',
        displayName: 'Admin B',
        email: 'admin@b.com',
      })

      candidateId = await ctx.db.insert('candidates', {
        tenantId: tenantA,
        email: 'candidate@example.com',
        displayName: 'Candidate',
        status: 'new',
        createdAt: new Date().toISOString(),
      })
    })

    await expect(
      asAdmin(t, adminB, clerkOrgIdB).query(api.candidates.get, {
        clerkOrgId: clerkOrgIdB,
        candidateId: candidateId!,
      }),
    ).rejects.toThrow('cross-tenant access denied')
  })

  it('platformTrainingCompletions cannot be written for a different tenant user', async () => {
    const t = createTestConvex()
    const clerkOrgIdA = 'org_phase2_train_a'
    const clerkOrgIdB = 'org_phase2_train_b'
    const adminA = 'user_admin_train_a'
    const adminB = 'user_admin_train_b'
    const userU1 = 'user_u1'

    await t.run(async (ctx) => {
      const tenantA = await ctx.db.insert('tenants', {
        clerkOrgId: clerkOrgIdA,
        name: 'Agency A',
        slug: 'agency-a',
        createdAt: new Date().toISOString(),
      })
      const tenantB = await ctx.db.insert('tenants', {
        clerkOrgId: clerkOrgIdB,
        name: 'Agency B',
        slug: 'agency-b',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId: tenantA,
        clerkUserId: adminA,
        role: 'org:admin',
        displayName: 'Admin A',
        email: 'admin@a.com',
      })
      await ctx.db.insert('tenantMembers', {
        tenantId: tenantA,
        clerkUserId: userU1,
        role: 'org:caregiver',
        displayName: 'Caregiver U1',
        email: 'u1@a.com',
      })
      await ctx.db.insert('tenantMembers', {
        tenantId: tenantB,
        clerkUserId: adminB,
        role: 'org:admin',
        displayName: 'Admin B',
        email: 'admin@b.com',
      })
    })

    await expect(
      asAdmin(t, adminA, clerkOrgIdA).mutation(
        api.platformTrainingCompletions.create,
        {
          clerkOrgId: clerkOrgIdA,
          clerkUserId: userU1,
          trainingId: 'training_1',
          completedAt: new Date().toISOString(),
          status: 'completed',
        },
      ),
    ).resolves.toBeDefined()

    await expect(
      asAdmin(t, adminB, clerkOrgIdB).mutation(
        api.platformTrainingCompletions.create,
        {
          clerkOrgId: clerkOrgIdB,
          clerkUserId: userU1,
          trainingId: 'training_1',
          completedAt: new Date().toISOString(),
          status: 'completed',
        },
      ),
    ).rejects.toThrow('not a member of this tenant')
  })

  it('tenantMembers with org:hr can be inserted and retrieved', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_phase2_hr'
    const adminId = 'user_admin_hr'
    const hrId = 'user_hr'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Agency HR',
        slug: 'agency-hr',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@agency.com',
      })
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: hrId,
        role: 'org:hr',
        displayName: 'HR',
        email: 'hr@agency.com',
      })
    })

    const members = await asAdmin(t, adminId, clerkOrgId).query(
      api.members.list,
      { clerkOrgId },
    )
    const hrMember = members.find((m) => m.clerkUserId === hrId)

    expect(hrMember).toBeDefined()
    expect(hrMember?.role).toBe('org:hr')
  })
})
