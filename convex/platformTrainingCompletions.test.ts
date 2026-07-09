import { describe, it, expect, afterEach, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

function stubClerkMembershipUpdate() {
  vi.stubEnv('CLERK_SECRET_KEY', '***')
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'mem_test',
            role: 'org:member',
            public_metadata: { atriaRole: 'org:caregiver' },
          }),
      }),
    ) as unknown as typeof fetch,
  )
}

function asCaregiver(
  t: ReturnType<typeof createTestConvex>,
  userId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: userId,
    org_id: clerkOrgId,
    org_role: 'org:caregiver',
  })
}

async function seedTenant(
  t: ReturnType<typeof createTestConvex>,
  clerkOrgId: string,
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
      clerkUserId: 'cg_123',
      role: 'org:caregiver',
      displayName: 'Caregiver',
      email: 'cg@example.com',
    })
    return tenantId
  })
}

describe('platformTrainingCompletions', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('allows caregivers to complete training and list their completions', async () => {
    stubClerkMembershipUpdate()
    const t = createTestConvex()
    const clerkOrgId = 'org_test'
    await seedTenant(t, clerkOrgId)
    const asCg = asCaregiver(t, 'cg_123', clerkOrgId)

    const result = await asCg.mutation(api.platformTrainingCompletions.completeForCandidate, {
      clerkOrgId,
      trainingId: 'welcome',
      completedAt: new Date().toISOString(),
      status: 'complete',
    })
    expect(result).toBeDefined()

    const completions = await asCg.query(api.platformTrainingCompletions.listMyCompletions, {
      clerkOrgId,
    })
    expect(completions).toHaveLength(1)
    expect(completions[0].trainingId).toBe('welcome')
  })
})
