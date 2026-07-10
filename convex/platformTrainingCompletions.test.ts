import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

describe('platformTrainingCompletions.completeForCandidate', () => {
  it('is idempotent and does not create duplicate rows', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_training_idempotent'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Training Agency',
        slug: 'training-agency',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: 'user_cg',
        role: 'org:caregiver',
        displayName: 'Caregiver',
        email: 'cg@example.com',
      })
    })

    const run = () =>
      t
        .withIdentity({
          subject: 'user_cg',
          org_id: clerkOrgId,
          org_role: 'org:caregiver',
        })
        .run(async (ctx) => {
          return ctx.runMutation(api.platformTrainingCompletions.completeForCandidate, {
            clerkOrgId,
            trainingId: 'platform_training',
            completedAt: new Date().toISOString(),
            status: 'complete',
          })
        })

    const id1 = await run()
    const id2 = await run()
    expect(id1).toBe(id2)

    const all = await t.run(async (ctx) => ctx.db.query('platformTrainingCompletions').collect())
    const userRows = all.filter((r) => r.clerkUserId === 'user_cg' && r.trainingId === 'platform_training')
    expect(userRows).toHaveLength(1)
  })
})
