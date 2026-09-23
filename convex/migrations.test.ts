import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { internal } from './_generated/api'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

const FROM_USER = 'user_from'
const TO_USER = 'user_to'

async function seed(t: ReturnType<typeof createTestConvex>) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: 'org_mig',
      name: 'Migration Agency',
      slug: 'migration-agency',
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: FROM_USER,
      role: 'org:coordinator',
      displayName: 'Old Account',
      email: 'old@example.com',
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: TO_USER,
      role: 'org:caregiver',
      displayName: 'New Account',
      email: 'new@example.com',
    })
    const candidateId = await ctx.db.insert('candidates', {
      tenantId,
      clerkUserId: FROM_USER,
      displayName: 'Person',
      email: 'old@example.com',
      status: 'offer_accepted',
      source: 'invitation',
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('candidateTasks', {
      tenantId,
      candidateId,
      type: 'i9_form',
      status: 'pending',
      order: 8,
    })
    await ctx.db.insert('notifications', {
      tenantId,
      clerkUserId: FROM_USER,
      type: 'escalation',
      message: 'note',
      read: false,
      createdAt: new Date().toISOString(),
    })
    const courseId = await ctx.db.insert('trainingCourses', {
      tenantId,
      courseKey: 'course_x',
      title: 'Course',
      description: '',
      category: 'other',
      durationMinutes: 10,
      steps: [],
      passingScore: 80,
      active: true,
      isDefault: false,
      createdAt: new Date().toISOString(),
    } as never)
    await ctx.db.insert('trainingStepCompletions', {
      tenantId,
      clerkUserId: FROM_USER,
      courseId,
      stepId: 's1',
      completedAt: new Date().toISOString(),
    })
    await ctx.db.insert('platformTrainingCompletions', {
      tenantId,
      clerkUserId: FROM_USER,
      trainingId: 'course_x',
      completedAt: new Date().toISOString(),
      status: 'completed',
    })
    return { tenantId, candidateId }
  })
}

describe('migrations.migrateUserAccount', () => {
  it('moves candidate, role, notifications and training progress; removes old membership', async () => {
    const t = createTestConvex()
    const { tenantId, candidateId } = await seed(t)

    const summary = await t.mutation(internal.migrations.migrateUserAccount, {
      tenantId,
      fromClerkUserId: FROM_USER,
      toClerkUserId: TO_USER,
      toEmail: 'new@example.com',
      toRole: 'org:coordinator',
    })
    expect(summary).toEqual({
      candidateMoved: true,
      toMemberRoleSet: true,
      fromMemberRemoved: true,
      notifications: 1,
      platformTrainingCompletions: 1,
      trainingStepCompletions: 1,
    })

    const candidate = await t.run(async (ctx) => ctx.db.get(candidateId))
    expect(candidate?.clerkUserId).toBe(TO_USER)
    expect(candidate?.email).toBe('new@example.com')

    const members = await t.run(async (ctx) =>
      ctx.db.query('tenantMembers').collect(),
    )
    expect(members).toHaveLength(1)
    expect(members[0].clerkUserId).toBe(TO_USER)
    expect(members[0].role).toBe('org:coordinator')

    for (const table of [
      'notifications',
      'platformTrainingCompletions',
      'trainingStepCompletions',
    ] as const) {
      const rows = await t.run(async (ctx) => ctx.db.query(table).collect())
      expect(rows.every((row) => row.clerkUserId === TO_USER)).toBe(true)
    }

    // Re-running is a no-op.
    const second = await t.mutation(internal.migrations.migrateUserAccount, {
      tenantId,
      fromClerkUserId: FROM_USER,
      toClerkUserId: TO_USER,
      toEmail: 'new@example.com',
      toRole: 'org:coordinator',
    })
    expect(second.candidateMoved).toBe(false)
    expect(second.fromMemberRemoved).toBe(false)
    expect(second.notifications).toBe(0)
  })
})
