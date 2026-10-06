import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

const SAMPLE_COURSE = {
  courseKey: 'test_course',
  title: 'Test Course',
  description: 'A course for testing.',
  category: 'agency_onboarding' as const,
  durationMinutes: 30,
  steps: [
    {
      id: 'step_1',
      title: 'Step 1',
      type: 'text' as const,
      content: 'Hello world.',
      required: true,
    },
    {
      id: 'step_2',
      title: 'Step 2',
      type: 'quiz' as const,
      content: JSON.stringify({
        questions: [
          {
            question: 'What is 2+2?',
            options: ['3', '4', '5'],
            correct: 1,
          },
        ],
      }),
      required: true,
    },
  ],
  passingScore: 80,
}

async function seedTenant(t: ReturnType<typeof createTestConvex>, clerkOrgId: string) {
  return t.run(async (ctx) => {
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
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: 'user_admin',
      role: 'org:admin',
      displayName: 'Admin',
      email: 'admin@example.com',
    })
    return tenantId
  })
}

describe('training.createCourse', () => {
  it('creates a course and lists it', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_create_course'
    await seedTenant(t, clerkOrgId)

    const courseId = await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.training.createCourse, {
          clerkOrgId,
          ...SAMPLE_COURSE,
        })
      })

    const courses = await t
      .withIdentity({
        subject: 'user_cg',
        org_id: clerkOrgId,
        org_role: 'org:caregiver',
      })
      .run(async (ctx) => {
        return ctx.runQuery(api.training.listCourses, { clerkOrgId })
      })

    expect(courses).toHaveLength(1)
    expect(courses[0]._id).toBe(courseId)
    expect(courses[0].title).toBe('Test Course')
    expect(courses[0].progressPercent).toBe(0)
  })

  it('rejects a duplicate explicit courseKey', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_create_course_dup'
    await seedTenant(t, clerkOrgId)

    await expect(
      t
        .withIdentity({
          subject: 'user_admin',
          org_id: clerkOrgId,
          org_role: 'org:admin',
        })
        .run(async (ctx) => {
          await ctx.runMutation(api.training.createCourse, {
            clerkOrgId,
            ...SAMPLE_COURSE,
          })
          return ctx.runMutation(api.training.createCourse, {
            clerkOrgId,
            ...SAMPLE_COURSE,
          })
        }),
    ).rejects.toThrow(/already exists/)
  })
})

describe('training.createCourse auto courseKey', () => {
  it('generates a slugified unique key when courseKey is omitted', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_auto_course_key'
    await seedTenant(t, clerkOrgId)

    const { courseKey: _omit, ...rest } = SAMPLE_COURSE
    const firstId = await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.training.createCourse, {
          clerkOrgId,
          ...rest,
          title: 'Fire Safety 101!',
        })
      })

    const first = await t.run(async (ctx) => ctx.db.get(firstId))
    expect(first?.courseKey).toMatch(/^fire_safety_101_[a-z0-9]{6}$/)

    // A second course with the same title must get a different key.
    const secondId = await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.training.createCourse, {
          clerkOrgId,
          ...rest,
          title: 'Fire Safety 101!',
        })
      })

    const second = await t.run(async (ctx) => ctx.db.get(secondId))
    expect(second?.courseKey).toMatch(/^fire_safety_101_[a-z0-9]{6}$/)
    expect(second?.courseKey).not.toBe(first?.courseKey)
  })

  it('falls back to "course" when the title has no slug-able characters', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_auto_course_key_fallback'
    await seedTenant(t, clerkOrgId)

    const { courseKey: _omit, ...rest } = SAMPLE_COURSE
    const courseId = await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.training.createCourse, {
          clerkOrgId,
          ...rest,
          title: '!!!',
        })
      })

    const course = await t.run(async (ctx) => ctx.db.get(courseId))
    expect(course?.courseKey).toMatch(/^course_[a-z0-9]{6}$/)
  })
})

describe('training.completeStep', () => {
  it('records step completion and updates progress', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_complete_step'
    await seedTenant(t, clerkOrgId)

    const courseId = await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.training.createCourse, {
          clerkOrgId,
          ...SAMPLE_COURSE,
        })
      })

    await t
      .withIdentity({
        subject: 'user_cg',
        org_id: clerkOrgId,
        org_role: 'org:caregiver',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.training.completeStep, {
          clerkOrgId,
          courseId,
          stepId: 'step_1',
        })
      })

    const courses = await t
      .withIdentity({
        subject: 'user_cg',
        org_id: clerkOrgId,
        org_role: 'org:caregiver',
      })
      .run(async (ctx) => {
        return ctx.runQuery(api.training.listCourses, { clerkOrgId })
      })

    expect(courses[0].progressPercent).toBe(50)
    expect(courses[0].completedStepIds).toContain('step_1')
  })
})

describe('training.completeCourse', () => {
  it('records final completion when all required steps are done', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_complete_course'
    await seedTenant(t, clerkOrgId)

    const courseId = await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.training.createCourse, {
          clerkOrgId,
          ...SAMPLE_COURSE,
        })
      })

    await t
      .withIdentity({
        subject: 'user_cg',
        org_id: clerkOrgId,
        org_role: 'org:caregiver',
      })
      .run(async (ctx) => {
        await ctx.runMutation(api.training.completeStep, {
          clerkOrgId,
          courseId,
          stepId: 'step_1',
        })
        await ctx.runMutation(api.training.completeStep, {
          clerkOrgId,
          courseId,
          stepId: 'step_2',
        })
        return ctx.runMutation(api.training.completeCourse, {
          clerkOrgId,
          courseId,
        })
      })

    const completions = await t.run(async (ctx) => {
      return ctx.db.query('platformTrainingCompletions').collect()
    })
    const userCompletion = completions.find(
      (c) => c.clerkUserId === 'user_cg' && c.trainingId === 'test_course',
    )
    expect(userCompletion).toBeDefined()
    expect(userCompletion?.status).toBe('completed')
  })
})

describe('training.seedDefaultCourses', () => {
  it('seeds default courses idempotently', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_seed_defaults'
    await seedTenant(t, clerkOrgId)

    const first = await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.training.seedDefaultCourses, { clerkOrgId })
      })

    expect(first.seeded).toBe(true)

    const second = await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.training.seedDefaultCourses, { clerkOrgId })
      })

    expect(second.seeded).toBe(false)
  })
})

describe('training.listAllCourses', () => {
  it('returns all courses for admins, including inactive ones', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_all'
    await seedTenant(t, clerkOrgId)

    const courseId = await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.training.createCourse, {
          clerkOrgId,
          ...SAMPLE_COURSE,
        })
      })

    await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.training.toggleCourse, {
          clerkOrgId,
          courseId,
          active: false,
        })
      })

    const all = await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runQuery(api.training.listAllCourses, { clerkOrgId })
      })

    expect(all).toHaveLength(1)
    expect(all[0]._id).toBe(courseId)
    expect(all[0].active).toBe(false)
  })

  it('blocks non-admin learners from listing all courses', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_all_guard'
    await seedTenant(t, clerkOrgId)

    await expect(
      t
        .withIdentity({
          subject: 'user_cg',
          org_id: clerkOrgId,
          org_role: 'org:caregiver',
        })
        .run(async (ctx) => {
          return ctx.runQuery(api.training.listAllCourses, { clerkOrgId })
        }),
    ).rejects.toThrow()
  })
})

describe('seedGoldenAgesTraining', () => {
  it('seeds the Golden Ages onboarding course with slide steps', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_seed_golden_ages'
    await seedTenant(t, clerkOrgId)

    await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.seedGoldenAges.seedGoldenAgesTraining, {
          clerkOrgId,
        })
      })

    const courses = await t
      .withIdentity({
        subject: 'user_cg',
        org_id: clerkOrgId,
        org_role: 'org:caregiver',
      })
      .run(async (ctx) => {
        return ctx.runQuery(api.training.listCourses, { clerkOrgId })
      })

    expect(courses).toHaveLength(7)
    const onboarding = courses.find((c) => c.courseKey === 'golden_ages_onboarding')
    expect(onboarding).toBeDefined()
    expect(onboarding!.steps.some((s) => s.type === 'slides')).toBe(true)
    expect(onboarding!.steps.every((s) => s.required)).toBe(true)

    const moduleKeys = [
      'ga_california_safety_falls',
      'ga_california_outdoor_safety',
      'ga_california_emergency',
      'ga_california_disaster',
      'ga_california_infection',
      'ga_california_scenarios',
    ]
    for (const key of moduleKeys) {
      expect(courses.some((c) => c.courseKey === key)).toBe(true)
    }
  })
})

describe('training.getTrainingCompliance', () => {
  async function seedEmployeeWithCourse(t: ReturnType<typeof createTestConvex>) {
    const clerkOrgId = 'org_training_compliance'
    const tenantId = await seedTenant(t, clerkOrgId)
    await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: 'user_cg',
        displayName: 'Caregiver',
        email: 'cg@example.com',
        adpSyncStatus: 'pending_credentials',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('trainingCourses', {
        ...SAMPLE_COURSE,
        tenantId,
        active: true,
        isDefault: false,
        createdAt: new Date().toISOString(),
      })
    })
    return { clerkOrgId, tenantId }
  }

  it('flags employees missing required courses', async () => {
    const t = createTestConvex()
    const { clerkOrgId } = await seedEmployeeWithCourse(t)

    const rows = await t
      .withIdentity({ subject: 'user_admin', org_id: clerkOrgId, org_role: 'org:admin' })
      .query(api.training.getTrainingCompliance, { clerkOrgId })
    expect(rows).toHaveLength(1)
    expect(rows[0].missing).toEqual(['Test Course'])
    expect(rows[0].expired).toEqual([])
  })

  it('flags expired completions and clears once current', async () => {
    const t = createTestConvex()
    const { clerkOrgId, tenantId } = await seedEmployeeWithCourse(t)
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await t.run(async (ctx) => {
      await ctx.db.insert('platformTrainingCompletions', {
        tenantId,
        clerkUserId: 'user_cg',
        trainingId: 'test_course',
        completedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed',
        expiresAt: past,
      })
    })

    const rows = await t
      .withIdentity({ subject: 'user_admin', org_id: clerkOrgId, org_role: 'org:admin' })
      .query(api.training.getTrainingCompliance, { clerkOrgId })
    expect(rows).toHaveLength(1)
    expect(rows[0].expired).toEqual(['Test Course'])

    await t.run(async (ctx) => {
      const existing = await ctx.db.query('platformTrainingCompletions').collect()
      await ctx.db.patch(existing[0]._id, {
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      })
    })
    const cleared = await t
      .withIdentity({ subject: 'user_admin', org_id: clerkOrgId, org_role: 'org:admin' })
      .query(api.training.getTrainingCompliance, { clerkOrgId })
    expect(cleared).toHaveLength(0)
  })
})

describe('training management (assignments, external uploads, expiry alerts)', () => {
  async function seed(t: ReturnType<typeof createTestConvex>) {
    const clerkOrgId = 'org_training_mgmt'
    const tenantId = await seedTenant(t, clerkOrgId)
    await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: 'user_cg',
        displayName: 'Caregiver',
        email: 'cg@example.com',
        adpSyncStatus: 'pending_credentials',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('trainingCourses', {
        ...SAMPLE_COURSE,
        tenantId,
        active: true,
        isDefault: false,
        createdAt: new Date().toISOString(),
      })
    })
    const courseId = await t.run(async (ctx) => {
      const course = await ctx.db
        .query('trainingCourses')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .first()
      return course!._id
    })
    return { clerkOrgId, tenantId, courseId }
  }

  it('assigns a course, lists it for the member, and unassigns', async () => {
    const t = createTestConvex()
    const { clerkOrgId, courseId } = await seed(t)

    const assignmentId = await t.withIdentity({ subject: 'user_admin', org_id: clerkOrgId, org_role: 'org:admin' }).mutation(
      api.training.assignTraining,
      { clerkOrgId, courseId, clerkUserId: 'user_cg', dueAt: '2026-10-15' },
    )
    expect(assignmentId).toBeDefined()

    const mine = await t
      .withIdentity({ subject: 'user_cg', org_id: clerkOrgId, org_role: 'org:caregiver' })
      .query(api.training.listMyTrainingAssignments, { clerkOrgId })
    expect(mine).toHaveLength(1)
    expect(mine[0].dueAt).toBe('2026-10-15')

    const assignees = await t.withIdentity({ subject: 'user_admin', org_id: clerkOrgId, org_role: 'org:admin' }).query(
      api.training.listCourseAssignments,
      { clerkOrgId, courseId },
    )
    expect(assignees).toHaveLength(1)
    expect(assignees[0].memberName).toBe('Caregiver')

    await t.withIdentity({ subject: 'user_admin', org_id: clerkOrgId, org_role: 'org:admin' }).mutation(
      api.training.unassignTraining,
      { clerkOrgId, assignmentId },
    )
    const after = await t.withIdentity({ subject: 'user_admin', org_id: clerkOrgId, org_role: 'org:admin' }).query(
      api.training.listCourseAssignments,
      { clerkOrgId, courseId },
    )
    expect(after).toHaveLength(0)
  })

  it('external upload creates a pending archive item and notifies staff', async () => {
    const t = createTestConvex()
    const { clerkOrgId } = await seed(t)

    await t
      .withIdentity({ subject: 'user_cg', org_id: clerkOrgId, org_role: 'org:caregiver' })
      .mutation(api.training.uploadExternalTraining, {
        clerkOrgId,
        title: 'CPR Renewal — Red Cross',
        storageId: 'storage_ext_1',
        fileName: 'cpr.pdf',
        contentType: 'application/pdf',
        size: 1234,
      })

    const rows = await t.run(async (ctx) => ({
      items: await ctx.db.query('documentArchiveItems').collect(),
      notes: await ctx.db.query('notifications').collect(),
    }))
    expect(rows.items).toHaveLength(1)
    expect(rows.items[0].category).toBe('external_training')
    expect(rows.items[0].status).toBe('pending')
    expect(rows.notes.length).toBeGreaterThan(0)
    expect(rows.notes[0].type).toBe('external_training_uploaded')
  })

  it('expiry cron alerts once for soon-expiring completions', async () => {
    const t = createTestConvex()
    const { clerkOrgId, tenantId } = await seed(t)
    const soon = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    await t.run(async (ctx) => {
      await ctx.db.insert('platformTrainingCompletions', {
        tenantId,
        clerkUserId: 'user_cg',
        trainingId: 'test_course',
        completedAt: new Date().toISOString(),
        status: 'completed',
        expiresAt: soon,
      })
    })

    const { internal } = await import('./_generated/api')
    const first = await t.mutation(internal.training.checkTrainingExpirations, {})
    expect(first.alerted).toBe(1)
    const second = await t.mutation(internal.training.checkTrainingExpirations, {})
    expect(second.alerted).toBe(0)

    const notes = await t.run(async (ctx) =>
      ctx.db.query('notifications').collect(),
    )
    expect(notes.filter((n) => n.type === 'training_expiring')).toHaveLength(1)
    expect(notes[0].clerkUserId).toBe('user_cg')
    expect(clerkOrgId).toBeTruthy()
  })
})

describe('external training assignments', () => {
  it('full flow: assign → task visible → submit → verify', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_ext_assign'
    const tenantId = await seedTenant(t, clerkOrgId)
    await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: 'user_cg',
        displayName: 'Caregiver',
        email: 'cg@example.com',
        adpSyncStatus: 'pending_credentials',
        createdAt: new Date().toISOString(),
      })
    })

    await t
      .withIdentity({ subject: 'user_admin', org_id: clerkOrgId, org_role: 'org:admin' })
      .mutation(api.training.createExternalTrainingAssignment, {
        clerkOrgId,
        title: 'CPR Renewal — Red Cross',
        instructions: 'Book at redcross.org and upload the card.',
        clerkUserIds: ['user_cg'],
        dueAt: '2026-10-31',
      })

    const mine = await t
      .withIdentity({ subject: 'user_cg', org_id: clerkOrgId, org_role: 'org:caregiver' })
      .query(api.training.listMyExternalTrainingAssignments, { clerkOrgId })
    expect(mine).toHaveLength(1)
    expect(mine[0].status).toBe('pending')
    expect(mine[0].title).toBe('CPR Renewal — Red Cross')

    await t
      .withIdentity({ subject: 'user_cg', org_id: clerkOrgId, org_role: 'org:caregiver' })
      .mutation(api.training.submitExternalTraining, {
        clerkOrgId,
        assignmentId: mine[0]._id,
        storageId: 'st_ext_1',
        fileName: 'cpr.pdf',
        contentType: 'application/pdf',
        size: 999,
      })

    const afterSubmit = await t
      .withIdentity({ subject: 'user_admin', org_id: clerkOrgId, org_role: 'org:admin' })
      .query(api.training.listExternalTrainingAssignments, { clerkOrgId })
    expect(afterSubmit[0].status).toBe('submitted')
    expect(afterSubmit[0].memberName).toBe('Caregiver')

    await t
      .withIdentity({ subject: 'user_admin', org_id: clerkOrgId, org_role: 'org:admin' })
      .mutation(api.training.reviewExternalTraining, {
        clerkOrgId,
        assignmentId: mine[0]._id,
        approve: true,
      })

    const rows = await t.run(async (ctx) => ({
      assignment: await ctx.db.get(mine[0]._id),
      items: await ctx.db.query('documentArchiveItems').collect(),
    }))
    expect(rows.assignment?.status).toBe('verified')
    expect(rows.items[0].status).toBe('verified')
  })

  it('rejecting sends the reason and lets the member resubmit', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_ext_reject'
    const tenantId = await seedTenant(t, clerkOrgId)
    await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: 'user_cg',
        displayName: 'Caregiver',
        email: 'cg@example.com',
        adpSyncStatus: 'pending_credentials',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('externalTrainingAssignments', {
        tenantId,
        title: 'CPR Renewal',
        clerkUserId: 'user_cg',
        assignedBy: 'user_admin',
        status: 'submitted',
        storageId: 'st_old',
        fileName: 'old.pdf',
        createdAt: new Date().toISOString(),
      })
    })
    const assignmentId = await t.run(async (ctx) =>
      (await ctx.db.query('externalTrainingAssignments').first())!._id,
    )

    await t
      .withIdentity({ subject: 'user_admin', org_id: clerkOrgId, org_role: 'org:admin' })
      .mutation(api.training.reviewExternalTraining, {
        clerkOrgId,
        assignmentId,
        approve: false,
        rejectionReason: 'Card is expired',
      })

    const rejected = await t.run(async (ctx) => ctx.db.get(assignmentId))
    expect(rejected?.status).toBe('rejected')
    expect(rejected?.rejectionReason).toBe('Card is expired')

    // Member can resubmit after a rejection.
    await t
      .withIdentity({ subject: 'user_cg', org_id: clerkOrgId, org_role: 'org:caregiver' })
      .mutation(api.training.submitExternalTraining, {
        clerkOrgId,
        assignmentId,
        storageId: 'st_new',
        fileName: 'new.pdf',
        contentType: 'application/pdf',
        size: 500,
      })
    const resubmitted = await t.run(async (ctx) => ctx.db.get(assignmentId))
    expect(resubmitted?.status).toBe('submitted')
  })
})
