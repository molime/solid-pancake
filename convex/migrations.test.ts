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

describe('migrations.cleanupTenantPeople', () => {
  it('removes everyone and everything except the kept accounts', async () => {
    const t = createTestConvex()
    const { tenantId, candidateId: keptCandidateId } = await seed(t)

    // A second (kept) candidate-less member is already TO_USER from seed;
    // seed a third, removed member + candidate with cascade rows.
    const { removedCandidateId, removedMemberId } = await t.run(async (ctx) => {
      const removedCandidateId = await ctx.db.insert('candidates', {
        tenantId,
        clerkUserId: 'user_remove',
        displayName: 'Test Person',
        email: 'remove@example.com',
        status: 'applied',
        source: 'public_apply',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('candidateTasks', {
        tenantId,
        candidateId: removedCandidateId,
        type: 'i9_form',
        status: 'pending',
        order: 8,
      })
      await ctx.db.insert('drafts', {
        tenantId,
        candidateId: removedCandidateId,
        formType: 'application',
        data: {},
        updatedAt: new Date().toISOString(),
      })
      const removedMemberId = await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: 'user_remove',
        role: 'org:candidate',
        displayName: 'Test Person',
        email: 'remove@example.com',
      })
      await ctx.db.insert('notifications', {
        tenantId,
        clerkUserId: 'user_remove',
        type: 'x',
        message: 'bye',
        read: false,
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('hrCases', {
        tenantId,
        subjectType: 'candidate',
        subjectId: removedCandidateId,
        category: 'recruitment',
        title: 'stale draft',
        status: 'open',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('hrCases', {
        tenantId,
        subjectType: 'candidate',
        subjectId: keptCandidateId,
        category: 'recruitment',
        title: 'keep me',
        status: 'open',
        createdAt: new Date().toISOString(),
      })
      return { removedCandidateId, removedMemberId }
    })

    const summary = await t.mutation(internal.migrations.cleanupTenantPeople, {
      tenantId,
      keepClerkUserIds: [TO_USER],
      keepCandidateIds: [keptCandidateId],
    })
    expect(summary.candidates).toBe(1) // only the extra candidate; seed()'s is kept
    expect(summary.tenantMembers).toBe(2) // FROM_USER and user_remove

    const remainingCandidates = await t.run(async (ctx) =>
      ctx.db.query('candidates').collect(),
    )
    expect(remainingCandidates.map((c) => c._id)).toEqual([keptCandidateId])

    const remainingMembers = await t.run(async (ctx) =>
      ctx.db.query('tenantMembers').collect(),
    )
    expect(remainingMembers.map((m) => m.clerkUserId)).toEqual([TO_USER])

    const remainingTasks = await t.run(async (ctx) =>
      ctx.db.query('candidateTasks').collect(),
    )
    expect(remainingTasks.every((task) => task.candidateId === keptCandidateId)).toBe(true)

    const remainingCases = await t.run(async (ctx) =>
      ctx.db.query('hrCases').collect(),
    )
    expect(remainingCases).toHaveLength(1)
    expect(remainingCases[0].subjectId).toBe(keptCandidateId)

    const remainingNotifications = await t.run(async (ctx) =>
      ctx.db.query('notifications').collect(),
    )
    expect(remainingNotifications.every((n) => n.clerkUserId === TO_USER)).toBe(true)

    // Re-running deletes nothing further.
    const second = await t.mutation(internal.migrations.cleanupTenantPeople, {
      tenantId,
      keepClerkUserIds: [TO_USER],
      keepCandidateIds: [keptCandidateId],
    })
    expect(second.candidates ?? 0).toBe(0)
    expect(second.tenantMembers ?? 0).toBe(0)
  })
})
